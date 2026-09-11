using System.Net.Http.Headers;
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc.Testing;
using Teach.Api.Contracts;
using Teach.Api.Domain;
using Teach.Api.Endpoints;
using Teach.Api.Model;

namespace Teach.Api.Tests;

public class ApiFactory : WebApplicationFactory<Program>
{
    private readonly string _db = Path.Combine(Path.GetTempPath(), $"teach-test-{Guid.NewGuid():N}.db");

    protected override void ConfigureWebHost(Microsoft.AspNetCore.Hosting.IWebHostBuilder builder)
    {
        builder.UseSetting("Teach:Db", $"Data Source={_db}");
        builder.UseSetting("Teach:Model", "stub");
        builder.UseSetting("Teach:StageDelayMs", "20");
    }

    protected override void Dispose(bool disposing)
    {
        base.Dispose(disposing);
        try { File.Delete(_db); } catch { /* temp */ }
    }
}

public sealed class SecuredApiFactory : ApiFactory
{
    protected override void ConfigureWebHost(Microsoft.AspNetCore.Hosting.IWebHostBuilder builder)
    {
        base.ConfigureWebHost(builder);
        builder.UseSetting("Teach:ApiToken", "secret-1");
    }
}

public class TokenAndOwnerTests(SecuredApiFactory f) : IClassFixture<SecuredApiFactory>
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    private static HttpClient WithToken(HttpClient c, string token)
    {
        c.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return c;
    }

    private async Task<string> IssueTesterAsync(string name)
    {
        var admin = WithToken(f.CreateClient(), "secret-1");
        var res = await admin.PostAsJsonAsync("/admin/tokens", new NewTesterTokenRequest(name));
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        return (await res.Content.ReadFromJsonAsync<TesterTokenResponse>(Json))!.Token;
    }

    [Fact]
    public async Task IssuedTesterTokenWorksAndCanBeRevokedWithoutTouchingOthers()
    {
        var first = await IssueTesterAsync("qa-one");
        var second = await IssueTesterAsync("qa-two");
        var c1 = WithToken(f.CreateClient(), first);
        var c2 = WithToken(f.CreateClient(), second);
        Assert.Equal(HttpStatusCode.OK, (await c1.PostAsJsonAsync("/subjects/focus", new FocusRequest("SQL"))).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await c2.PostAsJsonAsync("/subjects/focus", new FocusRequest("SQL"))).StatusCode);

        var admin = WithToken(f.CreateClient(), "secret-1");
        var list = await admin.GetFromJsonAsync<TokenInfo[]>("/admin/tokens", Json);
        var id = list!.First(x => x.Name == "qa-one").Id;
        Assert.Equal(HttpStatusCode.NoContent, (await admin.DeleteAsync($"/admin/tokens/{id}")).StatusCode);

        // Отозванный перестал работать сразу, второй жив.
        Assert.Equal(HttpStatusCode.Unauthorized, (await c1.PostAsJsonAsync("/subjects/focus", new FocusRequest("SQL"))).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await c2.PostAsJsonAsync("/subjects/focus", new FocusRequest("SQL"))).StatusCode);
    }

    [Fact]
    public async Task SubjectsAreVisibleOnlyToTheirOwner()
    {
        var mine = WithToken(f.CreateClient(), await IssueTesterAsync("owner-a"));
        var other = WithToken(f.CreateClient(), await IssueTesterAsync("owner-b"));

        var created = await mine.PostAsJsonAsync("/subjects", new SubjectDraft("SQL", "Основы и синтаксис", "писать отчёты", ["src-0"]));
        var id = (await created.Content.ReadFromJsonAsync<SubjectCreated>(Json))!.SubjectId;

        // Владелец видит предмет, чужой — нет (404, а не 403: чужие id не подтверждаем).
        Assert.Equal(HttpStatusCode.OK, (await mine.GetAsync($"/subjects/{id}/lesson")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await other.GetAsync($"/subjects/{id}/lesson")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await other.PostAsync($"/subjects/{id}/prefetch", null)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await other.GetAsync($"/subjects/{id}/lessons")).StatusCode);

        // Список отдаёт только свои предметы.
        var minesList = await mine.GetFromJsonAsync<SubjectSummary[]>("/subjects", Json);
        var othersList = await other.GetFromJsonAsync<SubjectSummary[]>("/subjects", Json);
        Assert.Contains(minesList!, x => x.Id == id);
        Assert.DoesNotContain(othersList!, x => x.Id == id);

        // Разбор по чужому предмету только сохраняет записи и не готовит урок.
        var recap = await other.PostAsJsonAsync($"/sessions/{id}/recap", new RecapRequest([new("a", "…", true, 1, 1)]));
        Assert.Equal("stored", (await recap.Content.ReadFromJsonAsync<RecapAccepted>(Json))!.Status);
    }

    [Fact]
    public async Task SubjectsFromBeforeSignInStayReachableAfterAccountTokensAppear()
    {
        // Предмет старой сборки: создан под общим токеном.
        var legacy = WithToken(f.CreateClient(), "secret-1");
        var created = await legacy.PostAsJsonAsync("/subjects", new SubjectDraft("SQL", "Основы и синтаксис", "писать отчёты", ["src-0"]));
        var id = (await created.Content.ReadFromJsonAsync<SubjectCreated>(Json))!.SubjectId;

        // После обновления клиент ходит с токеном аккаунта — предмет не должен пропасть.
        var account = WithToken(f.CreateClient(), await IssueTesterAsync("after-update"));
        Assert.Equal(HttpStatusCode.OK, (await account.GetAsync($"/subjects/{id}/lesson")).StatusCode);
        var recap = await account.PostAsJsonAsync($"/sessions/{id}/recap", new RecapRequest([new("a", "…", true, 1, 1)]));
        Assert.Equal(HttpStatusCode.Accepted, recap.StatusCode);
        Assert.Equal("preparing", (await recap.Content.ReadFromJsonAsync<RecapAccepted>(Json))!.Status);
    }

    [Fact]
    public async Task OnlyTheSharedTokenCanMintAndListTesterTokens()
    {
        var tester = WithToken(f.CreateClient(), await IssueTesterAsync("not-admin"));
        Assert.Equal(HttpStatusCode.Forbidden, (await tester.PostAsJsonAsync("/admin/tokens", new NewTesterTokenRequest("x"))).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await tester.GetAsync("/admin/tokens")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await tester.DeleteAsync($"/admin/tokens/{Guid.NewGuid()}")).StatusCode);
    }

    [Fact]
    public async Task AppleSignInRejectsAGarbageIdentityTokenAndNeedsNoBearer()
    {
        var anon = f.CreateClient();
        var res = await anon.PostAsJsonAsync("/auth/apple", new AppleSignInRequest("not-a-jwt"));
        Assert.Equal(HttpStatusCode.Unauthorized, res.StatusCode);
    }
}

