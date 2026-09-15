using System.Diagnostics;
using SisTemplate.Platform.Documents.Application;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace SisTemplate.Platform.Documents.Infrastructure;

/// <summary>
/// Converts .docx to PDF out-of-process. Prefers LibreOffice headless (cross-platform, the
/// production path); on Windows falls back to Microsoft Word driven by a short-lived PowerShell
/// worker. Conversions are serialized and time-boxed so a stuck engine cannot wedge the API.
/// </summary>
public sealed partial class OfficeDocumentPdfConverter : IDocumentPdfConverter
{
    private static readonly SemaphoreSlim Gate = new(1, 1);
    private readonly DocumentConversionOptions _options;
    private readonly ILogger<OfficeDocumentPdfConverter> _logger;
    private readonly string? _soffice;
    private readonly bool _word;

    public OfficeDocumentPdfConverter(IOptions<DocumentConversionOptions> options, ILogger<OfficeDocumentPdfConverter> logger)
    {
        _options = options.Value;
        _logger = logger;
        var engine = (_options.Engine ?? "auto").Trim().ToLowerInvariant();
        if (engine != "none")
        {
            if (engine is "auto" or "libreoffice")
            {
                _soffice = ResolveSoffice(_options.SofficePath);
            }

            if (_soffice is null && engine is "auto" or "word")
            {
                _word = OperatingSystem.IsWindows();
            }
        }
    }

    public bool IsAvailable => _soffice is not null || _word;

    public string Engine => _soffice is not null ? "libreoffice" : _word ? "word" : "none";

    public async Task<byte[]?> ConvertDocxToPdfAsync(byte[] docx, CancellationToken cancellationToken)
    {
        if (!IsAvailable || docx is null || docx.Length == 0)
        {
            return null;
        }

        var work = Path.Combine(Path.GetTempPath(), "ip-docx2pdf", Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(work);
        var inPath = Path.Combine(work, "input.docx");
        var outPath = Path.Combine(work, "input.pdf");
        await File.WriteAllBytesAsync(inPath, docx, cancellationToken);

        await Gate.WaitAsync(cancellationToken);
        try
        {
            using var cts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
            cts.CancelAfter(TimeSpan.FromSeconds(Math.Clamp(_options.TimeoutSeconds, 10, 600)));

            if (_soffice is not null)
            {
                await RunAsync(_soffice, new[]
                {
                    "--headless", "--norestore", "--nolockcheck",
                    $"-env:UserInstallation=file:///{work.Replace('\\', '/')}/lo",
                    "--convert-to", "pdf", "--outdir", work, inPath,
                }, cts.Token);
            }
            else
            {
                var script = Path.Combine(work, "convert.ps1");
                await File.WriteAllTextAsync(script, WordConvertScript, cts.Token);
                await RunAsync("powershell", new[]
                {
                    "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass",
                    "-File", script, "-In", inPath, "-Out", outPath,
                }, cts.Token);
            }

            if (File.Exists(outPath))
            {
                return await File.ReadAllBytesAsync(outPath, cancellationToken);
            }

            LogNoOutput(Engine);
            return null;
        }
        catch (Exception ex)
        {
            LogFailed(ex, Engine);
            return null;
        }
        finally
        {
            Gate.Release();
            TryDelete(work);
        }
    }

    private static async Task RunAsync(string fileName, IEnumerable<string> args, CancellationToken cancellationToken)
    {
        var psi = new ProcessStartInfo
        {
            FileName = fileName,
            UseShellExecute = false,
            CreateNoWindow = true,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
        };
        foreach (var a in args)
        {
            psi.ArgumentList.Add(a);
        }

        using var proc = new Process { StartInfo = psi };
        proc.Start();
        // Drain pipes so the child never blocks on a full buffer.
        var stdout = proc.StandardOutput.ReadToEndAsync(cancellationToken);
        var stderr = proc.StandardError.ReadToEndAsync(cancellationToken);
        try
        {
            await proc.WaitForExitAsync(cancellationToken);
            await Task.WhenAll(stdout, stderr);
        }
        catch (OperationCanceledException)
        {
            try
            {
                if (!proc.HasExited)
                {
                    proc.Kill(entireProcessTree: true);
                }
            }
            catch
            {
                // best effort
            }

            throw;
        }
    }

    private static string? ResolveSoffice(string? configured)
    {
        var candidates = new List<string?>
        {
            configured,
            @"C:\Program Files\LibreOffice\program\soffice.exe",
            @"C:\Program Files (x86)\LibreOffice\program\soffice.exe",
            "/usr/bin/soffice",
            "/usr/bin/libreoffice",
            "/opt/libreoffice/program/soffice",
            "/snap/bin/libreoffice",
        };

        foreach (var path in candidates)
        {
            if (!string.IsNullOrWhiteSpace(path) && File.Exists(path))
            {
                return path;
            }
        }

        // PATH probe.
        var pathEnv = Environment.GetEnvironmentVariable("PATH") ?? string.Empty;
        var exeNames = OperatingSystem.IsWindows() ? new[] { "soffice.exe" } : new[] { "soffice", "libreoffice" };
        foreach (var dir in pathEnv.Split(Path.PathSeparator, StringSplitOptions.RemoveEmptyEntries))
        {
            foreach (var exe in exeNames)
            {
                try
                {
                    var full = Path.Combine(dir.Trim(), exe);
                    if (File.Exists(full))
                    {
                        return full;
                    }
                }
                catch
                {
                    // ignore malformed PATH entries
                }
            }
        }

        return null;
    }

    private static void TryDelete(string dir)
    {
        try
        {
            if (Directory.Exists(dir))
            {
                Directory.Delete(dir, recursive: true);
            }
        }
        catch
        {
            // temp cleanup is best effort
        }
    }

    [LoggerMessage(Level = LogLevel.Warning, Message = "docx->pdf produced no output via {engine}.")]
    private partial void LogNoOutput(string engine);

    [LoggerMessage(Level = LogLevel.Warning, Message = "docx->pdf conversion failed via {engine}.")]
    private partial void LogFailed(Exception exception, string engine);

    // wdFormatPDF = 17. Word is opened read-only and never prompts.
    private const string WordConvertScript = """
param([string]$In, [string]$Out)
$ErrorActionPreference = 'Stop'
$word = New-Object -ComObject Word.Application
$word.Visible = $false
try { $word.DisplayAlerts = 0 } catch {}
try {
    $doc = $word.Documents.Open($In, $false, $true)
    $doc.SaveAs2($Out, 17)
    $doc.Close($false)
} finally {
    $word.Quit()
    [System.Runtime.InteropServices.Marshal]::ReleaseComObject($word) | Out-Null
}
""";
}
