using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ParrotnestServer.Data;
using ParrotnestServer.Models;
using ParrotnestServer.Services;
using System.Security.Claims;
namespace ParrotnestServer.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class FriendsController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly IUserTracker _userTracker;
        public FriendsController(ApplicationDbContext context, IUserTracker userTracker)
        {
            _context = context;
            _userTracker = userTracker;
        }
        private int? GetUserId()
        {
            var claim = User.FindFirst(ClaimTypes.NameIdentifier);
            if (claim != null && int.TryParse(claim.Value, out int userId))
            {
                return userId;
            }
            return null;
        }
        [HttpGet]
        public async Task<ActionResult<IEnumerable<object>>> GetFriends()
        {
            var userId = GetUserId();
            if (!userId.HasValue) return Unauthorized();
            var friendships = await _context.Friendships
                .Include(f => f.Requester)
                .Include(f => f.Addressee)
                .Where(f => f.Status == FriendshipStatus.Accepted && 
                           (f.RequesterId == userId || f.AddresseeId == userId))
                .Select(f => new
                {
                    Id = f.RequesterId == userId ? f.AddresseeId : f.RequesterId,
                    Username = f.RequesterId == userId ? (f.Addressee != null ? f.Addressee.Username : null) : (f.Requester != null ? f.Requester.Username : null),
                    Email = f.RequesterId == userId ? (f.Addressee != null ? f.Addressee.Email : null) : (f.Requester != null ? f.Requester.Email : null),
                    AvatarUrl = f.RequesterId == userId ? (f.Addressee != null ? f.Addressee.AvatarUrl : null) : (f.Requester != null ? f.Requester.AvatarUrl : null)
                })
                .ToListAsync();
            var friendIds = friendships.Select(f => f.Id).ToList();
            var lastMessages = await _context.Messages
                .Where(m => (m.SenderId == userId && friendIds.Contains(m.ReceiverId ?? 0)) || 
                            (m.ReceiverId == userId && friendIds.Contains(m.SenderId)))
                .GroupBy(m => m.SenderId == userId ? m.ReceiverId : m.SenderId)
                .Select(g => g.OrderByDescending(m => m.Timestamp).FirstOrDefault())
                .ToListAsync();
            var resultList = new List<object>();
            foreach(var f in friendships)
            {
                var lastMsg = lastMessages.FirstOrDefault(m => 
                    m != null &&
                    ((m.SenderId == userId && m.ReceiverId == f.Id) || 
                    (m.ReceiverId == userId && m.SenderId == f.Id)));
                var isOnline = await _userTracker.IsUserOnline(f.Id);
                resultList.Add(new {
                    f.Id,
                    f.Username,
                    f.Email,
                    f.AvatarUrl,
                    LastMessage = lastMsg?.Content,
                    LastMessageTime = lastMsg?.Timestamp,
                    IsOnline = isOnline
                });
            }
            return Ok(resultList);
        }
        [HttpGet("pending")]
        public async Task<ActionResult<IEnumerable<object>>> GetPendingRequests()
        {
            var userId = GetUserId();
            if (!userId.HasValue) return Unauthorized();
            var pending = await _context.Friendships
                .Include(f => f.Requester)
                .Include(f => f.Addressee)
                .Where(f => f.Status == FriendshipStatus.Pending && f.AddresseeId == userId)
                .Select(f => new
                {
                    Id = f.Id,
                    RequesterId = f.RequesterId,
                    Username = f.Requester != null ? f.Requester.Username : "Unknown",
                    Email = f.Requester != null ? f.Requester.Email : null,
                    AvatarUrl = f.Requester != null ? f.Requester.AvatarUrl : null,
                    CreatedAt = f.CreatedAt
                })
                .ToListAsync();
            return Ok(pending);
        }
        [HttpGet("mutual/{targetUserId}")]
        public async Task<IActionResult> GetMutualFriends(int targetUserId)
        {
            var userId = GetUserId();
            if (!userId.HasValue) return Unauthorized();
            if (userId == targetUserId) return BadRequest("Cannot check mutual friends with yourself.");
            var myFriendIds = await _context.Friendships
                .Where(f => f.Status == FriendshipStatus.Accepted && 
                           (f.RequesterId == userId || f.AddresseeId == userId))
                .Select(f => f.RequesterId == userId ? f.AddresseeId : f.RequesterId)
                .ToListAsync();
            var targetFriendIds = await _context.Friendships
                .Where(f => f.Status == FriendshipStatus.Accepted && 
                           (f.RequesterId == targetUserId || f.AddresseeId == targetUserId))
                .Select(f => f.RequesterId == targetUserId ? f.AddresseeId : f.RequesterId)
                .ToListAsync();
            var mutualIds = myFriendIds.Intersect(targetFriendIds).ToList();
            if (!mutualIds.Any()) return Ok(new List<object>());
            var mutualFriends = await _context.Users
                .Where(u => mutualIds.Contains(u.Id))
                .Select(u => new 
                {
                    u.Id,
                    u.Username,
                    u.AvatarUrl
                })
                .ToListAsync();
            return Ok(mutualFriends);
        }
        [HttpPost("add")]
        public async Task<IActionResult> AddFriend([FromBody] AddFriendDto dto)
        {
            var userId = GetUserId();
            if (!userId.HasValue) return Unauthorized();
            if (string.IsNullOrWhiteSpace(dto.UsernameOrEmail))
            {
                return BadRequest("Podaj nazwÄ™ uĹĽytkownika lub email.");
            }
            var search = dto.UsernameOrEmail.Trim();
            var targetUser = await _context.Users
                .FirstOrDefaultAsync(u => u.Username == search || u.Email == search);
            if (targetUser == null)
            {
                return NotFound("UĹĽytkownik nie zostaĹ‚ znaleziony.");
            }
            if (targetUser.Id == userId)
            {
                return BadRequest("Nie moĹĽesz dodaÄ‡ samego siebie.");
            }
            var existingFriendship = await _context.Friendships
                .FirstOrDefaultAsync(f => 
                    (f.RequesterId == userId && f.AddresseeId == targetUser.Id) ||
                    (f.RequesterId == targetUser.Id && f.AddresseeId == userId));
            if (existingFriendship != null)
            {
                if (existingFriendship.Status == FriendshipStatus.Accepted)
                {
                    return Ok(new { 
                        message = "JesteĹ›cie juĹĽ znajomymi.", 
                        friendId = targetUser.Id,
                        username = targetUser.Username,
                        alreadyFriends = true
                    });
                }
                if (existingFriendship.Status == FriendshipStatus.Pending)
                {
                    if (existingFriendship.RequesterId == userId)
                    {
                        return BadRequest("Zaproszenie juĹĽ zostaĹ‚o wysĹ‚ane.");
                    }
                    else
                    {
                        existingFriendship.Status = FriendshipStatus.Accepted;
                        await _context.SaveChangesAsync();
                        return Ok(new { 
                            message = "Zaproszenie zostaĹ‚o zaakceptowane.",
                            friendId = targetUser.Id,
                            username = targetUser.Username,
                            alreadyFriends = true
                        });
                    }
                }
            }
            var friendship = new Friendship
            {
                RequesterId = userId.Value,
                AddresseeId = targetUser.Id,
                Status = FriendshipStatus.Pending
            };
            _context.Friendships.Add(friendship);
            await _context.SaveChangesAsync();
            return Ok(new { 
                message = "Zaproszenie do znajomych zostaĹ‚o wysĹ‚ane.",
                friendId = targetUser.Id,
                username = targetUser.Username,
                avatarUrl = targetUser.AvatarUrl,
                pending = true
            });
        }
        [HttpPost("accept/{friendshipId}")]
        public async Task<IActionResult> AcceptFriend(int friendshipId)
        {
            var userId = GetUserId();
            if (!userId.HasValue) return Unauthorized();
            var friendship = await _context.Friendships
                .FirstOrDefaultAsync(f => f.Id == friendshipId && f.AddresseeId == userId);
            if (friendship == null)
            {
                return NotFound("Zaproszenie nie zostaĹ‚o znalezione.");
            }
            if (friendship.Status != FriendshipStatus.Pending)
            {
                return BadRequest("Zaproszenie nie jest w stanie oczekiwania.");
            }
            friendship.Status = FriendshipStatus.Accepted;
            await _context.SaveChangesAsync();
            return Ok(new { message = "Zaproszenie zostaĹ‚o zaakceptowane." });
        }
        [HttpDelete("{friendId}")]
        public async Task<IActionResult> RemoveFriend(int friendId)
        {
            var userId = GetUserId();
            if (!userId.HasValue) return Unauthorized();
            var friendship = await _context.Friendships
                .FirstOrDefaultAsync(f => 
                    (f.RequesterId == userId && f.AddresseeId == friendId) ||
                    (f.RequesterId == friendId && f.AddresseeId == userId));
            if (friendship == null)
            {
                friendship = await _context.Friendships.FindAsync(friendId);
                if (friendship == null || (friendship.RequesterId != userId && friendship.AddresseeId != userId))
                {
                    return NotFound("ZnajomoĹ›Ä‡ nie zostaĹ‚a znaleziona.");
                }
            }
            _context.Friendships.Remove(friendship);
            await _context.SaveChangesAsync();
            return Ok(new { message = "UsuniÄ™to." });
        }
    }
    public class AddFriendDto
    {
        public string UsernameOrEmail { get; set; } = string.Empty;
    }
}
