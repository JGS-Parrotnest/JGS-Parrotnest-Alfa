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
using System.Diagnostics;
using System.Text;
using System.Linq;
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
                var builder = WebApplication.CreateBuilder(new WebApplicationOptions
                {
                    Args = Array.Empty<string>(),
                    ApplicationName = typeof(ServerHost).Assembly.GetName().Name
                });
                builder.Logging.ClearProviders();
                builder.Logging.AddProvider(new GuiLoggerProvider(_logAction));
                builder.Services.AddControllers();
                builder.Services.AddEndpointsApiExplorer();
                builder.Services.AddSwaggerGen();
                builder.Services.AddSignalR(hubOptions =>
                {
                    hubOptions.EnableDetailedErrors = true;
                });
                builder.Services.AddSingleton<IUserTracker, UserTracker>();
                string ResolveDbPath(string contentRootPath)
                {
                    var overridePath = Environment.GetEnvironmentVariable("PARROTNEST_DB_PATH");
                    if (!string.IsNullOrWhiteSpace(overridePath)) return overridePath;

                    var appDataDir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "ParrotnestServer");
                    Directory.CreateDirectory(appDataDir);
                    var preferred = Path.Combine(appDataDir, "parrotnest.db");
                    var preferAppDataEnv = Environment.GetEnvironmentVariable("PARROTNEST_DB_PREFER_APPDATA");
                    var preferAppData = preferAppDataEnv == "1" || string.Equals(preferAppDataEnv, "true", StringComparison.OrdinalIgnoreCase);

                    var candidates = new List<string>
                    {
                        Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "parrotnest.db"),
                        Path.Combine(contentRootPath, "parrotnest.db"),
                    };

                    try
                    {
                        var probe = AppDomain.CurrentDomain.BaseDirectory;
                        for (int i = 0; i < 8; i++)
                        {
                            candidates.Add(Path.Combine(probe, "Server", "bin", "Debug", "net10.0-windows", "parrotnest.db"));
                            candidates.Add(Path.Combine(probe, "Server", "bin", "Release", "net10.0-windows", "parrotnest.db"));
                            var parent = Directory.GetParent(probe);
                            if (parent == null) break;
                            probe = parent.FullName;
                        }
                    }
                    catch
                    {
                    }

                    var uniqueCandidates = candidates
                        .Where(p => !string.IsNullOrWhiteSpace(p))
                        .Distinct(StringComparer.OrdinalIgnoreCase)
                        .ToList();

                    var existing = new List<(string Path, long Size, DateTime LastWriteUtc)>();
                    foreach (var p in uniqueCandidates)
                    {
                        try
                        {
                            if (!File.Exists(p)) continue;
                            var info = new FileInfo(p);
                            existing.Add((p, info.Length, info.LastWriteTimeUtc));
                        }
                        catch
                        {
                        }
                    }

                    if (preferAppData && File.Exists(preferred)) return preferred;
                    if (existing.Count > 0)
                    {
                        var best = existing
                            .OrderByDescending(e => e.Size)
                            .ThenByDescending(e => e.LastWriteUtc)
                            .First();
                        return best.Path;
                    }

                    return preferAppData ? preferred : Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "parrotnest.db");
                }

                var dbPath = ResolveDbPath(builder.Environment.ContentRootPath);
                builder.Configuration["DbPath"] = dbPath;
                builder.Configuration["DbPreferredPath"] = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "ParrotnestServer", "parrotnest.db");
                builder.Configuration["DbBaseDirPath"] = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "parrotnest.db");
                var connectionString = $"Data Source={dbPath};Cache=Shared;Foreign Keys=True";
                builder.Services.AddDbContext<ApplicationDbContext>(options =>
                {
                    options.UseSqlite(connectionString);
                });
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
                var verboseEnv = Environment.GetEnvironmentVariable("PARROTNEST_VERBOSE");
                var isVerbose = verboseEnv == "1" || string.Equals(verboseEnv, "true", StringComparison.OrdinalIgnoreCase);
                var buildId = DateTime.UtcNow.ToString("yyyyMMdd-HHmmss");
                var logsDir = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "logs");
                Directory.CreateDirectory(logsDir);
                var httpLogPath = Path.Combine(logsDir, "http.log");
                void AppendHttpLog(string line)
                {
                    try
                    {
                        File.AppendAllText(httpLogPath, line + Environment.NewLine, Encoding.UTF8);
                    }
                    catch
                    {
                    }
                }
                AppendHttpLog($"[{DateTime.Now:yyyy-MM-dd HH:mm:ss.fff}] server_start build={buildId} base={AppDomain.CurrentDomain.BaseDirectory}");
                _app.Use(async (ctx, next) =>
                {
                    ctx.Response.Headers["X-Parrotnest-Build"] = buildId;
                    ctx.Response.Headers["X-Parrotnest-Verbose"] = isVerbose ? "1" : "0";

                    var sw = Stopwatch.StartNew();
                    var path = ctx.Request.Path.Value ?? string.Empty;
                    var method = ctx.Request.Method;
                    var abortedBefore = ctx.RequestAborted.IsCancellationRequested;

                    try
                    {
                        await next();
                    }
                    catch (Exception ex)
                    {
                        sw.Stop();
                        AppendHttpLog($"[{DateTime.Now:yyyy-MM-dd HH:mm:ss.fff}] {method} {path} status=500 ms={sw.ElapsedMilliseconds} aborted_before={abortedBefore} aborted_after={ctx.RequestAborted.IsCancellationRequested} ex={ex.GetType().Name} msg={ex.Message}");
                        throw;
                    }
                    finally
                    {
                        sw.Stop();
                        var status = ctx.Response?.StatusCode ?? 0;
                        var abortedAfter = ctx.RequestAborted.IsCancellationRequested;
                        if (isVerbose || path.StartsWith("/api/Users/all", StringComparison.OrdinalIgnoreCase))
                        {
                            AppendHttpLog($"[{DateTime.Now:yyyy-MM-dd HH:mm:ss.fff}] {method} {path} status={status} ms={sw.ElapsedMilliseconds} aborted_before={abortedBefore} aborted_after={abortedAfter}");
                        }
                    }
                });
                using (var scope = _app.Services.CreateScope())
                {
                    var dbContext = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
                    try
                    {
                        dbContext.Database.EnsureCreated();
                    }
                    catch (Exception ex)
                    {
                        _logAction($"[DB Error] EnsureCreated failed: {ex.Message}");
                    }
                    
                    // Enable WAL mode for better multi-user concurrency
                    try { dbContext.Database.ExecuteSqlRaw("PRAGMA journal_mode=WAL;"); } catch (Exception ex) { _logAction($"[DB Warning] WAL: {ex.Message}"); }
                    try { dbContext.Database.ExecuteSqlRaw("PRAGMA foreign_keys=ON;"); } catch (Exception ex) { _logAction($"[DB Warning] FK: {ex.Message}"); }
                    try { dbContext.Database.ExecuteSqlRaw("CREATE INDEX IF NOT EXISTS IX_Messages_Timestamp ON Messages(Timestamp);"); } catch (Exception ex) { _logAction($"[DB Warning] IX_Messages_Timestamp: {ex.Message}"); }
                    try { dbContext.Database.ExecuteSqlRaw("CREATE INDEX IF NOT EXISTS IX_Messages_SenderId ON Messages(SenderId);"); } catch (Exception ex) { _logAction($"[DB Warning] IX_Messages_SenderId: {ex.Message}"); }
                    try { dbContext.Database.ExecuteSqlRaw("CREATE INDEX IF NOT EXISTS IX_Messages_ReceiverId ON Messages(ReceiverId);"); } catch (Exception ex) { _logAction($"[DB Warning] IX_Messages_ReceiverId: {ex.Message}"); }
                    try { dbContext.Database.ExecuteSqlRaw("CREATE INDEX IF NOT EXISTS IX_Messages_GroupId ON Messages(GroupId);"); } catch (Exception ex) { _logAction($"[DB Warning] IX_Messages_GroupId: {ex.Message}"); }
                    try { dbContext.Database.ExecuteSqlRaw("CREATE INDEX IF NOT EXISTS IX_Friendships_RequesterId_Status ON Friendships(RequesterId, Status);"); } catch (Exception ex) { _logAction($"[DB Warning] IX_Friendships_RequesterId_Status: {ex.Message}"); }
                    try { dbContext.Database.ExecuteSqlRaw("CREATE INDEX IF NOT EXISTS IX_Friendships_AddresseeId_Status ON Friendships(AddresseeId, Status);"); } catch (Exception ex) { _logAction($"[DB Warning] IX_Friendships_AddresseeId_Status: {ex.Message}"); }
                    try { dbContext.Database.ExecuteSqlRaw("CREATE INDEX IF NOT EXISTS IX_GroupMembers_GroupId ON GroupMembers(GroupId);"); } catch (Exception ex) { _logAction($"[DB Warning] IX_GroupMembers_GroupId: {ex.Message}"); }
                    try { dbContext.Database.ExecuteSqlRaw("CREATE INDEX IF NOT EXISTS IX_GroupMembers_UserId ON GroupMembers(UserId);"); } catch (Exception ex) { _logAction($"[DB Warning] IX_GroupMembers_UserId: {ex.Message}"); }

                    try
                    {
                        dbContext.Database.ExecuteSqlRaw(@"CREATE TABLE IF NOT EXISTS ProductionContents (
    Id INTEGER NOT NULL CONSTRAINT PK_ProductionContents PRIMARY KEY AUTOINCREMENT,
    Content TEXT NOT NULL,
    UpdatedAt TEXT NOT NULL
);");
                    }
                    catch (Exception ex)
                    {
                        _logAction($"[DB Warning] ProductionContents: {ex.Message}");
                    }

                    try
                    {
                        dbContext.Database.ExecuteSqlRaw(@"CREATE TABLE IF NOT EXISTS GeneralChannelSettings (
    Id INTEGER NOT NULL CONSTRAINT PK_GeneralChannelSettings PRIMARY KEY,
    OwnerId INTEGER NOT NULL,
    Name TEXT NOT NULL,
    AvatarUrl TEXT NULL,
    UpdatedAt TEXT NOT NULL,
    CONSTRAINT FK_GeneralChannelSettings_Users_OwnerId FOREIGN KEY (OwnerId) REFERENCES Users(Id) ON DELETE RESTRICT
);");
                    }
                    catch (Exception ex)
                    {
                        _logAction($"[DB Warning] GeneralChannelSettings: {ex.Message}");
                    }

                    try
                    {
                        dbContext.Database.ExecuteSqlRaw(@"CREATE TABLE IF NOT EXISTS AdminActionLogs (
    Id INTEGER NOT NULL CONSTRAINT PK_AdminActionLogs PRIMARY KEY AUTOINCREMENT,
    PerformedByUserId INTEGER NOT NULL,
    TargetUserId INTEGER NULL,
    ActionType TEXT NOT NULL,
    Reason TEXT NULL,
    DurationMinutes INTEGER NULL,
    Timestamp TEXT NOT NULL,
    Details TEXT NULL,
    Success INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT FK_AdminActionLogs_PerformedBy FOREIGN KEY (PerformedByUserId) REFERENCES Users(Id) ON DELETE RESTRICT,
    CONSTRAINT FK_AdminActionLogs_Target FOREIGN KEY (TargetUserId) REFERENCES Users(Id) ON DELETE CASCADE
);");
                    }
                    catch (Exception ex)
                    {
                        _logAction($"[DB Warning] AdminActionLogs: {ex.Message}");
                    }
                    
                    try {
                        dbContext.Database.ExecuteSqlRaw("ALTER TABLE Users ADD COLUMN Status INTEGER DEFAULT 1;");
                    } catch (Exception ex) { if (!ex.Message.Contains("duplicate column name")) _logAction($"[DB Warning] Status: {ex.Message}"); }
                    try {
                        dbContext.Database.ExecuteSqlRaw("ALTER TABLE Users ADD COLUMN MutedUntil TEXT NULL;");
                    } catch (Exception ex) { if (!ex.Message.Contains("duplicate column name")) _logAction($"[DB Warning] MutedUntil: {ex.Message}"); }
                    try {
                        dbContext.Database.ExecuteSqlRaw("ALTER TABLE Users ADD COLUMN Theme TEXT DEFAULT 'original';");
                    } catch (Exception ex) { if (!ex.Message.Contains("duplicate column name")) _logAction($"[DB Warning] Theme: {ex.Message}"); }
                    try {
                        dbContext.Database.ExecuteSqlRaw("ALTER TABLE Users ADD COLUMN TextSize TEXT DEFAULT 'medium';");
                    } catch (Exception ex) { if (!ex.Message.Contains("duplicate column name")) _logAction($"[DB Warning] TextSize: {ex.Message}"); }
                    try {
                        dbContext.Database.ExecuteSqlRaw("ALTER TABLE Users ADD COLUMN IsSimpleText INTEGER DEFAULT 0;");
                    } catch (Exception ex) { if (!ex.Message.Contains("duplicate column name")) _logAction($"[DB Warning] IsSimpleText: {ex.Message}"); }
                    try {
                        dbContext.Database.ExecuteSqlRaw("ALTER TABLE Users ADD COLUMN IsAdmin INTEGER DEFAULT 0;");
                    } catch (Exception ex) { if (!ex.Message.Contains("duplicate column name")) _logAction($"[DB Warning] IsAdmin: {ex.Message}"); }
                    try {
                        dbContext.Database.ExecuteSqlRaw("ALTER TABLE Users ADD COLUMN BanUntil TEXT NULL;");
                    } catch (Exception ex) { if (!ex.Message.Contains("duplicate column name")) _logAction($"[DB Warning] BanUntil: {ex.Message}"); }
                    try {
                        dbContext.Database.ExecuteSqlRaw("ALTER TABLE Messages ADD COLUMN ReplyToId INTEGER NULL;");
                    } catch (Exception ex) { if (!ex.Message.Contains("duplicate column name")) _logAction($"[DB Warning] ReplyToId: {ex.Message}"); }
                    try {
                        dbContext.Database.ExecuteSqlRaw("ALTER TABLE Messages ADD COLUMN Reactions TEXT NULL;");
                    } catch (Exception ex) { if (!ex.Message.Contains("duplicate column name")) _logAction($"[DB Warning] Reactions: {ex.Message}"); }
                    try {
                        dbContext.Database.ExecuteSqlRaw("ALTER TABLE Messages ADD COLUMN ImageUrl TEXT NULL;");
                    } catch (Exception ex) { if (!ex.Message.Contains("duplicate column name")) _logAction($"[DB Warning] ImageUrl: {ex.Message}"); }
                    try
                    {
                        var adminByUsername = dbContext.Users.FirstOrDefault(u => u.Username.ToLower() == "admin");
                        var adminByEmail = dbContext.Users.FirstOrDefault(u => u.Email.ToLower() == "admin@zse.pl");
                        if (adminByUsername == null && adminByEmail == null)
                        {
                            var adminUser = new ParrotnestServer.Models.User
                            {
                                Username = "admin",
                                Email = "admin@zse.pl",
                                PasswordHash = BCrypt.Net.BCrypt.HashPassword("skyadmin"),
                                IsAdmin = true,
                                Status = 1,
                                Theme = "original",
                                TextSize = "medium",
                                IsSimpleText = false
                            };
                            dbContext.Users.Add(adminUser);
                            dbContext.SaveChanges();
                            _logAction("Utworzono konto administratora: login 'admin', hasło 'skyadmin'.");
                        }
                        else if (adminByEmail != null && adminByUsername == null)
                        {
                            adminByEmail.Username = "admin";
                            adminByEmail.IsAdmin = true;
                            adminByEmail.PasswordHash = BCrypt.Net.BCrypt.HashPassword("skyadmin");
                            dbContext.SaveChanges();
                            _logAction("Promowano istniejące konto admin@zse.pl do administratora.");
                        }
                        else if (adminByUsername != null && adminByEmail == null)
                        {
                            adminByUsername.Email = "admin@zse.pl";
                            adminByUsername.IsAdmin = true;
                            adminByUsername.PasswordHash = BCrypt.Net.BCrypt.HashPassword("skyadmin");
                            dbContext.SaveChanges();
                            _logAction("Zaktualizowano konto 'admin' o email admin@zse.pl.");
                        }
                        else if (adminByUsername != null && adminByEmail != null && adminByUsername.Id != adminByEmail.Id)
                        {
                            // Jeśli istnieją dwa różne konta, promuj konto z adresem admin@zse.pl i odróżnij stare konto
                            adminByEmail.Username = "admin";
                            adminByEmail.IsAdmin = true;
                            adminByEmail.PasswordHash = BCrypt.Net.BCrypt.HashPassword("skyadmin");
                            // Odróżnij stare konto, aby uniknąć kolizji nazw
                            adminByUsername.Username = "admin_old";
                            dbContext.SaveChanges();
                            _logAction("Ujednolicono konta admin: admin@zse.pl ustawiono jako główne.");
                        }
                    }
                    catch (Exception ex)
                    {
                        _logAction($"[DB Warning] Admin seed: {ex.Message}");
                    }

                    try
                    {
                        var admin = dbContext.Users.FirstOrDefault(u => u.IsAdmin);
                        if (admin != null)
                        {
                            var settings = dbContext.GeneralChannelSettings.FirstOrDefault(s => s.Id == 1);
                            if (settings == null)
                            {
                                dbContext.GeneralChannelSettings.Add(new ParrotnestServer.Models.GeneralChannelSettings
                                {
                                    Id = 1,
                                    OwnerId = admin.Id,
                                    Name = "Ogólny",
                                    AvatarUrl = null,
                                    UpdatedAt = DateTime.UtcNow
                                });
                                dbContext.SaveChanges();
                            }
                            else if (settings.OwnerId != admin.Id)
                            {
                                settings.OwnerId = admin.Id;
                                settings.UpdatedAt = DateTime.UtcNow;
                                dbContext.SaveChanges();
                            }
                        }
                    }
                    catch (Exception ex)
                    {
                        _logAction($"[DB Warning] General channel seed: {ex.Message}");
                    }
                }
                var portEnv = Environment.GetEnvironmentVariable("PARROTNEST_PORT");
                var port = 6069;
                if (!string.IsNullOrWhiteSpace(portEnv) && int.TryParse(portEnv, out var parsedPort))
                {
                    port = parsedPort;
                }
                _app.Urls.Clear();
                _app.Urls.Add($"http://0.0.0.0:{port}");
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
                    provider.Mappings[".mp4"] = "video/mp4";
                    provider.Mappings[".avi"] = "video/x-msvideo";
                    provider.Mappings[".docx"] = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
                    provider.Mappings[".exe"] = "application/octet-stream";
                    provider.Mappings[".cpp"] = "text/plain";
                    provider.Mappings[".bin"] = "application/octet-stream";
                    _app.UseStaticFiles(new StaticFileOptions
                    {
                        FileProvider = fileProvider,
                        ContentTypeProvider = provider,
                        OnPrepareResponse = ctx =>
                        {
                            var path = ctx.Context.Request.Path.Value ?? string.Empty;
                            var shouldNoStore =
                                path.EndsWith(".php", StringComparison.OrdinalIgnoreCase) ||
                                path.EndsWith(".js", StringComparison.OrdinalIgnoreCase) ||
                                path.EndsWith(".css", StringComparison.OrdinalIgnoreCase);

                            if (!shouldNoStore) return;

                            var headers = ctx.Context.Response.Headers;
                            headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0";
                            headers["Pragma"] = "no-cache";
                            headers["Expires"] = "0";
                        }
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
        public bool IsEnabled(LogLevel logLevel)
        {
            var verboseEnv = Environment.GetEnvironmentVariable("PARROTNEST_VERBOSE");
            var isVerbose = verboseEnv == "1" || string.Equals(verboseEnv, "true", StringComparison.OrdinalIgnoreCase);
            return isVerbose ? logLevel >= LogLevel.Debug : logLevel >= LogLevel.Information;
        }
        public void Log<TState>(LogLevel logLevel, EventId eventId, TState state, Exception? exception, Func<TState, Exception?, string> formatter)
        {
            var message = formatter(state, exception);
            if (!string.IsNullOrEmpty(message))
            {
                var verboseEnv = Environment.GetEnvironmentVariable("PARROTNEST_VERBOSE");
                var isVerbose = verboseEnv == "1" || string.Equals(verboseEnv, "true", StringComparison.OrdinalIgnoreCase);
                if (isVerbose || _categoryName.StartsWith("Microsoft.AspNetCore.Hosting"))
                {
                    _logAction($"[{DateTime.Now:HH:mm:ss}] {message}");
                }
            }
        }
    }
}
