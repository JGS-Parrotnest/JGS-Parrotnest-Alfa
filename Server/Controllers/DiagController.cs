using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using ParrotnestServer.Data;
using System.Reflection;

namespace ParrotnestServer.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class DiagController : ControllerBase
    {
        private readonly IConfiguration _configuration;
        private readonly EndpointDataSource _endpoints;
        private readonly ApplicationDbContext _db;

        public DiagController(IConfiguration configuration, EndpointDataSource endpoints, ApplicationDbContext db)
        {
            _configuration = configuration;
            _endpoints = endpoints;
            _db = db;
        }

        [HttpGet("build")]
        [AllowAnonymous]
        public IActionResult GetBuild()
        {
            var asm = typeof(DiagController).Assembly;
            var location = asm.Location;
            if (string.IsNullOrWhiteSpace(location))
            {
                location = AppContext.BaseDirectory;
            }
            DateTime? lastWriteUtc = null;
            try
            {
                if (!string.IsNullOrWhiteSpace(location) && System.IO.File.Exists(location))
                {
                    lastWriteUtc = System.IO.File.GetLastWriteTimeUtc(location);
                }
            }
            catch
            {
            }

            var verboseEnv = Environment.GetEnvironmentVariable("PARROTNEST_VERBOSE");
            var isVerbose = verboseEnv == "1" || string.Equals(verboseEnv, "true", StringComparison.OrdinalIgnoreCase);

            var dbPath = _configuration["DbPath"] ?? string.Empty;
            var dbPreferredPath = _configuration["DbPreferredPath"] ?? string.Empty;
            var dbBaseDirPath = _configuration["DbBaseDirPath"] ?? string.Empty;
            long? dbSizeBytes = null;
            DateTime? dbLastWriteUtc = null;
            try
            {
                if (!string.IsNullOrWhiteSpace(dbPath) && System.IO.File.Exists(dbPath))
                {
                    var info = new System.IO.FileInfo(dbPath);
                    dbSizeBytes = info.Length;
                    dbLastWriteUtc = info.LastWriteTimeUtc;
                }
            }
            catch
            {
            }

            return Ok(new
            {
                BaseDirectory = AppDomain.CurrentDomain.BaseDirectory,
                Assembly = asm.GetName().Name,
                Version = asm.GetName().Version?.ToString(),
                InformationalVersion = asm.GetCustomAttribute<AssemblyInformationalVersionAttribute>()?.InformationalVersion,
                AssemblyPath = location,
                AssemblyLastWriteUtc = lastWriteUtc,
                DbPath = dbPath,
                DbExists = !string.IsNullOrWhiteSpace(dbPath) && System.IO.File.Exists(dbPath),
                DbSizeBytes = dbSizeBytes,
                DbLastWriteUtc = dbLastWriteUtc,
                DbPreferredPath = dbPreferredPath,
                DbPreferredExists = !string.IsNullOrWhiteSpace(dbPreferredPath) && System.IO.File.Exists(dbPreferredPath),
                DbBaseDirPath = dbBaseDirPath,
                DbBaseDirExists = !string.IsNullOrWhiteSpace(dbBaseDirPath) && System.IO.File.Exists(dbBaseDirPath),
                Verbose = isVerbose,
                NowUtc = DateTime.UtcNow
            });
        }

        [HttpGet("routes")]
        [Authorize]
        public IActionResult GetRoutes()
        {
            if (!IsAdmin())
            {
                return Forbid();
            }

            var list = _endpoints.Endpoints
                .OfType<RouteEndpoint>()
                .Select(e => new
                {
                    route = e.RoutePattern.RawText ?? string.Empty,
                    methods = e.Metadata.GetMetadata<Microsoft.AspNetCore.Routing.HttpMethodMetadata>()?.HttpMethods ?? Array.Empty<string>(),
                    displayName = e.DisplayName ?? string.Empty
                })
                .OrderBy(x => x.route)
                .ThenBy(x => string.Join(",", x.methods))
                .ToList();

            return Ok(list);
        }

        [HttpGet("dbstats")]
        [Authorize]
        public async Task<IActionResult> GetDbStats()
        {
            if (!IsAdmin())
            {
                return Forbid();
            }

            var result = new
            {
                users = await _db.Users.AsNoTracking().CountAsync(),
                messages = await _db.Messages.AsNoTracking().CountAsync(),
                friendships = await _db.Friendships.AsNoTracking().CountAsync(),
                groups = await _db.Groups.AsNoTracking().CountAsync(),
                groupMembers = await _db.GroupMembers.AsNoTracking().CountAsync(),
                productionContents = await _db.ProductionContents.AsNoTracking().CountAsync()
            };

            return Ok(result);
        }

        private bool IsAdmin()
        {
            var claim = User.FindFirst("isAdmin")?.Value;
            if (claim == "1") return true;
            var role = User.FindFirst("role")?.Value;
            if (string.Equals(role, "admin", StringComparison.OrdinalIgnoreCase)) return true;
            return false;
        }
    }
}
