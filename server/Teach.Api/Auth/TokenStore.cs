using System.Security.Cryptography;
using System.Text;
using Microsoft.EntityFrameworkCore;
using Teach.Api.Data;

namespace Teach.Api.Auth;

/// <summary>
/// Выданные токены доступа: выпуск, проверка и отзыв. Сам токен показывается один раз при выпуске,
/// в базе лежит только его SHA-256.
/// </summary>
public sealed class TokenStore(IServiceScopeFactory scopes, TimeProvider clock)
{
    public static string Hash(string token) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(token))).ToLowerInvariant();

    private static string NewSecret() => Convert.ToHexString(RandomNumberGenerator.GetBytes(24)).ToLowerInvariant();

    /// <summary>Выдаёт токен владельцу. Для пользователя Apple переиспользует владельца, но всегда делает новый токен.</summary>
    public async Task<string> IssueAsync(string ownerId, string kind, string? name, CancellationToken ct)
    {
        using var scope = scopes.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<TeachDb>();
        var secret = NewSecret();
        db.ApiTokens.Add(new ApiTokenRow
        {
            Id = Guid.NewGuid(), Hash = Hash(secret), OwnerId = ownerId, Kind = kind, Name = name, CreatedAt = clock.GetUtcNow(),
        });
        await db.SaveChangesAsync(ct);
        return secret;
    }

    /// <summary>Владелец токена или null, если токен неизвестен или отозван.</summary>
    public async Task<Caller?> ResolveAsync(string token, CancellationToken ct)
    {
        using var scope = scopes.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<TeachDb>();
        var hash = Hash(token);
        var row = await db.ApiTokens.FirstOrDefaultAsync(x => x.Hash == hash, ct);
        if (row is null || row.RevokedAt is not null) return null;
        // Отметка последнего использования: по ней видно, какие токены тестировщиков ещё живы.
        var now = clock.GetUtcNow();
        if (row.LastUsedAt is null || now - row.LastUsedAt > TimeSpan.FromMinutes(5))
        {
            row.LastUsedAt = now;
            await db.SaveChangesAsync(ct);
        }
        return new Caller(row.OwnerId, row.Kind, row.Name);
    }

    public async Task<bool> RevokeAsync(Guid id, CancellationToken ct)
    {
        using var scope = scopes.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<TeachDb>();
        var row = await db.ApiTokens.FindAsync([id], ct);
        if (row is null || row.RevokedAt is not null) return false;
        row.RevokedAt = clock.GetUtcNow();
        await db.SaveChangesAsync(ct);
        return true;
    }

    public async Task<IReadOnlyList<ApiTokenRow>> ListAsync(CancellationToken ct)
    {
        using var scope = scopes.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<TeachDb>();
        return await db.ApiTokens.OrderByDescending(x => x.CreatedAt).ToListAsync(ct);
    }
}
