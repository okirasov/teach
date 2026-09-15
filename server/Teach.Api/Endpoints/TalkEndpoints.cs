using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Teach.Api.Auth;
using Teach.Api.Contracts;
using Teach.Api.Data;
using Teach.Api.Domain;
using Teach.Api.Jobs;
using Teach.Api.Model;

namespace Teach.Api.Endpoints;

/// <summary>
/// Разговор с бадди (FR-66, SR-16): текст с телефона → реплика бадди по SSE → озвучка на телефоне.
/// История живёт на сервере: последние TalkHistory.Keep реплик как есть, старое свёрнуто.
/// </summary>
public static class TalkEndpoints
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    public static IEndpointRouteBuilder MapTalks(this IEndpointRouteBuilder app)
    {
        app.MapPost("/subjects/{id:guid}/talks", async (Guid id, HttpContext ctx, TeachDb db, DigestService digests, CancellationToken ct) =>
        {
            var s = await db.Subjects.FindAsync([id], ct);
            if (s is null || !ContentEndpoints.Owns(ctx, s)) return Results.NotFound();
            if (s.Status != SubjectStatus.Ready) return Results.Conflict(new { error = "lesson not ready" });
            // Дайджест обычно уже собран воркером; если разговор начался раньше — собираем один раз здесь.
            await digests.EnsureAsync(db, s, ct);
            var talk = new TalkRow { Id = Guid.NewGuid(), SubjectId = id, OwnerId = AuthEndpoints.Caller(ctx).Owner, TurnsJson = "[]", StartedAt = DateTimeOffset.UtcNow, UpdatedAt = DateTimeOffset.UtcNow };
            db.Talks.Add(talk);
            await db.SaveChangesAsync(ct);
            return Results.Created($"/talks/{talk.Id}", new TalkCreated(talk.Id.ToString()));
        }).WithSummary("Начать разговор с бадди по предмету. Дайджест предмета собирается, если его ещё нет.").WithTags("Разговор");

        // Разговор без серверного предмета (демо-предметы живут только в клиенте): контекст приходит в теле,
        // дайджест собирается один раз и хранится в самом разговоре.
        app.MapPost("/talks", async (TalkDraft d, HttpContext ctx, TeachDb db, ILessonModel model, CancellationToken ct) =>
        {
            if (string.IsNullOrWhiteSpace(d.Topic)) return Results.BadRequest("topic is required");
            var draft = new SubjectDraft(d.Topic.Trim(), (d.Focus ?? "").Trim(), (d.Mission ?? "").Trim(), [], Title: d.Title);
            var digest = await model.BuildDigestAsync(draft, d.Stage, 0, d.Records ?? [], d.Glossary ?? [], ct);
            var talk = new TalkRow { Id = Guid.NewGuid(), SubjectId = Guid.Empty, OwnerId = AuthEndpoints.Caller(ctx).Owner, TurnsJson = "[]", DigestText = digest, StartedAt = DateTimeOffset.UtcNow, UpdatedAt = DateTimeOffset.UtcNow };
            db.Talks.Add(talk);
            await db.SaveChangesAsync(ct);
            return Results.Created($"/talks/{talk.Id}", new TalkCreated(talk.Id.ToString()));
        }).WithSummary("Начать разговор без серверного предмета (демо): тема, фокус, миссия, этап, глоссарий и записи в теле.").WithTags("Разговор");

        app.MapPost("/talks/{id:guid}/turns", async (Guid id, TurnRequest r, HttpContext ctx, TeachDb db, ILessonModel model, ILogger<TalkRow> log, CancellationToken ct) =>
        {
            var talk = await db.Talks.FindAsync([id], ct);
            if (talk is null || !OwnsTalk(ctx, talk))
            {
                ctx.Response.StatusCode = StatusCodes.Status404NotFound;
                return;
            }
            if (talk.Ended)
            {
                ctx.Response.StatusCode = StatusCodes.Status409Conflict;
                await ctx.Response.WriteAsJsonAsync(new { error = "talk ended" }, Json, ct);
                return;
            }
            var subject = talk.SubjectId == Guid.Empty ? null : await db.Subjects.AsNoTracking().FirstOrDefaultAsync(x => x.Id == talk.SubjectId, ct);
            var digest = talk.DigestText ?? subject?.DigestText
                ?? (subject is null ? "Предмет не задан." : $"Предмет: {subject.Title ?? subject.Topic}. Фокус: {subject.Focus}. Миссия: {subject.Mission}.");
            var history = JsonSerializer.Deserialize<List<TalkTurn>>(talk.TurnsJson, Json) ?? [];
            var userText = (r.Text ?? "").Trim();

            var res = ctx.Response;
            res.StatusCode = 200;
            res.ContentType = "text/event-stream; charset=utf-8";
            res.Headers.CacheControl = "no-cache";
            res.Headers["X-Accel-Buffering"] = "no";
            await res.StartAsync(ct);

            // Языковой предмет: голос (say) целиком на языке предмета, текст (text) двуязычный; иначе один канал.
            var voiceLang = string.IsNullOrWhiteSpace(r.VoiceLang) ? null : r.VoiceLang.Trim();
            var reply = new StringBuilder();
            var said = new StringBuilder();
            var channels = new TalkChannels();
            async Task EmitAsync(IReadOnlyList<(string Channel, string Text)> parts)
            {
                foreach (var (ch, part) in parts)
                {
                    if (ch == "say") { said.Append(part); await WriteEventAsync(res, new { t = "delta", ch, text = part }, ct); }
                    else { reply.Append(part); await WriteEventAsync(res, new { t = "delta", ch, text = part }, ct); }
                }
            }
            try
            {
                await foreach (var chunk in model.TalkAsync(digest, talk.OlderSummary, history, userText, voiceLang, ct))
                {
                    if (voiceLang is null)
                    {
                        reply.Append(chunk);
                        await WriteEventAsync(res, new { t = "delta", text = chunk }, ct);
                    }
                    else await EmitAsync(channels.Push(chunk));
                }
                if (voiceLang is not null) await EmitAsync(channels.Flush());
            }
            catch (Exception e) when (e is not OperationCanceledException)
            {
                log.LogError(e, "talk {Talk}: model failed", id);
                await WriteEventAsync(res, new { t = "error", message = "model failed" }, CancellationToken.None);
                return;
            }

            var text = reply.ToString().Trim();
            if (userText.Length > 0) history.Add(new TalkTurn("user", userText));
            history.Add(new TalkTurn("buddy", text));
            var turn = history.Count;
            // Сначала отдаём done — клиент уже озвучивает; свёртка старого хвоста идёт после ответа.
            await WriteEventAsync(res, new { t = "done", reply = text, say = voiceLang is null ? null : said.ToString().Trim(), turn }, ct);

            var (kept, dropped) = TalkHistory.Trim(history);
            // Сворачиваем не при малейшем перевесе, а раз в целый обмен (2 реплики) — иначе
            // первый лишний хвост (1 реплика) и следующий (снова 1-2) свёрнутся отдельными
            // мелкими вызовами модели вместо одного связного OlderSummary.
            if (dropped.Count < 2) kept = history;
            else
            {
                try { talk.OlderSummary = await model.SummarizeTalkAsync(talk.OlderSummary, dropped, CancellationToken.None); }
                catch (Exception e) { log.LogWarning(e, "talk {Talk}: fold failed, keeping raw tail", id); kept = history; }
            }
            talk.TurnsJson = JsonSerializer.Serialize(kept, Json);
            talk.UpdatedAt = DateTimeOffset.UtcNow;
            await db.SaveChangesAsync(CancellationToken.None);
        }).WithSummary("Реплика ученика → реплика бадди по SSE (delta…, done). Пустой text — вступление бадди.").WithTags("Разговор");

        app.MapPost("/talks/{id:guid}/end", async (Guid id, HttpContext ctx, TeachDb db, CancellationToken ct) =>
        {
            var talk = await db.Talks.FindAsync([id], ct);
            if (talk is null || !OwnsTalk(ctx, talk)) return Results.NotFound();
            talk.Ended = true;
            talk.UpdatedAt = DateTimeOffset.UtcNow;
            await db.SaveChangesAsync(ct);
            return Results.Accepted(null, new TalkEnded("ended"));
        }).WithSummary("Завершить разговор. Извлечение записей из разговора (FR-68) подключится сюда.").WithTags("Разговор");

        return app;
    }

    private static bool OwnsTalk(HttpContext ctx, TalkRow t) =>
        t.OwnerId == AuthEndpoints.Caller(ctx).Owner || t.OwnerId == Caller.SharedOwner;

    private static async Task WriteEventAsync(HttpResponse res, object payload, CancellationToken ct)
    {
        await res.WriteAsync("data: " + JsonSerializer.Serialize(payload, Json) + "\n\n", ct);
        await res.Body.FlushAsync(ct);
    }
}
