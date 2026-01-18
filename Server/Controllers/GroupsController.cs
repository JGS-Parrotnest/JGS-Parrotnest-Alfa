using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.SignalR;
using Microsoft.AspNetCore.Hosting;
using ParrotnestServer.Data;
using ParrotnestServer.Models;
using ParrotnestServer.Hubs;
using System.Security.Claims;
namespace ParrotnestServer.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class GroupsController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly IWebHostEnvironment _environment;
        private readonly IConfiguration _configuration;
        private readonly IHubContext<ChatHub> _hubContext;
        public GroupsController(ApplicationDbContext context, IWebHostEnvironment environment, IConfiguration configuration, IHubContext<ChatHub> hubContext)
        {
            _context = context;
            _environment = environment;
            _configuration = configuration;
            _hubContext = hubContext;
        }
        [HttpGet("common/{targetUserId}")]
        public async Task<IActionResult> GetCommonGroups(int targetUserId)
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userIdClaim) || !int.TryParse(userIdClaim, out int userId))
            {
                return Unauthorized();
            }
            if (userId == targetUserId) return BadRequest("Cannot check common groups with yourself.");
            var myGroupIds = await _context.GroupMembers
                .Where(gm => gm.UserId == userId)
                .Select(gm => gm.GroupId)
                .ToListAsync();
            var targetGroupIds = await _context.GroupMembers
                .Where(gm => gm.UserId == targetUserId)
                .Select(gm => gm.GroupId)
                .ToListAsync();
            var commonIds = myGroupIds.Intersect(targetGroupIds).ToList();
            if (!commonIds.Any()) return Ok(new List<object>());
            var commonGroups = await _context.Groups
                .Where(g => commonIds.Contains(g.Id))
                .Select(g => new
                {
                    g.Id,
                    g.Name,
                    g.AvatarUrl
                })
                .ToListAsync();
            return Ok(commonGroups);
        }
        [HttpPost]
        public async Task<IActionResult> CreateGroup([FromBody] CreateGroupDto dto)
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userIdClaim) || !int.TryParse(userIdClaim, out int userId))
            {
                return Unauthorized();
            }
            if (string.IsNullOrWhiteSpace(dto.Name))
            {
                return BadRequest("Nazwa grupy jest wymagana.");
            }
            if (dto.Members == null)
            {
                dto.Members = new List<string>();
            }
            var members = await _context.Users
                .Where(u => dto.Members.Contains(u.Username))
                .ToListAsync();
            var group = new Group
            {
                Name = dto.Name,
                OwnerId = userId,
                AvatarUrl = dto.AvatarUrl,
                CreatedAt = DateTime.UtcNow
            };
            _context.Groups.Add(group);
            await _context.SaveChangesAsync();
            _context.GroupMembers.Add(new GroupMember
            {
                GroupId = group.Id,
                UserId = userId,
                JoinedAt = DateTime.UtcNow
            });
            foreach (var member in members)
            {
                if (member.Id != userId)
                {
                    _context.GroupMembers.Add(new GroupMember
                    {
                        GroupId = group.Id,
                        UserId = member.Id,
                        JoinedAt = DateTime.UtcNow
                    });
                }
            }
            await _context.SaveChangesAsync();
            var memberUserIds = await _context.GroupMembers
                .Where(gm => gm.GroupId == group.Id)
                .Select(gm => gm.UserId)
                .ToListAsync();
            var groupPayload = new
            {
                Id = group.Id,
                group.Name,
                group.AvatarUrl,
                group.CreatedAt,
                group.OwnerId
            };
            foreach (var uid in memberUserIds)
            {
                await _hubContext.Clients.User(uid.ToString())
                    .SendAsync("GroupMembershipChanged", "added", groupPayload);
            }

            return Ok(new { message = "Grupa została utworzona.", groupId = group.Id });
        }
        [HttpGet]
        public async Task<IActionResult> GetGroups()
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userIdClaim) || !int.TryParse(userIdClaim, out int userId))
            {
                return Unauthorized();
            }
            var groups = await _context.GroupMembers
                .Where(gm => gm.UserId == userId)
                .Include(gm => gm.Group)
                .Where(gm => gm.Group != null)
                .Select(gm => new
                {
                    gm.Group!.Id,
                    gm.Group.Name,
                    gm.Group.AvatarUrl,
                    gm.Group.CreatedAt,
                    gm.Group.OwnerId
                })
                .ToListAsync();
            return Ok(groups);
        }
        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateGroup(int id, [FromBody] UpdateGroupDto dto)
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userIdClaim) || !int.TryParse(userIdClaim, out int userId))
            {
                return Unauthorized();
            }
            var group = await _context.Groups.FindAsync(id);
            if (group == null)
            {
                return NotFound("Grupa nie została znaleziona.");
            }

            if (group.OwnerId != userId)
            {
                return Forbid("Tylko właściciel może edytować grupę.");
            }
            if (!string.IsNullOrWhiteSpace(dto.Name))
            {
                group.Name = dto.Name;
            }
            group.AvatarUrl = dto.AvatarUrl;
            await _context.SaveChangesAsync();
            var memberUserIds = await _context.GroupMembers
                .Where(gm => gm.GroupId == group.Id)
                .Select(gm => gm.UserId)
                .ToListAsync();
            var groupPayload = new
            {
                Id = group.Id,
                group.Name,
                group.AvatarUrl,
                group.CreatedAt,
                group.OwnerId
            };
            foreach (var uid in memberUserIds)
            {
                await _hubContext.Clients.User(uid.ToString())
                    .SendAsync("GroupMembershipChanged", "updated", groupPayload);
            }

            return Ok(new { message = "Grupa została zaktualizowana.", group });
        }
        [HttpPost("{id}/avatar")]
        public async Task<IActionResult> UploadAvatar(int id, IFormFile avatar)
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userIdClaim) || !int.TryParse(userIdClaim, out int userId))
            {
                return Unauthorized();
            }
            var group = await _context.Groups.FindAsync(id);
            if (group == null)
            {
                return NotFound("Grupa nie została znaleziona.");
            }

            if (group.OwnerId != userId)
            {
                return Forbid("Tylko właściciel może zmienić ikonę grupy.");
            }

            if (avatar == null || avatar.Length == 0)
            {
                return BadRequest("Nie przesłano pliku.");
            }
            var clientPath = _configuration["ClientPath"] ?? Path.Combine(_environment.ContentRootPath, "..", "Client");
            var uploadsFolder = Path.Combine(clientPath, "uploads", "avatars");
            if (!Directory.Exists(uploadsFolder))
            {
                Directory.CreateDirectory(uploadsFolder);
            }
            var fileName = $"{Guid.NewGuid()}{Path.GetExtension(avatar.FileName)}";
            var filePath = Path.Combine(uploadsFolder, fileName);
            using (var stream = new FileStream(filePath, FileMode.Create))
            {
                await avatar.CopyToAsync(stream);
            }
            var avatarUrl = $"/uploads/avatars/{fileName}";
            group.AvatarUrl = avatarUrl;
            await _context.SaveChangesAsync();
            var memberUserIds = await _context.GroupMembers
                .Where(gm => gm.GroupId == id)
                .Select(gm => gm.UserId)
                .ToListAsync();
            var groupPayload = new
            {
                Id = group.Id,
                group.Name,
                group.AvatarUrl,
                group.CreatedAt,
                group.OwnerId
            };
            foreach (var uid in memberUserIds)
            {
                await _hubContext.Clients.User(uid.ToString())
                    .SendAsync("GroupMembershipChanged", "updated", groupPayload);
            }
            return Ok(new { url = avatarUrl });
        }
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteGroup(int id)
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userIdClaim) || !int.TryParse(userIdClaim, out int userId))
            {
                return Unauthorized();
            }
            var group = await _context.Groups.FindAsync(id);
            if (group == null)
            {
                return NotFound("Grupa nie została znaleziona.");
            }

            if (group.OwnerId != userId)
            {
                return Forbid("Tylko właściciel może usunąć grupę.");
            }
            var memberUserIds = await _context.GroupMembers
                .Where(gm => gm.GroupId == id)
                .Select(gm => gm.UserId)
                .ToListAsync();
            _context.Groups.Remove(group);
            await _context.SaveChangesAsync();
            var groupPayload = new
            {
                Id = id,
                Name = group.Name,
                AvatarUrl = group.AvatarUrl,
                CreatedAt = group.CreatedAt,
                OwnerId = group.OwnerId
            };
            foreach (var uid in memberUserIds)
            {
                await _hubContext.Clients.User(uid.ToString())
                    .SendAsync("GroupMembershipChanged", "removed", groupPayload);
            }

            return Ok(new { message = "Grupa została usunięta." });
        }
        [HttpPost("{id}/members")]
        public async Task<IActionResult> AddGroupMembers(int id, [FromBody] List<string> usernames)
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userIdClaim) || !int.TryParse(userIdClaim, out int userId))
            {
                return Unauthorized();
            }
            var group = await _context.Groups.FindAsync(id);
            if (group == null)
            {
                return NotFound("Grupa nie została znaleziona.");
            }

            if (group.OwnerId != userId)
            {
                 return Forbid("Tylko właściciel może dodawać członków.");
            }

            if (usernames == null || !usernames.Any())
            {
                return BadRequest("Lista użytkowników jest pusta.");
            }

            var usersToAdd = await _context.Users
                .Where(u => usernames.Contains(u.Username))
                .ToListAsync();

            if (!usersToAdd.Any())
            {
                return Ok(new { message = "Nie znaleziono podanych użytkowników." });
            }
            int addedCount = 0;
            foreach (var userToAdd in usersToAdd)
            {
                var exists = await _context.GroupMembers
                    .AnyAsync(gm => gm.GroupId == id && gm.UserId == userToAdd.Id);
                if (!exists)
                {
                    _context.GroupMembers.Add(new GroupMember
                    {
                        GroupId = id,
                        UserId = userToAdd.Id,
                        JoinedAt = DateTime.UtcNow
                    });
                    addedCount++;
                }
            }
            if (addedCount > 0)
            {
                await _context.SaveChangesAsync();
                var groupEntity = await _context.Groups.FindAsync(id);
                if (groupEntity != null)
                {
                    var groupPayload = new
                    {
                        Id = groupEntity.Id,
                        Name = groupEntity.Name,
                        AvatarUrl = groupEntity.AvatarUrl,
                        CreatedAt = groupEntity.CreatedAt,
                        OwnerId = groupEntity.OwnerId
                    };

                    foreach (var userToAdd in usersToAdd)
                    {
                        var existsNow = await _context.GroupMembers.AnyAsync(gm => gm.GroupId == id && gm.UserId == userToAdd.Id);
                        if (existsNow)
                        {
                            await _hubContext.Clients.User(userToAdd.Id.ToString())
                                .SendAsync("GroupMembershipChanged", "added", groupPayload);
                        }
                    }
                }
            }

            return Ok(new { message = $"Dodano {addedCount} użytkowników do grupy." });
        }
        [HttpGet("{id}/members")]
        public async Task<IActionResult> GetGroupMembers(int id)
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userIdClaim) || !int.TryParse(userIdClaim, out int userId))
            {
                return Unauthorized();
            }
            var isMember = await _context.GroupMembers.AnyAsync(gm => gm.GroupId == id && gm.UserId == userId);
            if (!isMember)
            {
                return Forbid("Nie jesteś członkiem tej grupy.");
            }
            var members = await _context.GroupMembers
                .Where(gm => gm.GroupId == id)
                .Include(gm => gm.User)
                .Select(gm => new
                {
                    gm.UserId,
                    Username = gm.User != null ? gm.User.Username : null,
                    AvatarUrl = gm.User != null ? gm.User.AvatarUrl : null,
                    JoinedAt = gm.JoinedAt
                })
                .ToListAsync();
            return Ok(members);
        }
        [HttpDelete("{id}/members/me")]
        public async Task<IActionResult> LeaveGroup(int id)
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userIdClaim) || !int.TryParse(userIdClaim, out int userId))
            {
                return Unauthorized();
            }
            var group = await _context.Groups.FindAsync(id);
            if (group == null)
            {
                return NotFound("Grupa nie została znaleziona.");
            }

            if (group.OwnerId == userId)
            {
                return Forbid("Właściciel nie może opuścić grupy. Usuń grupę lub przekaż własność.");
            }

            var membership = await _context.GroupMembers.FirstOrDefaultAsync(gm => gm.GroupId == id && gm.UserId == userId);
            if (membership == null)
            {
                return NotFound("Nie jesteś członkiem tej grupy.");
            }
            _context.GroupMembers.Remove(membership);
            await _context.SaveChangesAsync();
            await _hubContext.Clients.User(userId.ToString())
                .SendAsync("GroupMembershipChanged", "removed", new
                {
                    Id = group.Id,
                    group.Name,
                    group.AvatarUrl,
                    group.CreatedAt,
                    group.OwnerId
                });
            return Ok(new { message = "Opuściłeś grupę." });
        }
        [HttpDelete("{id}/members/{userId}")]
        public async Task<IActionResult> RemoveMember(int id, int userId)
        {
            var ownerIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(ownerIdClaim) || !int.TryParse(ownerIdClaim, out int requesterId))
            {
                return Unauthorized();
            }
            var group = await _context.Groups.FindAsync(id);
            if (group == null)
            {
                return NotFound("Grupa nie została znaleziona.");
            }

            if (group.OwnerId != requesterId)
            {
                return Forbid("Tylko właściciel może usuwać użytkowników z grupy.");
            }

            if (userId == requesterId)
            {
                return BadRequest("Właściciel nie może usuwać samego siebie. Użyj usunięcia grupy.");
            }

            var membership = await _context.GroupMembers.FirstOrDefaultAsync(gm => gm.GroupId == id && gm.UserId == userId);
            if (membership == null)
            {
                return NotFound("Użytkownik nie jest członkiem tej grupy.");
            }
            _context.GroupMembers.Remove(membership);
            await _context.SaveChangesAsync();
            await _hubContext.Clients.User(userId.ToString())
                .SendAsync("GroupMembershipChanged", "removed", new
                {
                    Id = group.Id,
                    group.Name,
                    group.AvatarUrl,
                    group.CreatedAt,
                    group.OwnerId
                });
            return Ok(new { message = "Użytkownik został usunięty z grupy." });
        }
    }
    public class CreateGroupDto
    {
        public string Name { get; set; } = string.Empty;
        public List<string> Members { get; set; } = new();
        public string? AvatarUrl { get; set; }
    }
    public class UpdateGroupDto
    {
        public string? Name { get; set; }
        public string? AvatarUrl { get; set; }
    }
}
