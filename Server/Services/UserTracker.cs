using System.Collections.Concurrent;
namespace ParrotnestServer.Services
{
    public interface IUserTracker
    {
        Task UserConnected(string connectionId, int userId);
        Task UserDisconnected(string connectionId);
        Task<int[]> GetOnlineUsers();
        Task<bool> IsUserOnline(int userId);
    }
    public class UserTracker : IUserTracker
    {
        private readonly ConcurrentDictionary<string, int> _connections = new();
        private readonly ConcurrentDictionary<int, int> _userConnections = new();
        public Task UserConnected(string connectionId, int userId)
        {
            _connections.TryAdd(connectionId, userId);
            _userConnections.AddOrUpdate(userId, 1, (key, count) => count + 1);
            return Task.CompletedTask;
        }
        public Task UserDisconnected(string connectionId)
        {
            if (_connections.TryRemove(connectionId, out int userId))
            {
                _userConnections.AddOrUpdate(userId, 0, (key, count) => Math.Max(0, count - 1));
                if (_userConnections.TryGetValue(userId, out int count) && count == 0)
                {
                    _userConnections.TryRemove(userId, out _);
                }
            }
            return Task.CompletedTask;
        }
        public Task<int[]> GetOnlineUsers()
        {
            return Task.FromResult(_userConnections.Keys.ToArray());
        }
        public Task<bool> IsUserOnline(int userId)
        {
            return Task.FromResult(_userConnections.ContainsKey(userId));
        }
    }
}
