using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ParrotnestServer.Data;
using ParrotnestServer.Models;
using System.Security.Claims;
using Message = ParrotnestServer.Models.Message;
namespace ParrotnestServer.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class MessagesController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly IWebHostEnvironment _environment;
        private readonly IConfiguration _configuration;
        public MessagesController(ApplicationDbContext context, IWebHostEnvironment environment, IConfiguration configuration)
        {
            _context = context;
            _environment = environment;
            _configuration = configuration;
        }
        [HttpGet]
        public async Task<ActionResult<IEnumerable<object>>> GetMessages([FromQuery] int? receiverId = null, [FromQuery] int? groupId = null)
        {
            try
            {
                var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "0");
                IQueryable<Message> query = _context.Messages.Include(m => m.Sender).Include(m => m.Receiver);
                if (groupId.HasValue)
                {
                    var isMember = await _context.GroupMembers.AnyAsync(gm => gm.GroupId == groupId.Value && gm.UserId == userId);
                    if (!isMember) return Unauthorized("Nie jesteś członkiem tej grupy.");
                    query = query.Where(m => m.GroupId == groupId.Value);
                }
                else if (receiverId.HasValue)
                {
                    query = query.Where(m => 
                        m.GroupId == null && 
                        m.Sender != null &&
                        ((m.SenderId == userId && m.ReceiverId == receiverId) ||
                         (m.SenderId == receiverId && m.ReceiverId == userId)));
                }
                else
                {
                    query = query.Where(m => m.GroupId == null && m.ReceiverId == null && m.Sender != null);
                }
                var messages = await query
                    .OrderByDescending(m => m.Timestamp)
                    .Take(100)
                    .OrderBy(m => m.Timestamp)
                    .Select(m => new 
                    {
                        Id = m.Id,
                        Content = m.Content ?? string.Empty,
                        Sender = m.Sender != null ? m.Sender.Username : "Nieznany",
                        SenderId = m.SenderId,
                        SenderAvatarUrl = m.Sender != null ? m.Sender.AvatarUrl : null,
                        ReceiverId = m.ReceiverId,
                        Timestamp = m.Timestamp,
                        ImageUrl = m.ImageUrl
                    })
                    .ToListAsync();
                return Ok(messages);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = "Błąd podczas pobierania wiadomości", message = ex.Message });
            }
        }
        [HttpPost("upload")]
        public async Task<IActionResult> UploadImage(IFormFile file)
        {
            if (file == null || file.Length == 0)
                return BadRequest("Nie wybrano pliku.");
            var allowedExtensions = new[] { ".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp" };
            var fileExtension = Path.GetExtension(file.FileName).ToLower();
            if (!allowedExtensions.Contains(fileExtension))
                return BadRequest("Dozwolone są tylko pliki obrazów (PNG, JPG, JPEG, GIF, WEBP, BMP).");
            var clientPath = _configuration["ClientPath"] ?? Path.Combine(_environment.ContentRootPath, "..", "Client");
            var uploadsFolder = Path.Combine(clientPath, "uploads");
            if (!Directory.Exists(uploadsFolder))
                Directory.CreateDirectory(uploadsFolder);
            var fileName = Guid.NewGuid().ToString() + fileExtension;
            var filePath = Path.Combine(uploadsFolder, fileName);
            using (var stream = new FileStream(filePath, FileMode.Create))
            {
                await file.CopyToAsync(stream);
            }
            var fileUrl = $"/uploads/{fileName}";
            return Ok(new { url = fileUrl });
        }
    }
}
