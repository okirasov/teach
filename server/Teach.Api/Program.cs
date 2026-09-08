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
    DurationMinutes = cfg.GetValue("DurationMinutes", 5),
});
builder.Services.AddSingleton<LessonQueue>();
builder.Services.AddSingleton<SourcesJobs>();
builder.Services.AddHostedService<LessonWorker>();
builder.Services.ConfigureHttpJsonOptions(o => o.SerializerOptions.DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull);
// CORS нужен только web-превью клиента; нативные приложения его не используют.
builder.Services.AddCors(o => o.AddDefaultPolicy(p => p.AllowAnyOrigin().AllowAnyHeader().AllowAnyMethod()));

var app = builder.Build();

using (var scope = app.Services.CreateScope())
    scope.ServiceProvider.GetRequiredService<TeachDb>().Database.EnsureCreated();

app.UseCors();
app.MapContent();
app.Logger.LogInformation("Teach.Api: model={Model}, prompts={Prompts}", app.Services.GetRequiredService<ILessonModel>().Name, Prompts.Version);
app.Run();

public partial class Program;
