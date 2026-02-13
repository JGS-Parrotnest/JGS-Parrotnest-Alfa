using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ParrotnestServer.Data;
using ParrotnestServer.Models;
using System.Security.Claims;
namespace ParrotnestServer.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class AdminController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        public AdminController(ApplicationDbContext context)
        {
            _context = context;
        }
        [AllowAnonymous]
        [HttpPost("reset-admin")]
        public async Task<IActionResult> ResetAdmin([FromBody] ResetAdminDto dto)
        {
            if (dto == null || string.IsNullOrWhiteSpace(dto.Secret) || dto.Secret != "skyadmin")
            {
                return Forbid("Nieprawidłowy sekret.");
            }
            var toDelete = await _context.Users
                .Where(u => u.Username.ToLower() == "admin" || u.Email.ToLower() == "admin@zse.pl")
                .ToListAsync();
            if (toDelete.Any())
            {
                _context.Users.RemoveRange(toDelete);
                await _context.SaveChangesAsync();
            }
            var adminUser = new User
            {
                Username = "admin",
                Email = "admin@zse.pl",
                PasswordHash = BCrypt.Net.BCrypt.HashPassword("skyadmin"),
                IsAdmin = true,
                Status = 1,
                Theme = "original",
                TextSize = "medium",
                IsSimpleText = false
            };
            _context.Users.Add(adminUser);
            await _context.SaveChangesAsync();
            return Ok(new { message = "Admin zresetowany: admin@zse.pl / skyadmin" });
        }
        private async Task<User?> GetRequesterAsync()
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userIdClaim)) return null;
            if (!int.TryParse(userIdClaim, out int requesterId)) return null;
            return await _context.Users.FindAsync(requesterId);
        }
        private async Task<bool> EnsureAdminAsync()
        {
            var requester = await GetRequesterAsync();
            if (requester == null) return false;
            return requester.IsAdmin;
        }
        [HttpPost("ban/{id:int}")]
        public async Task<IActionResult> BanUser(int id, [FromBody] BanUserDto dto)
        {
            if (!await EnsureAdminAsync()) return Forbid("Wymagane uprawnienia administratora.");
            var user = await _context.Users.FindAsync(id);
            if (user == null) return NotFound("Użytkownik nie istnieje.");
            DateTime until;
            if (dto.Until.HasValue)
            {
                until = dto.Until.Value.ToUniversalTime();
            }
            else
            {
                var minutes = dto.Minutes > 0 ? dto.Minutes : 60;
                until = DateTime.UtcNow.AddMinutes(minutes);
            }
            user.BanUntil = until;
            await _context.SaveChangesAsync();
            return Ok(new { message = $"Użytkownik zbanowany do {until.ToLocalTime():yyyy-MM-dd HH:mm}." });
        }
        [HttpDelete("users/{id:int}")]
        public async Task<IActionResult> DeleteUser(int id)
        {
            if (!await EnsureAdminAsync()) return Forbid("Wymagane uprawnienia administratora.");
            var user = await _context.Users.FindAsync(id);
            if (user == null) return NotFound("Użytkownik nie istnieje.");
            var groupsOwned = await _context.Groups.Where(g => g.OwnerId == id).ToListAsync();
            if (groupsOwned.Any())
            {
                _context.Groups.RemoveRange(groupsOwned);
            }
            var friendships = await _context.Friendships.Where(f => f.RequesterId == id || f.AddresseeId == id).ToListAsync();
            if (friendships.Any())
            {
                _context.Friendships.RemoveRange(friendships);
            }
            var groupMembers = await _context.GroupMembers.Where(gm => gm.UserId == id).ToListAsync();
            if (groupMembers.Any())
            {
                _context.GroupMembers.RemoveRange(groupMembers);
            }
            var directMessages = await _context.Messages.Where(m => m.SenderId == id || m.ReceiverId == id).ToListAsync();
            if (directMessages.Any())
            {
                _context.Messages.RemoveRange(directMessages);
            }
            _context.Users.Remove(user);
            await _context.SaveChangesAsync();
            return Ok(new { message = "Użytkownik usunięty." });
        }
        [HttpDelete("messages/global")]
        public async Task<IActionResult> ClearGlobalMessages()
        {
            if (!await EnsureAdminAsync()) return Forbid("Wymagane uprawnienia administratora.");
            var globalMessages = await _context.Messages.Where(m => m.GroupId == null && m.ReceiverId == null).ToListAsync();
            var count = globalMessages.Count;
            if (count > 0)
            {
                _context.Messages.RemoveRange(globalMessages);
                await _context.SaveChangesAsync();
            }
            return Ok(new { message = $"Usunięto {count} wiadomości z kanału ogólnego." });
        }
    }
    public class BanUserDto
    {
        public int Minutes { get; set; } = 0;
        public DateTime? Until { get; set; }
    }
    public class ResetAdminDto
    {
        public string Secret { get; set; } = string.Empty;
    }
}
