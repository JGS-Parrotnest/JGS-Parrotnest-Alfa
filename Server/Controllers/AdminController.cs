using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Logging;
using System.Data;
using System.Data.Common;
using System.Security.Claims;
using ParrotnestServer.Data;
using ParrotnestServer.Hubs;
using ParrotnestServer.Models;
namespace ParrotnestServer.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class AdminController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly IHubContext<ChatHub> _hubContext;
            private readonly ILogger<AdminController> _logger;
            public AdminController(ApplicationDbContext context, IHubContext<ChatHub> hubContext, ILogger<AdminController> logger)
        {
            _context = context;
            _hubContext = hubContext;
                _logger = logger;
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
                await _context.Database.ExecuteSqlRawAsync(
                    "INSERT INTO AdminActionLogs (PerformedByUserId, TargetUserId, ActionType, Reason, DurationMinutes, Timestamp, Details, Success) VALUES ({0},{1},{2},{3},{4},{5},{6},{7})",
                    performedById,
                    targetUserId,
                    type,
                    reason,
                    durationMinutes,
                    DateTime.UtcNow,
                    details,
                    success ? 1 : 0
                );
            }
            catch (Exception ex)
            {
                try
                {
                    await _context.Database.ExecuteSqlRawAsync(
                        "INSERT INTO AdminActionLog (PerformedByUserId, TargetUserId, ActionType, Reason, DurationMinutes, Timestamp, Details, Success) VALUES ({0},{1},{2},{3},{4},{5},{6},{7})",
                        performedById,
                        targetUserId,
                        type,
                        reason,
                        durationMinutes,
                        DateTime.UtcNow,
                        details,
                        success ? 1 : 0
                    );
                }
                catch (Exception ex2)
                {
                    _logger.LogError(ex, "Failed to log admin action {Type} for user {TargetUserId}", type, targetUserId);
                    _logger.LogError(ex2, "Failed to log admin action fallback {Type} for user {TargetUserId}", type, targetUserId);
                }
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
                if (dto.Minutes > 0)
                {
                    until = DateTime.UtcNow.AddMinutes(dto.Minutes);
                }
                else
                {
                    until = DateTime.UtcNow.AddYears(1000);
                }
            }
            user.BanUntil = until;
            try
            {
                await _context.SaveChangesAsync();
                await LogAdminActionAsync("ban", requester.Id, id, dto.Reason, dto.Minutes > 0 ? dto.Minutes : null, true, $"until={until:O}");
                await _hubContext.Clients.Group($"User_{id}")
                    .SendAsync("ForceLogout", new
                    {
                        reason = dto.Reason,
                        until = until,
                        message = $"Twoje konto zostało zbanowane do {until.ToLocalTime():yyyy-MM-dd HH:mm}."
                    });
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
        public async Task<IActionResult> GetAdminLogs()
        {
            var requester = await GetRequesterAsync();
            if (requester == null || !requester.IsAdmin) return Forbid("Wymagane uprawnienia administratora.");

            var result = new List<object>();
            var conn = _context.Database.GetDbConnection();
            try
            {
                if (conn.State != ConnectionState.Open) await conn.OpenAsync();
                await using (var cmd = conn.CreateCommand())
                {
                    cmd.CommandText = $@"
SELECT
    l.Id,
    l.PerformedByUserId,
    l.TargetUserId,
    l.ActionType,
    l.Reason,
    l.DurationMinutes,
    l.Timestamp,
    l.Details,
    l.Success,
    u1.Username AS PerformedByUsername,
    u2.Username AS TargetUsername
FROM AdminActionLogs l
LEFT JOIN Users u1 ON u1.Id = l.PerformedByUserId
LEFT JOIN Users u2 ON u2.Id = l.TargetUserId
ORDER BY l.Timestamp DESC;";
                    await using (var reader = await cmd.ExecuteReaderAsync())
                    {
                        while (await reader.ReadAsync())
                        {
                            var id = reader["Id"] is DBNull ? 0 : Convert.ToInt32(reader["Id"]);
                            var performedById = reader["PerformedByUserId"] is DBNull ? 0 : Convert.ToInt32(reader["PerformedByUserId"]);
                            int? targetId = reader["TargetUserId"] is DBNull ? (int?)null : Convert.ToInt32(reader["TargetUserId"]);
                            var actionType = reader["ActionType"] is DBNull ? string.Empty : Convert.ToString(reader["ActionType"]) ?? string.Empty;
                            string? reason = reader["Reason"] is DBNull ? null : Convert.ToString(reader["Reason"]);
                            int? duration = reader["DurationMinutes"] is DBNull ? (int?)null : Convert.ToInt32(reader["DurationMinutes"]);
                            var tsRaw = reader["Timestamp"] is DBNull ? null : Convert.ToString(reader["Timestamp"]);
                            DateTime ts;
                            if (!DateTime.TryParse(tsRaw, out ts)) ts = DateTime.UtcNow;
                            string? details = reader["Details"] is DBNull ? null : Convert.ToString(reader["Details"]);
                            bool success = false;
                            if (reader["Success"] is DBNull) success = true; else
                            {
                                var sv = reader["Success"];
                                if (sv is long ll) success = ll != 0;
                                else if (sv is int ii) success = ii != 0;
                                else if (sv is string ss) success = ss != "0";
                                else success = true;
                            }
                            var performedByUsername = reader["PerformedByUsername"] is DBNull ? null : Convert.ToString(reader["PerformedByUsername"]);
                            var targetUsername = reader["TargetUsername"] is DBNull ? null : Convert.ToString(reader["TargetUsername"]);
                            var item = new
                            {
                                Id = id,
                                ActionType = actionType,
                                Reason = reason,
                                DurationMinutes = duration,
                                Timestamp = ts,
                                Success = success,
                                Details = details,
                                PerformedBy = new { Id = performedById, Username = performedByUsername },
                                TargetUser = targetId.HasValue ? new { Id = targetId, Username = targetUsername } : null
                            };
                            result.Add(item);
                        }
                    }
                }
            }
            catch
            {
                return StatusCode(500, "Nie udało się pobrać logów administracyjnych.");
            }
            finally
            {
                if (conn.State == ConnectionState.Open) await conn.CloseAsync();
            }
            return Ok(result);
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
