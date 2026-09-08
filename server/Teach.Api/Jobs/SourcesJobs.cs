using System.Collections.Concurrent;
using Teach.Api.Contracts;
using Teach.Api.Model;

namespace Teach.Api.Jobs;

/// <summary>Фоновый поиск источников: клиент создаёт задачу и опрашивает её, не держа долгий HTTP-запрос.</summary>
public sealed class SourcesJobs(ILessonModel model, IHostApplicationLifetime lifetime, ILogger<SourcesJobs> log)
{
    private sealed class Job
    {
        public string Status = "running";
        public IReadOnlyList<SourceCandidate>? Items;
        public string? Error;
        public DateTimeOffset CreatedAt = DateTimeOffset.UtcNow;
    }

    private readonly ConcurrentDictionary<string, Job> _jobs = new();

    public string Start(string topic, string focus)
    {
        var id = Guid.NewGuid().ToString("N");
        var job = new Job();
        _jobs[id] = job;
        _ = Task.Run(async () =>
        {
            try
            {
                job.Items = await model.FindSourcesAsync(topic, focus, lifetime.ApplicationStopping);
                job.Status = "ready";
            }
            catch (Exception e)
            {
                log.LogError(e, "sources job {Job} failed", id);
                job.Error = e.Message;
                job.Status = "failed";
            }
            Sweep();
        });
        return id;
    }

    public SourcesJobStatus? Get(string id) =>
        _jobs.TryGetValue(id, out var j) ? new SourcesJobStatus(j.Status, j.Items, j.Error) : null;

    /// <summary>Задачи старше часа выбрасываем — результат уже забрали или клиент ушёл.</summary>
    private void Sweep()
    {
        var cutoff = DateTimeOffset.UtcNow.AddHours(-1);
        foreach (var (k, v) in _jobs)
            if (v.CreatedAt < cutoff) _jobs.TryRemove(k, out _);
    }
}
