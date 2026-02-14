using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
namespace ParrotnestServer.Models
{
    public class AdminActionLog
    {
        [Key]
        public int Id { get; set; }
        public int PerformedByUserId { get; set; }
        [ForeignKey(nameof(PerformedByUserId))]
        public User? PerformedByUser { get; set; }
        public int? TargetUserId { get; set; }
        [ForeignKey(nameof(TargetUserId))]
        public User? TargetUser { get; set; }
        [MaxLength(50)]
        public string ActionType { get; set; } = string.Empty; // ban | unban | mute | unmute | delete_user | clear_global
        [MaxLength(500)]
        public string? Reason { get; set; }
        public int? DurationMinutes { get; set; }
        public DateTime Timestamp { get; set; } = DateTime.UtcNow;
        [MaxLength(500)]
        public string? Details { get; set; }
        public bool Success { get; set; } = true;
    }
}
