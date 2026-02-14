using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using ParrotnestServer.Data;
using ParrotnestServer.Hubs;

namespace ParrotnestServer.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class ProductionController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly IHubContext<ChatHub> _hubContext;
        private readonly ILogger<ProductionController> _logger;

        public ProductionController(ApplicationDbContext context, IHubContext<ChatHub> hubContext, ILogger<ProductionController> logger)
        {
            _context = context;
            _hubContext = hubContext;
            _logger = logger;
        }

        [HttpGet("current")]
        public async Task<IActionResult> GetCurrent()
        {
            var latest = await _context.ProductionContents
                .AsNoTracking()
                .OrderByDescending(p => p.UpdatedAt)
                .FirstOrDefaultAsync();

            return Ok(new
            {
                content = latest?.Content ?? string.Empty,
                updatedAt = latest?.UpdatedAt
            });
        }

        [HttpPost("current")]
        public async Task<IActionResult> SetCurrent([FromBody] SetProductionContentDto dto)
        {
            if (!IsAdmin())
            {
                return Forbid();
            }

            var content = (dto?.Content ?? string.Empty).Trim();
            if (string.IsNullOrWhiteSpace(content))
            {
                return BadRequest("Treść nie może być pusta.");
            }

            var entity = new ParrotnestServer.Models.ProductionContent
            {
                Content = content,
                UpdatedAt = DateTime.UtcNow
            };

            _context.ProductionContents.Add(entity);
            await _context.SaveChangesAsync();

            var payload = new
            {
                content = entity.Content,
                updatedAt = entity.UpdatedAt
            };

            await _hubContext.Clients.All.SendAsync("ProductionContentUpdated", payload);
            _logger.LogWarning("Production content updated by admin. Length={Length}", content.Length);

            return Ok(payload);
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

    public class SetProductionContentDto
    {
        public string Content { get; set; } = string.Empty;
    }
}
