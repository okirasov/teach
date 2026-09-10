using Microsoft.EntityFrameworkCore;
using Teach.Api.Auth;
using Teach.Api.Data;

namespace Teach.Api.Endpoints;

public sealed record AppleSignInRequest(string IdentityToken);
public sealed record SessionTokenResponse(string Token, string OwnerId);
public sealed record NewTesterTokenRequest(string Name);
public sealed record TesterTokenResponse(string Id, string Name, string Token);
public sealed record TokenInfo(string Id, string Kind, string? Name, string OwnerId, DateTimeOffset CreatedAt, DateTimeOffset? LastUsedAt, DateTimeOffset? RevokedAt);

public static class AuthEndpoints
{
    public static IEndpointRouteBuilder MapAuth(this IEndpointRouteBuilder app)
    {
        // Вход приложения: identityToken от Apple меняется на токен сервера, привязанный к пользователю.
        app.MapPost("/auth/apple", async (AppleSignInRequest r, IAppleTokenVerifier verifier, TokenStore tokens, TeachDb db, CancellationToken ct) =>
        {
            var identity = await verifier.VerifyAsync(r.IdentityToken ?? "", ct);
            if (identity is null) return Results.Unauthorized();
            var owner = $"apple:{identity.Sub}";
            var token = await tokens.IssueAsync(owner, "user", null, ct);
            return Results.Ok(new SessionTokenResponse(token, owner));
        }).WithSummary("Обменять Apple identityToken на токен сервера, привязанный к этому пользователю.").WithTags("Доступ").AllowAnonymous();

        // Именные токены тестировщиков: выдаются под общим токеном и отзываются по одному.
        var admin = app.MapGroup("/admin/tokens").WithTags("Доступ");

        admin.MapPost("", async (NewTesterTokenRequest r, HttpContext ctx, TokenStore tokens, CancellationToken ct) =>
        {
            if (!Caller(ctx).IsAdmin) return Results.Forbid();
            var name = (r.Name ?? "").Trim();
            if (name.Length == 0) return Results.BadRequest("name is required");
            var token = await tokens.IssueAsync($"tester:{name}", "tester", name, ct);
            var row = (await tokens.ListAsync(ct)).First(x => x.Name == name && x.RevokedAt is null);
            return Results.Ok(new TesterTokenResponse(row.Id.ToString(), name, token));
        }).WithSummary("Выдать именной токен тестировщику. Значение показывается один раз.");

        admin.MapGet("", async (HttpContext ctx, TokenStore tokens, CancellationToken ct) =>
        {
            if (!Caller(ctx).IsAdmin) return Results.Forbid();
            var rows = await tokens.ListAsync(ct);
            return Results.Ok(rows.Select(x => new TokenInfo(x.Id.ToString(), x.Kind, x.Name, x.OwnerId, x.CreatedAt, x.LastUsedAt, x.RevokedAt)));
        }).WithSummary("Список выданных токенов без самих значений: кто, когда создан, когда использовался, отозван ли.");

        admin.MapDelete("/{id:guid}", async (Guid id, HttpContext ctx, TokenStore tokens, CancellationToken ct) =>
        {
            if (!Caller(ctx).IsAdmin) return Results.Forbid();
            return await tokens.RevokeAsync(id, ct) ? Results.NoContent() : Results.NotFound();
        }).WithSummary("Отозвать токен: он перестаёт работать немедленно, остальные не трогаются.");

        return app;
    }

    /// <summary>Владелец текущего запроса — его кладёт middleware в Program.cs.</summary>
    public static Caller Caller(HttpContext ctx) => ctx.Items["caller"] as Caller ?? Auth.Caller.Shared;
}
