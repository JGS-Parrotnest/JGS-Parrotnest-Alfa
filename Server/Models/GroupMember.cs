using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
namespace ParrotnestServer.Models
{
    public class GroupMember
    {
        [Key]
        public int Id { get; set; }
        [Required]
        public int GroupId { get; set; }
        [ForeignKey("GroupId")]
        public Group? Group { get; set; }
        [Required]
        public int UserId { get; set; }
        [ForeignKey("UserId")]
        public User? User { get; set; }
        public DateTime JoinedAt { get; set; } = DateTime.UtcNow;
    }
}
