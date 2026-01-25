using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.StaticFiles;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.IdentityModel.Tokens;
using ParrotnestServer.Data;
using ParrotnestServer.Hubs;
using ParrotnestServer.Services;
using System.Text;
namespace ParrotnestServer
{
    public class ServerHost
    {
        private WebApplication? _app;
        private readonly Action<string> _logAction;
        public ServerHost(Action<string> logAction)
        {
            _logAction = logAction;
        }
        public async Task StartAsync()
        {
            try
            {
                var builder = WebApplication.CreateBuilder(new string[] { });
                builder.Logging.ClearProviders();
                builder.Logging.AddProvider(new GuiLoggerProvider(_logAction));
                builder.Services.AddControllers();
                builder.Services.AddEndpointsApiExplorer();
                builder.Services.AddSwaggerGen();
                builder.Services.AddSignalR();
                builder.Services.AddSingleton<IUserTracker, UserTracker>();
                var dbPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "parrotnest.db");
                var connectionString = $"Data Source={dbPath}";
                builder.Services.AddDbContext<ApplicationDbContext>(options =>
                    options.UseSqlite(connectionString));
                var jwtKey = builder.Configuration["Jwt:Key"] ?? "SuperSecretKeyForParrotnestApplication123!";
                builder.Services.AddAuthentication(options =>
                {
                    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
                    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
                })
                .AddJwtBearer(options =>
                {
                    options.TokenValidationParameters = new TokenValidationParameters
                    {
                        ValidateIssuer = false,
                        ValidateAudience = false,
                        ValidateLifetime = true,
                        ValidateIssuerSigningKey = true,
                        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey))
                    };
                    options.Events = new JwtBearerEvents
                    {
                        OnMessageReceived = context =>
                        {
                            var accessToken = context.Request.Query["access_token"];
                            var path = context.HttpContext.Request.Path;
                            if (!string.IsNullOrEmpty(accessToken) && path.StartsWithSegments("/chatHub"))
                            {
                                context.Token = accessToken;
                            }
                            return Task.CompletedTask;
                        }
                    };
                });
                builder.Services.AddCors(options =>
                {
                    options.AddPolicy("AllowAll", builder =>
                    {
                        builder.AllowAnyOrigin()
                               .AllowAnyMethod()
                               .AllowAnyHeader();
                    });
                });
                _app = builder.Build();
                using (var scope = _app.Services.CreateScope())
                {
                    var dbContext = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
                    dbContext.Database.EnsureCreated();
                    try {
                        dbContext.Database.ExecuteSqlRaw("ALTER TABLE Users ADD COLUMN Status INTEGER DEFAULT 1;");
                    } catch { /* Ignore if exists */ }
                }
                _app.Urls.Clear();
                _app.Urls.Add("http://0.0.0.0:6069");
                if (_app.Environment.IsDevelopment())
                {
                    _app.UseSwagger();
                    _app.UseSwaggerUI();
                }
                _app.UseCors("AllowAll");
                string GetClientPath(string startPath)
                {
                    var current = startPath;
                    for (int i = 0; i < 8; i++)
                    {
                        var client = Path.Combine(current, "Client");
                        if (Directory.Exists(client)) return Path.GetFullPath(client);
                        var parent = Directory.GetParent(current);
                        if (parent == null) break;
                        current = parent.FullName;
                    }
                    return Path.GetFullPath(Path.Combine(startPath, "..", "Client"));
                }
                var clientPath = GetClientPath(builder.Environment.ContentRootPath);
                builder.Configuration["ClientPath"] = clientPath;
                if (Directory.Exists(clientPath))
                {
                    var fileProvider = new Microsoft.Extensions.FileProviders.PhysicalFileProvider(clientPath);
                    var defaultFilesOptions = new DefaultFilesOptions { FileProvider = fileProvider };
                    defaultFilesOptions.DefaultFileNames.Clear();
                    defaultFilesOptions.DefaultFileNames.Add("index.php");
                    defaultFilesOptions.DefaultFileNames.Add("login.php");
                    _app.UseDefaultFiles(defaultFilesOptions);
                    var provider = new FileExtensionContentTypeProvider();
                    provider.Mappings[".php"] = "text/html; charset=utf-8";
                    provider.Mappings[".mp3"] = "audio/mpeg";
                    _app.UseStaticFiles(new StaticFileOptions
                    {
                        FileProvider = fileProvider,
                        ContentTypeProvider = provider
                    });
                }
                else
                {
                    _logAction($"Warning: Client directory not found at {clientPath}");
                    _app.UseStaticFiles();
                }
                _app.UseAuthentication();
                _app.UseAuthorization();
                _app.MapControllers();
                _app.MapHub<ChatHub>("/chatHub");
                _logAction("Serwer uruchamiany...");
                await _app.StartAsync();
                _logAction($"Serwer działa na: {_app.Urls.FirstOrDefault()}");
            }
            catch (Exception ex)
            {
                _logAction($"Błąd krytyczny startu: {ex.Message}");
                throw;
            }
        }
        public async Task StopAsync()
        {
            if (_app != null)
            {
                _logAction("Zatrzymywanie serwera...");
                await _app.StopAsync();
                await _app.DisposeAsync();
                _app = null;
                _logAction("Serwer zatrzymany.");
            }
        }
    }
    public class GuiLoggerProvider : ILoggerProvider
    {
        private readonly Action<string> _logAction;
        public GuiLoggerProvider(Action<string> logAction) => _logAction = logAction;
        public ILogger CreateLogger(string categoryName) => new GuiLogger(categoryName, _logAction);
        public void Dispose() { }
    }
    public class GuiLogger : ILogger
    {
        private readonly string _categoryName;
        private readonly Action<string> _logAction;
        public GuiLogger(string categoryName, Action<string> logAction)
        {
            _categoryName = categoryName;
            _logAction = logAction;
        }
        public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;
        public bool IsEnabled(LogLevel logLevel) => logLevel >= LogLevel.Information;
        public void Log<TState>(LogLevel logLevel, EventId eventId, TState state, Exception? exception, Func<TState, Exception?, string> formatter)
        {
            var message = formatter(state, exception);
            if (!string.IsNullOrEmpty(message))
            {
                if (_categoryName.StartsWith("Microsoft.AspNetCore.Hosting"))
                    _logAction($"[{DateTime.Now:HH:mm:ss}] {message}");
            }
        }
    }
}
