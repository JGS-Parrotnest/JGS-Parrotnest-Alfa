using Microsoft.AspNetCore.SignalR;
using Microsoft.AspNetCore.Authorization;
using ParrotnestServer.Data;
using ParrotnestServer.Models;
using ParrotnestServer.Services;
using Microsoft.EntityFrameworkCore;
using System.Threading.Tasks;
using System.Linq;
using System;
using System.Security.Claims;
using Message = ParrotnestServer.Models.Message;
namespace ParrotnestServer.Hubs
{
    [Authorize]
    public class ChatHub : Hub
    {
        private readonly ApplicationDbContext _context;
        private readonly IUserTracker _userTracker;
        public ChatHub(ApplicationDbContext context, IUserTracker userTracker)
        {
            _context = context;
            _userTracker = userTracker;
        }
        private int? GetUserId()
        {
            var claim = Context.User?.FindFirst(ClaimTypes.NameIdentifier);
            if (claim != null && int.TryParse(claim.Value, out int userId))
            {
                return userId;
            }
            return null;
        }
        public override async Task OnConnectedAsync()
        {
            var userId = GetUserId();
            if (userId.HasValue)
            {
                await _userTracker.UserConnected(Context.ConnectionId, userId.Value);
                // Ensure reliable targeting by adding to a user-specific group
                await Groups.AddToGroupAsync(Context.ConnectionId, $"User_{userId.Value}");

                var user = await _context.Users.FindAsync(userId.Value);
                if (user != null && user.BanUntil.HasValue && user.BanUntil.Value > DateTime.UtcNow)
                {
                    Context.Abort();
                    return;
                }
                int status = (user != null && user.Status != 4) ? user.Status : 0;
                // If user is invisible (4), status broadcast is 0 (Offline)
                // However, we might want to differentiate "Invisible" vs "Offline" for the user themselves?
                // The broadcast goes to "All", so we must send 0 if invisible.
                if (user != null && user.Status == 4) status = 0;
                
                await Clients.All.SendAsync("UserStatusChanged", userId.Value, status);
            }

            try
            {
                var latest = await _context.ProductionContents
                    .AsNoTracking()
                    .OrderByDescending(p => p.UpdatedAt)
                    .FirstOrDefaultAsync();
                if (latest != null && !string.IsNullOrWhiteSpace(latest.Content))
                {
                    await Clients.Caller.SendAsync("ProductionContentUpdated", new { content = latest.Content, updatedAt = latest.UpdatedAt });
                }
            }
            catch
            {
            }
            await base.OnConnectedAsync();
        }
        public override async Task OnDisconnectedAsync(Exception? exception)
        {
            var userId = GetUserId();
            await _userTracker.UserDisconnected(Context.ConnectionId);
            if (userId.HasValue)
            {
                 bool isOnline = await _userTracker.IsUserOnline(userId.Value);
                 if (!isOnline)
                 {
                     await Clients.All.SendAsync("UserStatusChanged", userId.Value, 0);
                 }
            }
            await base.OnDisconnectedAsync(exception);
        }
        public async Task UpdateStatus(int status)
        {
            var userId = GetUserId();
            if (userId.HasValue)
            {
                var user = await _context.Users.FindAsync(userId.Value);
                if (user != null)
                {
                    user.Status = status;
                    await _context.SaveChangesAsync();
                    int broadcastStatus = (status == 4) ? 0 : status;
                    await Clients.All.SendAsync("UserStatusChanged", userId.Value, broadcastStatus);
                }
            }
        }
        private void Log(string message)
        {
            try
            {
                var logDir = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "logs");
                Directory.CreateDirectory(logDir);
                var logPath = Path.Combine(logDir, "server_log.txt");
                var logMsg = $"{DateTime.Now}: {message}\n";
                System.IO.File.AppendAllText(logPath, logMsg);
                Console.WriteLine(logMsg);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Failed to write to log: {ex.Message}");
            }
        }

