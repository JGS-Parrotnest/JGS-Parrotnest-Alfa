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
        private async Task LogAdminActionAsync(string type, int performedById, int? targetUserId, string? reason, int? durationMinutes, bool success, string? details = null)
        {
            try
            {
                _context.AdminActionLogs.Add(new AdminActionLog
                {
                    PerformedByUserId = performedById,
                    TargetUserId = targetUserId,
                    ActionType = type,
                    Reason = reason,
                    DurationMinutes = durationMinutes,
                    Success = success,
                    Details = details,
                    Timestamp = DateTime.UtcNow
                });
                await _context.SaveChangesAsync();
            }
            catch
            {
            }
        }
        [HttpPost("ban/{id:int}")]
        public async Task<IActionResult> BanUser(int id, [FromBody] BanUserDto dto)
        {
            var requester = await GetRequesterAsync();
            if (requester == null || !requester.IsAdmin) return Forbid("Wymagane uprawnienia administratora.");
            var user = await _context.Users.FindAsync(id);
            if (user == null) return NotFound("Użytkownik nie istnieje.");
            if (user.IsAdmin) return Forbid("Nie można banować administratora.");
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
            try
            {
                await _context.SaveChangesAsync();
                await LogAdminActionAsync("ban", requester.Id, id, dto.Reason, dto.Minutes > 0 ? dto.Minutes : null, true, $"until={until:O}");
            }
            catch (Exception ex)
            {
                await LogAdminActionAsync("ban", requester.Id, id, dto.Reason, dto.Minutes > 0 ? dto.Minutes : null, false, ex.Message);
                throw;
            }
            return Ok(new { message = $"Użytkownik zbanowany do {until.ToLocalTime():yyyy-MM-dd HH:mm}." });
        }
        [HttpPost("unban/{id:int}")]
        public async Task<IActionResult> UnbanUser(int id)
        {
            var requester = await GetRequesterAsync();
            if (requester == null || !requester.IsAdmin) return Forbid("Wymagane uprawnienia administratora.");
            var user = await _context.Users.FindAsync(id);
            if (user == null) return NotFound("Użytkownik nie istnieje.");
            if (user.IsAdmin) return Forbid("Nie można odbanować administratora tą metodą.");
            user.BanUntil = null;
            try
            {
                await _context.SaveChangesAsync();
                await LogAdminActionAsync("unban", requester.Id, id, null, null, true);
            }
            catch (Exception ex)
            {
                await LogAdminActionAsync("unban", requester.Id, id, null, null, false, ex.Message);
                throw;
            }
            return Ok(new { message = "Użytkownik odbanowany." });
        }
        [HttpPost("mute/{id:int}")]
        public async Task<IActionResult> MuteUser(int id, [FromBody] BanUserDto dto)
        {
            var requester = await GetRequesterAsync();
            if (requester == null || !requester.IsAdmin) return Forbid("Wymagane uprawnienia administratora.");
            var user = await _context.Users.FindAsync(id);
            if (user == null) return NotFound("Użytkownik nie istnieje.");
            if (user.IsAdmin) return Forbid("Nie można wyciszać administratora.");
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
            user.MutedUntil = until;
            try
            {
                await _context.SaveChangesAsync();
                await LogAdminActionAsync("mute", requester.Id, id, dto.Reason, dto.Minutes > 0 ? dto.Minutes : null, true, $"until={until:O}");
            }
            catch (Exception ex)
            {
                await LogAdminActionAsync("mute", requester.Id, id, dto.Reason, dto.Minutes > 0 ? dto.Minutes : null, false, ex.Message);
                throw;
            }
            return Ok(new { message = $"Użytkownik wyciszony do {until.ToLocalTime():yyyy-MM-dd HH:mm}." });
        }
        [HttpPost("unmute/{id:int}")]
        public async Task<IActionResult> UnmuteUser(int id)
        {
            var requester = await GetRequesterAsync();
            if (requester == null || !requester.IsAdmin) return Forbid("Wymagane uprawnienia administratora.");
            var user = await _context.Users.FindAsync(id);
            if (user == null) return NotFound("Użytkownik nie istnieje.");
            if (user.IsAdmin) return Forbid("Nie można odciszyć administratora tą metodą.");
            user.MutedUntil = null;
            try
            {
                await _context.SaveChangesAsync();
                await LogAdminActionAsync("unmute", requester.Id, id, null, null, true);
            }
            catch (Exception ex)
            {
                await LogAdminActionAsync("unmute", requester.Id, id, null, null, false, ex.Message);
                throw;
            }
            return Ok(new { message = "Użytkownik odciszony." });
        }
        [HttpDelete("users/{id:int}")]
        public async Task<IActionResult> DeleteUser(int id)
        {
            var requester = await GetRequesterAsync();
            if (requester == null || !requester.IsAdmin) return Forbid("Wymagane uprawnienia administratora.");
            var user = await _context.Users.FindAsync(id);
            if (user == null) return NotFound("Użytkownik nie istnieje.");
            if (user.IsAdmin) return Forbid("Nie można usunąć administratora.");
            if (requester != null && requester.Id == id) return Forbid("Nie możesz usunąć samego siebie.");
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
            try
            {
                await _context.SaveChangesAsync();
                await LogAdminActionAsync("delete_user", requester.Id, id, null, null, true);
            }
            catch (Exception ex)
            {
                await LogAdminActionAsync("delete_user", requester.Id, id, null, null, false, ex.Message);
                throw;
            }
            return Ok(new { message = "Użytkownik usunięty." });
        }
        [HttpDelete("messages/global")]
        public async Task<IActionResult> ClearGlobalMessages()
        {
            var requester = await GetRequesterAsync();
            if (requester == null || !requester.IsAdmin) return Forbid("Wymagane uprawnienia administratora.");
            var globalMessages = await _context.Messages.Where(m => m.GroupId == null && m.ReceiverId == null).ToListAsync();
            var count = globalMessages.Count;
            if (count > 0)
            {
                _context.Messages.RemoveRange(globalMessages);
                await _context.SaveChangesAsync();
            }
            await LogAdminActionAsync("clear_global", requester.Id, null, null, null, true, $"deleted={count}");
            return Ok(new { message = $"Usunięto {count} wiadomości z kanału ogólnego." });
        }
        [HttpGet("logs")]
        public async Task<IActionResult> GetAdminLogs([FromQuery] int limit = 200)
        {
            var requester = await GetRequesterAsync();
            if (requester == null || !requester.IsAdmin) return Forbid("Wymagane uprawnienia administratora.");
            limit = Math.Clamp(limit, 1, 1000);
            var logs = await _context.AdminActionLogs
                .Include(l => l.PerformedByUser)
                .Include(l => l.TargetUser)
                .OrderByDescending(l => l.Timestamp)
                .Take(limit)
                .Select(l => new {
                    l.Id,
                    l.ActionType,
                    l.Reason,
                    l.DurationMinutes,
                    l.Timestamp,
                    l.Success,
                    l.Details,
                    PerformedBy = new { Id = l.PerformedByUserId, Username = l.PerformedByUser != null ? l.PerformedByUser.Username : null },
                    TargetUser = l.TargetUserId.HasValue ? new { Id = l.TargetUserId, Username = l.TargetUser != null ? l.TargetUser.Username : null } : null
                })
                .ToListAsync();
            return Ok(logs);
        }
    }
    public class BanUserDto
    {
        public int Minutes { get; set; } = 0;
        public DateTime? Until { get; set; }
        public string? Reason { get; set; }
    }
    public class ResetAdminDto
    {
        public string Secret { get; set; } = string.Empty;
    }
}
