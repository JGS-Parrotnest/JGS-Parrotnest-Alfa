using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ParrotnestServer.Data;
using ParrotnestServer.Models;
using System.Security.Claims;
using BCrypt.Net;
namespace ParrotnestServer.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class UsersController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly IWebHostEnvironment _environment;
        private readonly IConfiguration _configuration;
        public UsersController(ApplicationDbContext context, IWebHostEnvironment environment, IConfiguration configuration)
        {
            _context = context;
            _environment = environment;
            _configuration = configuration;
        }
        [HttpGet("me")]
        public async Task<ActionResult<object>> GetCurrentUser()
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userIdClaim))
            {
                return Unauthorized();
            }
            var userId = int.Parse(userIdClaim);
            var user = await _context.Users.FindAsync(userId);
            if (user == null)
            {
                return NotFound();
            }
            return Ok(new
            {
                user.Id,
                user.Username,
                user.Email,
                user.AvatarUrl
            });
        }
        [HttpPost("avatar")]
        public async Task<IActionResult> UploadAvatar(IFormFile file)
        {
            if (file == null || file.Length == 0)
                return BadRequest("Nie wybrano pliku.");
            var allowedExtensions = new[] { ".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp" };
            var fileExtension = Path.GetExtension(file.FileName).ToLower();
            if (!allowedExtensions.Contains(fileExtension))
                return BadRequest("Dozwolone sÄ… tylko pliki obrazĂłw (PNG, JPG, JPEG, GIF, WEBP, BMP).");
            var clientPath = _configuration["ClientPath"] ?? Path.Combine(_environment.ContentRootPath, "..", "Client");
            var uploadsFolder = Path.Combine(clientPath, "uploads", "avatars");
            if (!Directory.Exists(uploadsFolder))
                Directory.CreateDirectory(uploadsFolder);
            var fileName = Guid.NewGuid().ToString() + fileExtension;
            var filePath = Path.Combine(uploadsFolder, fileName);
            using (var stream = new FileStream(filePath, FileMode.Create))
            {
                await file.CopyToAsync(stream);
            }
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userIdClaim))
            {
                return Unauthorized("Nie moĹĽna zidentyfikowaÄ‡ uĹĽytkownika.");
            }
            var userId = int.Parse(userIdClaim);
            var user = await _context.Users.FindAsync(userId);
            if (user == null)
            {
                return NotFound("UĹĽytkownik nie zostaĹ‚ znaleziony.");
            }
            if (!string.IsNullOrEmpty(user.AvatarUrl) && user.AvatarUrl.StartsWith("/uploads/avatars/"))
            {
                try
                {
                    var oldFileName = Path.GetFileName(user.AvatarUrl);
                    var oldFilePath = Path.Combine(uploadsFolder, oldFileName);
                    if (System.IO.File.Exists(oldFilePath))
                    {
                        System.IO.File.Delete(oldFilePath);
                    }
                }
                catch
                {
                }
            }
            var avatarUrl = $"/uploads/avatars/{fileName}";
            user.AvatarUrl = avatarUrl;
            try
            {
                await _context.SaveChangesAsync();
            }
            catch (Exception ex)
            {
                try
                {
                    if (System.IO.File.Exists(filePath))
                    {
                        System.IO.File.Delete(filePath);
                    }
                }
                catch { }
                return StatusCode(500, $"BĹ‚Ä…d podczas zapisywania awatara: {ex.Message}");
            }
            return Ok(new { url = avatarUrl });
        }
        [HttpPut("profile")]
        public async Task<IActionResult> UpdateProfile([FromBody] UpdateProfileDto dto)
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userIdClaim))
            {
                return Unauthorized();
            }
            var userId = int.Parse(userIdClaim);
            var user = await _context.Users.FindAsync(userId);
            if (user == null)
                return NotFound();
            if (!string.IsNullOrWhiteSpace(dto.Username) && dto.Username != user.Username)
            {
                if (await _context.Users.AnyAsync(u => u.Username == dto.Username))
                    return BadRequest("Nazwa uĹĽytkownika jest juĹĽ zajÄ™ta.");
                user.Username = dto.Username;
            }
            if (!string.IsNullOrWhiteSpace(dto.Password))
            {
                user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.Password);
            }
            await _context.SaveChangesAsync();
            return Ok(new { message = "Profil zaktualizowany", user = new { user.Id, user.Username, user.Email, user.AvatarUrl } });
        }
    }
    public class UpdateProfileDto
    {
        public string? Username { get; set; }
        public string? Password { get; set; }
    }
}
