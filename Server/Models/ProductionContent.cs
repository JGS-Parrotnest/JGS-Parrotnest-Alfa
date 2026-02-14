namespace ParrotnestServer.Models
{
    public class ProductionContent
    {
        public int Id { get; set; }
        public string Content { get; set; } = string.Empty;
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    }
}