        public async Task SendMessage(string user, string message, string? imageUrl = null, int? receiverId = null, int? groupId = null, int? replyToId = null)
        {
            Log($"SendMessage called. User param: {user}, Msg: {message}, Img: {imageUrl}, Rec: {receiverId}, Grp: {groupId}, Rep: {replyToId}");
            var userId = GetUserId();
            if (!userId.HasValue)
            {
                Log("SendMessage failed: User ID not found in token.");
                throw new HubException("Nie zidentyfikowano użytkownika (brak ID w tokenie).");
            }

            var sender = await _context.Users.FindAsync(userId.Value);
            if (sender == null)
            {
                Log($"SendMessage failed: User with ID {userId.Value} not found in DB.");
                throw new HubException($"Użytkownik o ID {userId.Value} nie istnieje w bazie danych.");
            }
            if (sender.MutedUntil.HasValue && sender.MutedUntil.Value > DateTime.UtcNow)
            {
                throw new HubException($"Jesteś wyciszony do {sender.MutedUntil.Value.ToLocalTime():yyyy-MM-dd HH:mm}.");
            }
            if (sender.BanUntil.HasValue && sender.BanUntil.Value > DateTime.UtcNow)
            {
                throw new HubException($"Twoje konto jest zbanowane do {sender.BanUntil.Value.ToLocalTime():yyyy-MM-dd HH:mm}.");
            }

            try 
            {
                var msg = new Message
                {
                    Content = message ?? string.Empty,
                    ImageUrl = imageUrl,
                    SenderId = sender.Id,
                    ReceiverId = receiverId,
                    GroupId = groupId,
                    ReplyToId = replyToId,
                    Timestamp = DateTime.UtcNow
                };
                
                Log($"Adding message to DB. Content length: {msg.Content.Length}");
                _context.Messages.Add(msg);
                await _context.SaveChangesAsync();
                Log($"Message saved. ID: {msg.Id}");

                // Load ReplyTo info if exists
                string? replyToSender = null;
                string? replyToContent = null;
                if (replyToId.HasValue)
                {
                    var replyMsg = await _context.Messages.Include(m => m.Sender).FirstOrDefaultAsync(m => m.Id == replyToId.Value);
                    if (replyMsg != null)
                    {
                        replyToSender = replyMsg.Sender?.Username;
                        replyToContent = replyMsg.Content;
                    }
                }

                var response = new
                {
                    Id = msg.Id,
                    Content = msg.Content,
                    Sender = sender.Username,
                    SenderId = sender.Id,
                    SenderAvatarUrl = sender.AvatarUrl,
                    ReceiverId = msg.ReceiverId,
                    GroupId = msg.GroupId,
                    Timestamp = msg.Timestamp,
                    ImageUrl = msg.ImageUrl,
                    ReplyToId = msg.ReplyToId,
                    ReplyToSender = replyToSender,
                    ReplyToContent = replyToContent,
                    Reactions = (string?)null
                };

                Log($"Broadcasting message. GroupId: {groupId}, ReceiverId: {receiverId}");

                if (groupId.HasValue)
                {
                    await Clients.Group($"Group_{groupId.Value}").SendAsync("ReceiveMessage", response);
                }
                else if (receiverId.HasValue)
                {
                        await Clients.Group($"User_{receiverId.Value}").SendAsync("ReceiveMessage", response);
                        await Clients.Group($"User_{sender.Id}").SendAsync("ReceiveMessage", response);
                }
                else
                {
                    // Global chat
                    await Clients.All.SendAsync("ReceiveMessage", response);
                }
                Log("Message broadcast completed.");
            }
            catch (Exception ex)
            {
                Log($"Error in SendMessage: {ex.Message}\nStack: {ex.StackTrace}");
                if (ex.InnerException != null)
                {
                     Log($"Inner Exception: {ex.InnerException.Message}");
                }
                throw new HubException($"Błąd serwera podczas wysyłania wiadomości: {ex.Message}");
            }
        }

        public async Task ReactToMessage(int messageId, string emoji)
        {
            Log($"ReactToMessage called. MsgId: {messageId}, Emoji: {emoji}");
            var userId = GetUserId();
            if (!userId.HasValue) 
            {
                Log("ReactToMessage failed: User ID not found.");
                throw new HubException("Nie można zidentyfikować użytkownika.");
            }
            
            var msg = await _context.Messages.FindAsync(messageId);
            if (msg == null) 
            {
                Log($"ReactToMessage failed: Message {messageId} not found.");
                throw new HubException("Wiadomość nie istnieje.");
            }

            var reactingUser = await _context.Users.FindAsync(userId.Value);
            if (reactingUser != null && reactingUser.MutedUntil.HasValue && reactingUser.MutedUntil.Value > DateTime.UtcNow)
            {
                throw new HubException($"Jesteś wyciszony do {reactingUser.MutedUntil.Value.ToLocalTime():yyyy-MM-dd HH:mm}.");
            }

            try
            {
                // Simple JSON manipulation
                var reactions = new System.Collections.Generic.List<ReactionItem>();
                if (!string.IsNullOrEmpty(msg.Reactions))
                {
                    try { reactions = System.Text.Json.JsonSerializer.Deserialize<System.Collections.Generic.List<ReactionItem>>(msg.Reactions) ?? new(); } catch {}
                }

                // Toggle reaction
                var existing = reactions.FirstOrDefault(r => r.u == userId.Value && r.e == emoji);
                if (existing != null)
                {
                    reactions.Remove(existing);
                }
                else
                {
                    reactions.Add(new ReactionItem { u = userId.Value, e = emoji });
                }

                msg.Reactions = System.Text.Json.JsonSerializer.Serialize(reactions);
                await _context.SaveChangesAsync();

                // Broadcast update
                if (msg.GroupId.HasValue)
                {
                    await Clients.Group($"Group_{msg.GroupId.Value}").SendAsync("MessageReactionUpdated", messageId, msg.Reactions);
                }
                else if (msg.ReceiverId.HasValue)
                {
                    await Clients.Group($"User_{msg.ReceiverId.Value}").SendAsync("MessageReactionUpdated", messageId, msg.Reactions);
                    await Clients.Group($"User_{msg.SenderId}").SendAsync("MessageReactionUpdated", messageId, msg.Reactions);
                }
                else
                {
                    // Global chat
                    await Clients.All.SendAsync("MessageReactionUpdated", messageId, msg.Reactions);
                }
                Log("ReactToMessage completed.");
            }
            catch (Exception ex)
            {
                 Log($"Error in ReactToMessage: {ex.Message}");
                 throw new HubException($"Błąd serwera podczas dodawania reakcji: {ex.Message}");
            }
        }

        public class ReactionItem
        {
            public int u { get; set; } // UserId
            public string? e { get; set; } // Emoji
        }
        public async Task JoinGroup(string groupName)
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, groupName);
            await Clients.Group(groupName).SendAsync("ReceiveMessage", "System", $"{Context.User?.Identity?.Name} joined {groupName}");
        }
    }
}
