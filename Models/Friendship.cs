using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
namespace ParrotnestServer.Models
{
    public enum FriendshipStatus
    {
        Pending,
        Accepted,
        Blocked
    }
    public class Friendship
    {
        [Key]
        public int Id { get; set; }
        [Required]
        public int RequesterId { get; set; }
        [ForeignKey("RequesterId")]
        public User? Requester { get; set; }
        [Required]
        public int AddresseeId { get; set; }
        [ForeignKey("AddresseeId")]
        public User? Addressee { get; set; }
        [Column(TypeName = "nvarchar(20)")]
        public FriendshipStatus Status { get; set; } = FriendshipStatus.Pending;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
