using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.StaticFiles;
using System.Security.Claims;
using System.Text.Json;

namespace ParrotnestServer.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class FilesController : ControllerBase
    {
        private readonly IWebHostEnvironment _env;
        private readonly IConfiguration _cfg;

        public FilesController(IWebHostEnvironment env, IConfiguration cfg)
        {
            _env = env;
            _cfg = cfg;
        }

        private string GetClientPath()
        {
            var client = _cfg["ClientPath"];
            if (!string.IsNullOrWhiteSpace(client)) return client!;
            return Path.Combine(_env.ContentRootPath, "..", "Client");
        }

        public class InitiateDto
        {
            public string FileName { get; set; } = string.Empty;
            public long Size { get; set; }
            public string? MimeType { get; set; }
            public string? RelativePath { get; set; }
        }

        public class InitiateResponse
        {
            public string UploadId { get; set; } = string.Empty;
            public int ChunkSize { get; set; }
        }

        [HttpPost("initiate")]
        public IActionResult Initiate([FromBody] InitiateDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.FileName) || dto.Size <= 0)
                return BadRequest("Nieprawidłowe metadane pliku.");
            const long MAX_SIZE = 100L * 1024L * 1024L;
            if (dto.Size > MAX_SIZE) return BadRequest("Plik przekracza limit 100MB.");

            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userIdClaim) || !int.TryParse(userIdClaim, out var userId))
                return Unauthorized();

            var clientPath = GetClientPath();
            var tempDir = Path.Combine(clientPath, "uploads", "temp");
            Directory.CreateDirectory(tempDir);

            var uploadId = Guid.NewGuid().ToString("N");
            var metaPath = Path.Combine(tempDir, $"{uploadId}.meta.json");
            var dataPath = Path.Combine(tempDir, $"{uploadId}.bin");

            var safeName = Path.GetFileName(dto.FileName);
            var safeRel = string.IsNullOrWhiteSpace(dto.RelativePath) ? "" : dto.RelativePath.Replace('\\', '/');
            safeRel = safeRel.Trim('/');
            if (safeRel.Contains("..")) safeRel = "";

            var meta = new
            {
                FileName = safeName,
                Size = dto.Size,
                MimeType = dto.MimeType,
                RelativePath = safeRel,
                UserId = userId,
                CreatedAt = DateTime.UtcNow
            };
            System.IO.File.WriteAllText(metaPath, JsonSerializer.Serialize(meta));
            using (var fs = new FileStream(dataPath, FileMode.Create, FileAccess.Write, FileShare.None))
            {
            }

            AppendTransferLog($"initiate upload_id={uploadId} user={userId} name=\"{safeName}\" size={dto.Size} rel=\"{safeRel}\"");
            return Ok(new InitiateResponse { UploadId = uploadId, ChunkSize = 2 * 1024 * 1024 });
        }

        [HttpPut("chunk/{uploadId}")]
        public async Task<IActionResult> UploadChunk(string uploadId, [FromQuery] long offset)
        {
            var clientPath = GetClientPath();
            var tempDir = Path.Combine(clientPath, "uploads", "temp");
            var metaPath = Path.Combine(tempDir, $"{uploadId}.meta.json");
            var dataPath = Path.Combine(tempDir, $"{uploadId}.bin");
            if (!System.IO.File.Exists(metaPath) || !System.IO.File.Exists(dataPath))
                return NotFound("Nie znaleziono przesyłki.");

            using var bodyStream = new MemoryStream();
            await Request.Body.CopyToAsync(bodyStream);
            var chunk = bodyStream.ToArray();

            using (var fs = new FileStream(dataPath, FileMode.Open, FileAccess.ReadWrite, FileShare.None))
            {
                if (offset < 0 || offset > fs.Length) return BadRequest("Nieprawidłowy offset.");
                fs.Seek(offset, SeekOrigin.Begin);
                await fs.WriteAsync(chunk, 0, chunk.Length);
            }

            AppendTransferLog($"chunk upload_id={uploadId} offset={offset} len={chunk.Length}");
            return Ok(new { nextOffset = offset + chunk.Length });
        }

        [HttpPost("complete/{uploadId}")]
        public IActionResult Complete(string uploadId)
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userIdClaim) || !int.TryParse(userIdClaim, out var userId))
                return Unauthorized();

            var clientPath = GetClientPath();
            var tempDir = Path.Combine(clientPath, "uploads", "temp");
            var metaPath = Path.Combine(tempDir, $"{uploadId}.meta.json");
            var dataPath = Path.Combine(tempDir, $"{uploadId}.bin");
            if (!System.IO.File.Exists(metaPath) || !System.IO.File.Exists(dataPath))
                return NotFound("Nie znaleziono przesyłki.");

            var metaJson = System.IO.File.ReadAllText(metaPath);
            var meta = JsonSerializer.Deserialize<MetaModel>(metaJson) ?? new MetaModel();

            var dateDir = DateTime.UtcNow.ToString("yyyy/MM/dd");
            var baseDir = Path.Combine(clientPath, "uploads", "files", userId.ToString(), dateDir);
            if (!string.IsNullOrWhiteSpace(meta.RelativePath))
            {
                baseDir = Path.Combine(baseDir, meta.RelativePath.Replace('/', Path.DirectorySeparatorChar));
            }
            Directory.CreateDirectory(baseDir);

            var finalPath = Path.Combine(baseDir, meta.FileName);
            if (System.IO.File.Exists(finalPath))
            {
                var name = Path.GetFileNameWithoutExtension(meta.FileName);
                var ext = Path.GetExtension(meta.FileName);
                finalPath = Path.Combine(baseDir, $"{name}_{DateTime.UtcNow:HHmmss}{ext}");
            }
            System.IO.File.Move(dataPath, finalPath);
            try { System.IO.File.Delete(metaPath); } catch { }

            var relativeUrl = finalPath.Replace(GetClientPath(), "").Replace("\\", "/");
            if (!relativeUrl.StartsWith("/")) relativeUrl = "/" + relativeUrl;

            AppendTransferLog($"complete upload_id={uploadId} user={userId} path=\"{relativeUrl}\"");
            return Ok(new { url = relativeUrl, name = meta.FileName, mime = meta.MimeType });
        }

        public class MetaModel
        {
            public string FileName { get; set; } = string.Empty;
            public long Size { get; set; }
            public string? MimeType { get; set; }
            public string? RelativePath { get; set; }
            public int UserId { get; set; }
            public DateTime CreatedAt { get; set; }
        }

        [HttpGet("download")]
        public IActionResult Download([FromQuery] string path)
        {
            if (string.IsNullOrWhiteSpace(path)) return BadRequest("Brak ścieżki.");
            path = path.Replace('\\', '/');
            if (path.Contains("..")) return BadRequest("Nieprawidłowa ścieżka.");

            var clientPath = GetClientPath();
            var full = Path.Combine(clientPath, path.TrimStart('/').Replace('/', Path.DirectorySeparatorChar));
            if (!System.IO.File.Exists(full)) return NotFound();

            var provider = new FileExtensionContentTypeProvider();
            if (!provider.TryGetContentType(full, out var contentType)) contentType = "application/octet-stream";
            var fileName = Path.GetFileName(full);
            AppendTransferLog($"download user={User.FindFirst(ClaimTypes.NameIdentifier)?.Value} path=\"{path}\"");
            var stream = new FileStream(full, FileMode.Open, FileAccess.Read, FileShare.Read);
            return File(stream, contentType, fileName);
        }

        private void AppendTransferLog(string line)
        {
            try
            {
                var logsDir = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "logs");
                Directory.CreateDirectory(logsDir);
                var path = Path.Combine(logsDir, "transfer.log");
                System.IO.File.AppendAllText(path, $"[{DateTime.Now:yyyy-MM-dd HH:mm:ss}] {line}{Environment.NewLine}");
            }
            catch { }
        }
    }
}
