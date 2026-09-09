using System.Runtime.InteropServices;

namespace Teach.Api.Jobs;

/// <summary>
/// Плавная остановка вместо ConsoleLifetime. Стандартный lifetime по SIGINT/SIGTERM сразу останавливает
/// хост, а веб-сервер гасится первым — клиент получал бы «connection refused» всё время, пока воркер
/// дорабатывает урок. Здесь сигнал сначала переводит воркер в дожидание (сервер продолжает отвечать на
/// опросы), и только после конца текущего урока (или Teach:ShutdownSeconds) хост останавливается.
/// Fly ждёт до kill_timeout из fly.toml.
/// </summary>
public sealed class DrainingLifetime(LessonWorker worker, IHostApplicationLifetime lifetime, IConfiguration config, ILogger<DrainingLifetime> log) : IHostLifetime, IDisposable
{
    private readonly List<PosixSignalRegistration> _registrations = [];
    private int _stopping;

    public Task WaitForStartAsync(CancellationToken ct)
    {
        foreach (var signal in new[] { PosixSignal.SIGINT, PosixSignal.SIGTERM, PosixSignal.SIGQUIT })
        {
            try { _registrations.Add(PosixSignalRegistration.Create(signal, OnSignal)); }
            catch (PlatformNotSupportedException) { }
        }
        lifetime.ApplicationStarted.Register(() => log.LogInformation("started; SIGINT/SIGTERM drain the worker before stopping"));
        return Task.CompletedTask;
    }

    private void OnSignal(PosixSignalContext ctx)
    {
        ctx.Cancel = true;
        if (Interlocked.Exchange(ref _stopping, 1) == 1) return;
        var seconds = config.GetValue("Teach:ShutdownSeconds", 150);
        _ = Task.Run(async () =>
        {
            log.LogInformation("signal {Signal}: draining the worker, server keeps serving (up to {Seconds}s)", ctx.Signal, seconds);
            try { await worker.DrainAsync().WaitAsync(TimeSpan.FromSeconds(seconds)); }
            catch (Exception e) { log.LogWarning(e, "drain did not finish in time"); }
            lifetime.StopApplication();
        });
    }

    public Task StopAsync(CancellationToken ct) => Task.CompletedTask;

    public void Dispose()
    {
        foreach (var r in _registrations) r.Dispose();
    }
}
