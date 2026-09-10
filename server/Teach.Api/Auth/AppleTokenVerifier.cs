using System.Text.Json;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;

namespace Teach.Api.Auth;

/// <summary>
/// Проверяет identityToken от Sign in with Apple: подпись по публичным ключам Apple,
/// издателя, аудиторию (bundle id приложения) и срок. Возвращает `sub` — стабильный id
/// пользователя у Apple. Ключи кэшируются: Apple их меняет редко, а запрос к ним не бесплатный.
/// </summary>
public interface IAppleTokenVerifier
{
    Task<AppleIdentity?> VerifyAsync(string identityToken, CancellationToken ct);
}

public sealed record AppleIdentity(string Sub, string? Email);

public sealed class AppleTokenVerifierOptions
{
    /// <summary>Bundle id приложения — значение aud в токене. Пусто — аудитория не проверяется (только для отладки).</summary>
    public string[] Audiences { get; set; } = [];
    public string Issuer { get; set; } = "https://appleid.apple.com";
    public string KeysUrl { get; set; } = "https://appleid.apple.com/auth/keys";
    public TimeSpan KeyCacheTtl { get; set; } = TimeSpan.FromHours(12);
}

public sealed class AppleTokenVerifier(HttpClient http, AppleTokenVerifierOptions opts, ILogger<AppleTokenVerifier> log, TimeProvider clock) : IAppleTokenVerifier
{
    private readonly SemaphoreSlim _lock = new(1, 1);
    private JsonWebKeySet? _keys;
    private DateTimeOffset _fetchedAt;

    public async Task<AppleIdentity?> VerifyAsync(string identityToken, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(identityToken)) return null;
        var keys = await KeysAsync(ct);
        if (keys is null) return null;

        var parameters = new TokenValidationParameters
        {
            ValidIssuer = opts.Issuer,
            ValidateIssuer = true,
            ValidAudiences = opts.Audiences,
            ValidateAudience = opts.Audiences.Length > 0,
            IssuerSigningKeys = keys.GetSigningKeys(),
            ValidateIssuerSigningKey = true,
            ValidateLifetime = true,
            ClockSkew = TimeSpan.FromMinutes(2),
        };
        var handler = new JsonWebTokenHandler();
        var result = await handler.ValidateTokenAsync(identityToken, parameters);
        if (!result.IsValid)
        {
            log.LogWarning(result.Exception, "apple identity token rejected");
            return null;
        }
        var sub = result.ClaimsIdentity.FindFirst("sub")?.Value;
        if (string.IsNullOrWhiteSpace(sub)) return null;
        return new AppleIdentity(sub, result.ClaimsIdentity.FindFirst("email")?.Value);
    }

    private async Task<JsonWebKeySet?> KeysAsync(CancellationToken ct)
    {
        if (_keys is not null && clock.GetUtcNow() - _fetchedAt < opts.KeyCacheTtl) return _keys;
        await _lock.WaitAsync(ct);
        try
        {
            if (_keys is not null && clock.GetUtcNow() - _fetchedAt < opts.KeyCacheTtl) return _keys;
            var json = await http.GetStringAsync(opts.KeysUrl, ct);
            // Проверяем, что это действительно набор ключей, а не страница ошибки.
            using (var doc = JsonDocument.Parse(json))
                if (!doc.RootElement.TryGetProperty("keys", out _)) return _keys;
            _keys = new JsonWebKeySet(json);
            _fetchedAt = clock.GetUtcNow();
            return _keys;
        }
        catch (Exception e)
        {
            log.LogError(e, "apple keys fetch failed");
            return _keys; // просроченный кэш лучше отказа всем
        }
        finally
        {
            _lock.Release();
        }
    }
}
