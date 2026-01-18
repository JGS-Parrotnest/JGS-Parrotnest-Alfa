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
                var user = await _context.Users.FindAsync(userId.Value);
                int status = (user != null && user.Status != 4) ? user.Status : 0;
                // If user is invisible (4), status broadcast is 0 (Offline)
                // However, we might want to differentiate "Invisible" vs "Offline" for the user themselves?
                // The broadcast goes to "All", so we must send 0 if invisible.
                if (user != null && user.Status == 4) status = 0;
                
                await Clients.All.SendAsync("UserStatusChanged", userId.Value, status);
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
        public async Task SendMessage(string user, string message, string? imageUrl = null, int? receiverId = null, int? groupId = null)
        {
            Console.WriteLine($"[ChatHub] SendMessage called by {Context.User?.Identity?.Name}. Msg: {message}, Img: {imageUrl}, Rec: {receiverId}, Grp: {groupId}");
            try 
            {
                var senderUsername = Context.User?.Identity?.Name;
                var sender = await _context.Users.FirstOrDefaultAsync(u => u.Username == senderUsername);
                if (sender != null)
                {
                    Console.WriteLine($"[ChatHub] Sender found: {sender.Id} ({sender.Username})");
                    var msg = new Message
                    {
                        Content = message ?? string.Empty,
                        ImageUrl = imageUrl,
                        SenderId = sender.Id,
                        ReceiverId = receiverId,
                        GroupId = groupId,
                        Timestamp = DateTime.UtcNow
                    };
                    Console.WriteLine("[ChatHub] Saving message to DB...");
                    _context.Messages.Add(msg);
                    await _context.SaveChangesAsync();
                    Console.WriteLine($"[ChatHub] Message saved. ID: {msg.Id}");
                    if (groupId.HasValue)
                    {
                        var members = await _context.GroupMembers
                            .Where(gm => gm.GroupId == groupId.Value)
                            .Select(gm => gm.UserId)
                            .ToListAsync();
                        foreach (var memberId in members)
                        {
                            await Clients.User(memberId.ToString()).SendAsync(
                                "ReceiveMessage",
                                sender.Id,
                                senderUsername,
                                message ?? string.Empty,
                                imageUrl,
                                receiverId,
                                groupId,
                                sender.AvatarUrl
                            );
                        }
                    }
                    else if (receiverId.HasValue)
                    {
                        var receiver = await _context.Users.FindAsync(receiverId.Value);
                        if (receiver != null)
                        {
                            await Clients.User(sender.Id.ToString()).SendAsync(
                                "ReceiveMessage",
                                sender.Id,
                                senderUsername,
                                message ?? string.Empty,
                                imageUrl,
                                receiverId,
                                null,
                                sender.AvatarUrl
                            );
                            await Clients.User(receiverId.Value.ToString()).SendAsync(
                                "ReceiveMessage",
                                sender.Id,
                                senderUsername,
                                message ?? string.Empty,
                                imageUrl,
                                receiverId,
                                null,
                                sender.AvatarUrl
                            );
                        }
                    }
                    else
                    {
                        await Clients.All.SendAsync(
                            "ReceiveMessage",
                            sender.Id,
                            senderUsername,
                            message ?? string.Empty,
                            imageUrl,
                            null,
                            null,
                            sender.AvatarUrl
                        );
                    }
                }
                else
                {
                    Console.WriteLine($"[ChatHub] Sender NOT found for username: {senderUsername}");
                    await Clients.Caller.SendAsync("ReceiveMessage", 0, "System", "Błąd: Nie znaleziono użytkownika. Zaloguj się ponownie.", null, null, null);
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error sending message: {ex.Message}");
                Console.WriteLine(ex.StackTrace);
                await Clients.Caller.SendAsync("ReceiveMessage", 0, "System", $"Błąd wysyłania wiadomości: {ex.Message}", null, null, null);
            }
        }
        public async Task JoinGroup(string groupName)
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, groupName);
            await Clients.Group(groupName).SendAsync("ReceiveMessage", "System", $"{Context.User?.Identity?.Name} joined {groupName}");
        }
    }
}
