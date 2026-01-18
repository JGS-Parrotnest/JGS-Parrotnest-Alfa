using System.ComponentModel.DataAnnotations;
namespace ParrotnestServer.Models
{
    public class User
    {
        public int Id { get; set; }
        [Required]
        [MaxLength(50)]
        public string Username { get; set; } = string.Empty;
        [Required]
        [EmailAddress]
        [MaxLength(100)]
        public string Email { get; set; } = string.Empty;
        [Required]
        public string PasswordHash { get; set; } = string.Empty;
        public string? AvatarUrl { get; set; }
        public int Status { get; set; } = 1; // 1=Active, 2=Away, 3=DND, 4=Invisible
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
