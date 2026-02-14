using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ParrotnestServer.Models
{
    public class GeneralChannelSettings
    {
        [Key]
        public int Id { get; set; } = 1;

        public int OwnerId { get; set; }

        [ForeignKey("OwnerId")]
        public User? Owner { get; set; }

        [MaxLength(100)]
        public string Name { get; set; } = "Ogólny";

        public string? AvatarUrl { get; set; }

        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    }
}

