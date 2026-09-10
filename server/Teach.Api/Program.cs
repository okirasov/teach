using Scalar.AspNetCore;
using Teach.Api.Auth;
using Anthropic;
using Microsoft.EntityFrameworkCore;
using Teach.Api.Data;
using Teach.Api.Endpoints;
using Teach.Api.Jobs;
using Teach.Api.Model;

var builder = WebApplication.CreateBuilder(args);

var cfg = builder.Configuration.GetSection("Teach");
builder.Services.AddDbContext<TeachDb>(o => o.UseSqlite(cfg["Db"] ?? "Data Source=teach.db"));

// Провайдер модели: auto → Claude при наличии ANTHROPIC_API_KEY, иначе заглушка прототипа.
var provider = cfg["Model"] ?? "auto";
var hasKey = !string.IsNullOrEmpty(Environment.GetEnvironmentVariable("ANTHROPIC_API_KEY"));
if (provider == "claude" || (provider == "auto" && hasKey))
{
    builder.Services.AddSingleton(new AnthropicClient());
    builder.Services.AddSingleton<ILessonModel, ClaudeLessonModel>();
}
else
{
    builder.Services.AddSingleton<ILessonModel, StubLessonModel>();
}

builder.Services.AddSingleton(new WorkerOptions
{
    StageDelayMs = cfg.GetValue("StageDelayMs", 1500),
    MaxAttempts = cfg.GetValue("MaxAttempts", 3),
    DurationMinutes = cfg.GetValue("DurationMinutes", 10),
});
builder.Services.AddSingleton(TimeProvider.System);
builder.Services.AddSingleton<TokenStore>();
builder.Services.AddHttpClient<IAppleTokenVerifier, AppleTokenVerifier>();
builder.Services.AddSingleton(new AppleTokenVerifierOptions { Audiences = (cfg["AppleAudience"] ?? "").Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries) });
builder.Services.AddSingleton<LessonQueue>();
builder.Services.AddSingleton<SourcesJobs>();
builder.Services.AddSingleton<LessonWorker>();
builder.Services.AddHostedService(sp => sp.GetRequiredService<LessonWorker>());
// Плавная остановка: см. DrainingLifetime (SIGINT/SIGTERM → доработать урок при живом сервере → стоп).
builder.Services.AddSingleton<IHostLifetime, DrainingLifetime>();
builder.Services.ConfigureHttpJsonOptions(o => o.SerializerOptions.DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull);
// CORS нужен только web-превью клиента; нативные приложения его не используют.
builder.Services.AddCors(o => o.AddDefaultPolicy(p => p.AllowAnyOrigin().AllowAnyHeader().AllowAnyMethod()));
// OpenAPI-описание (/openapi/v1.json) и интерактивная справка Scalar (/scalar) — для тестировщиков и интеграций.
builder.Services.AddOpenApi(o => o.AddDocumentTransformer((doc, _, _) =>
{
    doc.Info.Title = "Teach API";
    doc.Info.Version = "v1";
    doc.Info.Description = "Сервер-оркестратор мобильного репетитора Teach: мастер предмета, уроки, разбор, предзагрузка, оценка свободных ответов. Все маршруты, кроме /health и документации, требуют заголовок `Authorization: Bearer <token>`.";
    doc.Components ??= new Microsoft.OpenApi.OpenApiComponents();
    doc.Components.SecuritySchemes ??= new Dictionary<string, Microsoft.OpenApi.IOpenApiSecurityScheme>();
    doc.Components.SecuritySchemes["bearer"] = new Microsoft.OpenApi.OpenApiSecurityScheme { Type = Microsoft.OpenApi.SecuritySchemeType.Http, Scheme = "bearer", Description = "Общий токен сервера (Teach:ApiToken)" };
    doc.Security ??= [];
    doc.Security.Add(new Microsoft.OpenApi.OpenApiSecurityRequirement { [new Microsoft.OpenApi.OpenApiSecuritySchemeReference("bearer", doc)] = [] });
    return Task.CompletedTask;
}));

var app = builder.Build();


using (var scope = app.Services.CreateScope())
    await SchemaUpgrader.UpgradeAsync(scope.ServiceProvider.GetRequiredService<TeachDb>(), app.Logger);

app.UseCors();
// Документация публична: /docs (техническая документация и FRD), /openapi, /scalar. Секретов там нет.
app.UseDefaultFiles();
app.UseStaticFiles();
app.MapGet("/", () => Results.Redirect("/docs/")).ExcludeFromDescription();

// Общий bearer-токен (Teach:ApiToken). Пустой — открытый режим только для локальной разработки.
var apiToken = cfg["ApiToken"];
static bool IsPublic(PathString path) =>
    path == "/health" || path == "/" || path.StartsWithSegments("/docs") || path.StartsWithSegments("/openapi") || path.StartsWithSegments("/scalar")
    // Вход по Apple — сам источник токена, своего ещё нет.
    || path.StartsWithSegments("/auth");
if (!string.IsNullOrEmpty(apiToken))
{
    app.Use(async (ctx, next) =>
    {
        if (IsPublic(ctx.Request.Path) || HttpMethods.IsOptions(ctx.Request.Method)) { await next(); return; }
        var header = ctx.Request.Headers.Authorization.ToString();
        var presented = header.StartsWith("Bearer ", StringComparison.Ordinal) ? header[7..].Trim() : "";
        if (presented.Length > 0)
        {
            // Общий токен — старые сборки и админ; иначе выданный токен пользователя или тестировщика.
            if (presented == apiToken) { ctx.Items["caller"] = Caller.Shared; await next(); return; }
            var caller = await ctx.RequestServices.GetRequiredService<TokenStore>().ResolveAsync(presented, ctx.RequestAborted);
            if (caller is not null) { ctx.Items["caller"] = caller; await next(); return; }
        }
        ctx.Response.StatusCode = StatusCodes.Status401Unauthorized;
        await ctx.Response.WriteAsJsonAsync(new { error = "unauthorized" });
    });
}
else
{
    app.Logger.LogWarning("Teach:ApiToken is not set — the API is open; fine locally, never in the cloud");
}

app.MapContent();
app.MapAuth();
app.MapOpenApi();
app.MapScalarApiReference(o => o.WithTitle("Teach API").WithTheme(ScalarTheme.Kepler).WithDefaultHttpClient(ScalarTarget.Shell, ScalarClient.Curl));
app.Logger.LogInformation("Teach.Api: model={Model}, prompts={Prompts}", app.Services.GetRequiredService<ILessonModel>().Name, Prompts.Version);
app.Run();

public partial class Program;