public class AuthTests(SecuredApiFactory f) : IClassFixture<SecuredApiFactory>
{
    [Fact]
    public async Task TokenIsRequiredEverywhereExceptHealth()
    {
        var anon = f.CreateClient();
        Assert.Equal(HttpStatusCode.OK, (await anon.GetAsync("/health")).StatusCode);
        // Документация и описание API публичны.
        Assert.Equal(HttpStatusCode.OK, (await anon.GetAsync("/openapi/v1.json")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await anon.GetAsync("/docs/")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await anon.PostAsJsonAsync("/subjects/focus", new FocusRequest("SQL"))).StatusCode);

        var wrong = f.CreateClient();
        wrong.DefaultRequestHeaders.Authorization = new("Bearer", "nope");
        Assert.Equal(HttpStatusCode.Unauthorized, (await wrong.PostAsJsonAsync("/subjects/focus", new FocusRequest("SQL"))).StatusCode);

        var ok = f.CreateClient();
        ok.DefaultRequestHeaders.Authorization = new("Bearer", "secret-1");
        Assert.Equal(HttpStatusCode.OK, (await ok.PostAsJsonAsync("/subjects/focus", new FocusRequest("SQL"))).StatusCode);
    }
}

public class ApiTests : IClassFixture<ApiFactory>
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);
    private readonly HttpClient _http;

    public ApiTests(ApiFactory f) => _http = f.CreateClient();

    [Fact]
    public async Task HealthReportsStubModel()
    {
        var r = await _http.GetFromJsonAsync<JsonElement>("/health");
        Assert.Equal("stub", r.GetProperty("model").GetString());
    }

    [Fact]
    public async Task WizardEndpointsReturnPrototypeContent()
    {
        var focus = await Post<FocusOption[]>("/subjects/focus", new FocusRequest("История"));
        Assert.Equal("Поздняя Античность", focus![0].T);

        var job = await _http.PostAsJsonAsync("/subjects/sources", new SourcesRequest("SQL", "Основы и синтаксис"));
        Assert.Equal(HttpStatusCode.Accepted, job.StatusCode);
        var jobId = (await job.Content.ReadFromJsonAsync<JobCreated>(Json))!.JobId;
        SourcesJobStatus? st = null;
        for (var i = 0; i < 100 && st?.Status != "ready"; i++)
        {
            st = await _http.GetFromJsonAsync<SourcesJobStatus>($"/subjects/sources/{jobId}", Json);
            if (st!.Status != "ready") await Task.Delay(10);
        }
        Assert.Equal("ready", st!.Status);
        Assert.Equal(4, st.Items!.Count);
        Assert.Equal(["high", "high", "mid", "low"], st.Items.Select(s => s.Trust));
        Assert.Equal(HttpStatusCode.NotFound, (await _http.GetAsync("/subjects/sources/nope")).StatusCode);

        var plan = await Post<PlanStage[]>("/subjects/plan", new PlanRequest("SQL", "Основы", "писать отчёты"));
        Assert.Equal("писать отчёты", plan![2].D);
    }

    [Fact]
    public async Task EmptyTopicIsRejected()
    {
        var r = await _http.PostAsJsonAsync("/subjects/focus", new FocusRequest(" "));
        Assert.Equal(HttpStatusCode.BadRequest, r.StatusCode);
    }

    [Fact]
    public async Task CreatingASubjectPreparesTheDiagnosticInBackground()
    {
        var created = await _http.PostAsJsonAsync("/subjects", new SubjectDraft("SQL", "Основы и синтаксис", "писать отчёты", ["src-0", "src-1"]));
        Assert.Equal(HttpStatusCode.Accepted, created.StatusCode);
        var body = await created.Content.ReadFromJsonAsync<SubjectCreated>(Json);
        Assert.Equal("preparing", body!.Status);

        LessonStatus? status = null;
        var stages = new HashSet<int>();
        for (var i = 0; i < 200; i++)
        {
            status = await _http.GetFromJsonAsync<LessonStatus>($"/subjects/{body.SubjectId}/lesson", Json);
            if (status!.Stage is int st) stages.Add(st);
            if (status.Status == "ready") break;
            await Task.Delay(20);
        }
        Assert.Equal("ready", status!.Status);
        Assert.NotNull(status.Lesson);
        Assert.Equal("SQL", status.Lesson!.Name);
        Assert.Equal("Урок 1 · Стартовая диагностика", status.Lesson.LessonTitle);
        Assert.IsType<ExplainStep>(status.Lesson.Steps[0]);
        Assert.Equal(-1, ((ChoiceStep)status.Lesson.Steps[1]).Correct);
        Assert.Empty(LessonValidator.Validate(status.Lesson));
    }

    [Fact]
    public async Task RecapOnAServerSubjectPreparesTheNextLesson()
    {
        var created = await _http.PostAsJsonAsync("/subjects", new SubjectDraft("SQL", "Основы и синтаксис", "писать отчёты", ["src-0"]));
        var id = (await created.Content.ReadFromJsonAsync<SubjectCreated>(Json))!.SubjectId;
        var first = await WaitReady(id);
        Assert.Equal(1, first.Number);

        var recap = await _http.PostAsJsonAsync($"/sessions/{id}/recap", new RecapRequest([new("Стартовая уверенность", "…", true, 1), new("Карта того, что уже есть", "…", false, 2)]));
        Assert.Equal(HttpStatusCode.Accepted, recap.StatusCode);
        Assert.Equal("preparing", (await recap.Content.ReadFromJsonAsync<RecapAccepted>(Json))!.Status);

        var second = await WaitReady(id, expectNumber: 2);
        Assert.Equal(2, second.Number);
        Assert.True(first.Lesson!.Diagnostic);
        Assert.False(second.Lesson!.Diagnostic);
        Assert.Equal("Урок 2 · Каркас: термины и карта темы", second.Lesson!.LessonTitle);
        Assert.Contains("Карта того, что уже есть", ((ExplainStep)second.Lesson.Steps[0]).Paras[0]);
        Assert.Empty(LessonValidator.Validate(second.Lesson));
    }

    [Fact]
    public async Task PlanStageAdvancesByResultsNotByLessonNumber()
    {
        var created = await _http.PostAsJsonAsync("/subjects", new SubjectDraft("SQL", "Основы", "отчёты", ["src-0"], Title: "SQL"));
        var id = (await created.Content.ReadFromJsonAsync<SubjectCreated>(Json))!.SubjectId;
        var st = await WaitReady(id);
        Assert.Equal(0, st.PlanStage);
        Assert.Equal(3, st.PlanTotal);

        async Task<LessonStatus> Recap(int lesson, params bool[] oks)
        {
            var recs = oks.Select((ok, i) => new RecapRecord($"r{lesson}-{i}", "n", ok, i + 1, lesson)).ToArray();
            var r = await _http.PostAsJsonAsync($"/sessions/{id}/recap", new RecapRequest(recs));
            Assert.Equal(HttpStatusCode.Accepted, r.StatusCode);
            return await WaitReady(id, lesson + 1);
        }

        // Диагностика не в счёт; урок 2 сделан слабо → остаёмся на этапе 0 и после урока 3.
        st = await Recap(1, true, true);
        Assert.Equal(0, st.PlanStage);
        st = await Recap(2, false, false, true);
        Assert.Equal(0, st.PlanStage);
        // Уроки 3 и 4 уверенные → следующий урок уже на этапе 1 (по номеру это был бы ещё этап 0).
        st = await Recap(3, true, true, true);
        Assert.Equal(0, st.PlanStage); // предыдущий (2) слабый
        st = await Recap(4, true, true, true);
        Assert.Equal(1, st.PlanStage);
        Assert.Equal(5, st.Number);
        Assert.Equal("Урок 5 · Рабочие приёмы малыми шагами", st.Lesson!.LessonTitle);
    }

    [Fact]
    public async Task PrefetchedLessonIsServedRightAfterAGoodRecap()
    {
        var created = await _http.PostAsJsonAsync("/subjects", new SubjectDraft("SQL", "Основы и синтаксис", "писать отчёты", ["src-0"]));
        var id = (await created.Content.ReadFromJsonAsync<SubjectCreated>(Json))!.SubjectId;
        await WaitReady(id);

        // Клиент открыл урок 1 → сервер заготавливает урок 2.
        var pf = await _http.PostAsync($"/subjects/{id}/prefetch", null);
        Assert.Equal(HttpStatusCode.Accepted, pf.StatusCode);
        Assert.Equal("queued", (await pf.Content.ReadFromJsonAsync<PrefetchAccepted>(Json))!.Status);
        var st = await WaitPrefetch(id);
        Assert.Equal(1, st.Number);
        Assert.False(st.Prefetched);
        // Повторный вызов не ставит вторую задачу.
        var again = await _http.PostAsync($"/subjects/{id}/prefetch", null);
        Assert.Equal("exists", (await again.Content.ReadFromJsonAsync<PrefetchAccepted>(Json))!.Status);

        // Хороший разбор → заготовка становится уроком 2 без генерации.
        await _http.PostAsJsonAsync($"/sessions/{id}/recap", new RecapRequest([new("a", "…", true, 1, 1), new("b", "…", true, 2, 1)]));
        var second = await WaitReady(id, expectNumber: 2);
        Assert.True(second.Prefetched);
        Assert.False(second.PrefetchReady);
        Assert.StartsWith("этап 01", second.Lesson!.Level);
        Assert.Empty(LessonValidator.Validate(second.Lesson));
    }

    [Fact]
    public async Task PrefetchIsDiscardedAfterAFailedRecap()
    {
        var created = await _http.PostAsJsonAsync("/subjects", new SubjectDraft("SQL", "Основы и синтаксис", "писать отчёты", ["src-0"]));
        var id = (await created.Content.ReadFromJsonAsync<SubjectCreated>(Json))!.SubjectId;
        await WaitReady(id);
        await _http.PostAsync($"/subjects/{id}/prefetch", null);
        await WaitPrefetch(id);

        // Меньше половины верных → заготовка выбрасывается, урок 2 собирается заново по записям.
        await _http.PostAsJsonAsync($"/sessions/{id}/recap", new RecapRequest([new("a", "…", false, 1, 1), new("b", "…", false, 2, 1), new("c", "…", true, 3, 1)]));
        var second = await WaitReady(id, expectNumber: 2);
        Assert.False(second.Prefetched);
        Assert.Equal(2, second.Number);
    }

    [Fact]
    public async Task PrefetchIsSkippedWhileTheSubjectIsPreparing()
    {
        var created = await _http.PostAsJsonAsync("/subjects", new SubjectDraft("SQL", "Основы и синтаксис", "писать отчёты", ["src-0"]));
        var id = (await created.Content.ReadFromJsonAsync<SubjectCreated>(Json))!.SubjectId;
        var pf = await _http.PostAsync($"/subjects/{id}/prefetch", null);
        Assert.Equal("skipped", (await pf.Content.ReadFromJsonAsync<PrefetchAccepted>(Json))!.Status);
        Assert.Equal(HttpStatusCode.NotFound, (await _http.PostAsync($"/subjects/{Guid.NewGuid()}/prefetch", null)).StatusCode);
        await WaitReady(id);
    }

    [Fact]
    public async Task RepeatedRecapOfTheSameLessonIsIdempotent()
    {
        var created = await _http.PostAsJsonAsync("/subjects", new SubjectDraft("SQL", "Основы и синтаксис", "писать отчёты", ["src-0"]));
        var id = (await created.Content.ReadFromJsonAsync<SubjectCreated>(Json))!.SubjectId;
        await WaitReady(id);
        var recs = new RecapRecord[] { new("a", "…", true, 1, 1), new("b", "…", false, 2, 1) };
        await _http.PostAsJsonAsync($"/sessions/{id}/recap", new RecapRequest(recs));
        var second = await WaitReady(id, expectNumber: 2);

        // Клиент перезапустился и прислал тот же разбор ещё раз: урок 3 не собирается, записи не дублируются.
        var again = await _http.PostAsJsonAsync($"/sessions/{id}/recap", new RecapRequest(recs));
        Assert.Equal("ready", (await again.Content.ReadFromJsonAsync<RecapAccepted>(Json))!.Status);
        await Task.Delay(200);
        var st = await _http.GetFromJsonAsync<LessonStatus>($"/subjects/{id}/lesson", Json);
        Assert.Equal(2, st!.Number);
        Assert.Equal(second.Lesson!.LessonTitle, st.Lesson!.LessonTitle);
    }

    [Fact]
    public async Task LessonHistoryListsEveryLessonInOrder()
    {
        var created = await _http.PostAsJsonAsync("/subjects", new SubjectDraft("SQL", "Основы и синтаксис", "писать отчёты", ["src-0"]));
        var id = (await created.Content.ReadFromJsonAsync<SubjectCreated>(Json))!.SubjectId;
        var first = await WaitReady(id);
        await _http.PostAsJsonAsync($"/sessions/{id}/recap", new RecapRequest([new("a", "…", true, 1, 1)]));
        var second = await WaitReady(id, expectNumber: 2);

        var history = await _http.GetFromJsonAsync<LessonHistoryItem[]>($"/subjects/{id}/lessons", Json);
        Assert.Equal([1, 2], history!.Select(h => h.Number).ToArray());
        Assert.Equal(first.Lesson!.LessonTitle, history[0].Lesson.LessonTitle);
        Assert.Equal(second.Lesson!.LessonTitle, history[1].Lesson.LessonTitle);
        Assert.Equal(HttpStatusCode.NotFound, (await _http.GetAsync($"/subjects/{Guid.NewGuid()}/lessons")).StatusCode);
    }

    private async Task<LessonStatus> WaitPrefetch(string id)
    {
        LessonStatus? status = null;
        for (var i = 0; i < 300; i++)
        {
            status = await _http.GetFromJsonAsync<LessonStatus>($"/subjects/{id}/lesson", Json);
            if (status!.PrefetchReady) return status;
            await Task.Delay(20);
        }
        throw new Xunit.Sdk.XunitException($"prefetch not ready: {status?.Status}/{status?.Number}");
    }

    private async Task<LessonStatus> WaitReady(string id, int expectNumber = 1)
    {
        LessonStatus? status = null;
        for (var i = 0; i < 300; i++)
        {
            status = await _http.GetFromJsonAsync<LessonStatus>($"/subjects/{id}/lesson", Json);
            if (status!.Status == "ready" && status.Number >= expectNumber) return status;
            await Task.Delay(20);
        }
        throw new Xunit.Sdk.XunitException($"lesson {expectNumber} not ready: {status?.Status}/{status?.Number}");
    }

    [Fact]
    public async Task TitleEndpointShortensTheTopic()
    {
        var r = await Post<TitleResponse>("/subjects/title", new FocusRequest("Итальянский язык с самого начала"));
        Assert.Equal("Итальянский", r!.Title);
        Assert.Equal("Публичные выступления", StubLessonModel.TrimWords("Публичные выступления перед руководством"));
        Assert.Equal("Английский", StubLessonModel.TrimWords("Английский для собеседований"));
        Assert.Equal("SQL", StubLessonModel.TrimWords("SQL"));
    }

    [Fact]
    public async Task ReadyLessonCarriesTheGlossaryReference()
    {
        var created = await _http.PostAsJsonAsync("/subjects", new SubjectDraft("SQL для аналитиков", "Основы", "писать отчёты", ["src-0"], Title: "SQL"));
        var id = (await created.Content.ReadFromJsonAsync<SubjectCreated>(Json))!.SubjectId;
        var st = await WaitReady(id);
        Assert.Equal("SQL", st.Lesson!.Name);
        Assert.NotNull(st.References);
        var g = Assert.Single(st.References!);
        Assert.Equal("Глоссарий", g.Group);
        Assert.Equal("Термины · SQL", g.Title);
        Assert.Equal(1, g.UpdatedAfter);
        Assert.Equal(2, g.Rows.Length);
    }

    [Fact]
    public async Task UnknownSubjectIs404()
    {
        var r = await _http.GetAsync($"/subjects/{Guid.NewGuid()}/lesson");
        Assert.Equal(HttpStatusCode.NotFound, r.StatusCode);
    }

    [Fact]
    public async Task RecapIsAcceptedAndGradeUsesKeywords()
    {
        var recap = await _http.PostAsJsonAsync("/sessions/en/recap", new RecapRequest([new("После if не бывает would", "…", false, 1)]));
        Assert.Equal(HttpStatusCode.Accepted, recap.StatusCode);
        Assert.Equal("stored", (await recap.Content.ReadFromJsonAsync<RecapAccepted>(Json))!.Status);

        var grade = await Post<GradeResponse>("/grade/free", new GradeRequest(
            [new("Богаче налоговая база Востока", ["налог", "богат"]), new("Константинополь труднее взять", ["стен", "море"])],
            "Восток был богатым", "ru"));
        Assert.Equal([true, false], grade!.Hits);
    }

    private async Task<T?> Post<T>(string url, object body)
    {
        var r = await _http.PostAsJsonAsync(url, body);
        r.EnsureSuccessStatusCode();
        return await r.Content.ReadFromJsonAsync<T>(Json);
    }
}
