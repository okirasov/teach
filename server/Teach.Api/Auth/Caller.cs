namespace Teach.Api.Auth;

/// <summary>
/// Кто пришёл с запросом. Владелец (<see cref="Owner"/>) — ключ, по которому фильтруются предметы:
/// у пользователя это `apple:&lt;sub&gt;`, у тестировщика `tester:&lt;имя&gt;`, у сборок со старым общим
/// токеном — <see cref="SharedOwner"/>.
/// </summary>
public sealed record Caller(string Owner, string Kind, string? Name = null)
{
    /// <summary>Общий токен из настроек: им ходят сборки до появления входа по Apple.</summary>
    public const string SharedOwner = "shared";

    public static Caller Shared { get; } = new(SharedOwner, "shared");

    public bool IsAdmin => Kind == "shared";
}
