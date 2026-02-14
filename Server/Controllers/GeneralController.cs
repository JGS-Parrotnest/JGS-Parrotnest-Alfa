using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using ParrotnestServer.Data;
using ParrotnestServer.Hubs;
using System.Security.Claims;

namespace ParrotnestServer.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class GeneralController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly IWebHostEnvironment _environment;
        private readonly IConfiguration _configuration;
        private readonly IHubContext<ChatHub> _hubContext;

        public GeneralController(ApplicationDbContext context, IWebHostEnvironment environment, IConfiguration configuration, IHubContext<ChatHub> hubContext)
        {
            _context = context;
            _environment = environment;
            _configuration = configuration;
            _hubContext = hubContext;
        }

        [HttpGet]
        public async Task<IActionResult> Get()
        {
            var settings = await _context.GeneralChannelSettings.AsNoTracking().FirstOrDefaultAsync(s => s.Id == 1);
            if (settings == null)
            {
                return Ok(new { id = 1, ownerId = 0, name = "Ogólny", avatarUrl = (string?)null, updatedAt = (DateTime?)null });
            }
            return Ok(new { settings.Id, settings.OwnerId, settings.Name, settings.AvatarUrl, settings.UpdatedAt });
        }

        [HttpPut]
        public async Task<IActionResult> Update([FromBody] UpdateGeneralDto dto)
        {
            if (!await IsAdminAsync()) return Forbid();

            var settings = await _context.GeneralChannelSettings.FirstOrDefaultAsync(s => s.Id == 1);
            if (settings == null)
            {
                var admin = await GetRequesterAsync();
                if (admin == null) return Forbid();
                settings = new ParrotnestServer.Models.GeneralChannelSettings { Id = 1, OwnerId = admin.Id };
                _context.GeneralChannelSettings.Add(settings);
            }

            if (!string.IsNullOrWhiteSpace(dto.Name))
            {
                settings.Name = dto.Name.Trim();
            }

            settings.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            var payload = new { id = settings.Id, ownerId = settings.OwnerId, name = settings.Name, avatarUrl = settings.AvatarUrl, updatedAt = settings.UpdatedAt };
            await _hubContext.Clients.All.SendAsync("GeneralChannelUpdated", payload);
            return Ok(payload);
        }

        [HttpPost("avatar")]
        public async Task<IActionResult> UpdateAvatar(IFormFile avatar)
        {
            if (!await IsAdminAsync()) return Forbid();
            if (avatar == null || avatar.Length == 0) return BadRequest("Nie przesłano pliku.");

            var settings = await _context.GeneralChannelSettings.FirstOrDefaultAsync(s => s.Id == 1);
            if (settings == null)
            {
                var admin = await GetRequesterAsync();
                if (admin == null) return Forbid();
                settings = new ParrotnestServer.Models.GeneralChannelSettings { Id = 1, OwnerId = admin.Id, Name = "Ogólny" };
                _context.GeneralChannelSettings.Add(settings);
            }

            var clientPath = _configuration["ClientPath"] ?? Path.Combine(_environment.ContentRootPath, "..", "Client");
            var uploadsFolder = Path.Combine(clientPath, "uploads", "avatars");
            if (!Directory.Exists(uploadsFolder)) Directory.CreateDirectory(uploadsFolder);

            var fileName = $"{Guid.NewGuid()}{Path.GetExtension(avatar.FileName)}";
            var filePath = Path.Combine(uploadsFolder, fileName);
            using (var stream = new FileStream(filePath, FileMode.Create))
            {
                await avatar.CopyToAsync(stream);
            }

            var avatarUrl = $"/uploads/avatars/{fileName}";
            settings.AvatarUrl = avatarUrl;
            settings.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            var payload = new { id = settings.Id, ownerId = settings.OwnerId, name = settings.Name, avatarUrl = settings.AvatarUrl, updatedAt = settings.UpdatedAt };
            await _hubContext.Clients.All.SendAsync("GeneralChannelUpdated", payload);
            return Ok(new { url = avatarUrl });
        }

        private async Task<ParrotnestServer.Models.User?> GetRequesterAsync()
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userIdClaim) || !int.TryParse(userIdClaim, out var id)) return null;
            return await _context.Users.FindAsync(id);
        }

        private async Task<bool> IsAdminAsync()
        {
            var requester = await GetRequesterAsync();
            return requester != null && requester.IsAdmin;
        }
    }

    public class UpdateGeneralDto
    {
        public string? Name { get; set; }
    }
}

