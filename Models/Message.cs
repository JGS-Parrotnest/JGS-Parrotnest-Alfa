using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
namespace ParrotnestServer.Models
{
    public class Message
    {
        [Key]
        public int Id { get; set; }
        [Required]
        public int SenderId { get; set; }
        [ForeignKey("SenderId")]
        public User? Sender { get; set; }
        public int? ReceiverId { get; set; }
        [ForeignKey("ReceiverId")]
        public User? Receiver { get; set; }
        public int? GroupId { get; set; }
        [ForeignKey("GroupId")]
        public Group? Group { get; set; }
        public string? Content { get; set; }
        [MaxLength(500)]
        public string? ImageUrl { get; set; }
        public DateTime Timestamp { get; set; } = DateTime.UtcNow;
    }
}
