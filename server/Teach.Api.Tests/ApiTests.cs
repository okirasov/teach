using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc.Testing;
using Teach.Api.Contracts;
using Teach.Api.Domain;

namespace Teach.Api.Tests;

public sealed class ApiFactory : WebApplicationFactory<Program>
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
        Assert.Equal("Урок 2 · Каркас темы", second.Lesson!.LessonTitle);
        Assert.Contains("Карта того, что уже есть", ((ExplainStep)second.Lesson.Steps[0]).Paras[0]);
        Assert.Empty(LessonValidator.Validate(second.Lesson));
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
