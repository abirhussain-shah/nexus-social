using Microsoft.Extensions.FileProviders;
using NexusSocial.Hubs;

var builder = WebApplication.CreateBuilder(args);

// Add services
builder.Services.AddSignalR(options =>
{
    options.EnableDetailedErrors = builder.Environment.IsDevelopment();
});

// Configure 15-minute Session Timeout
builder.Services.AddDistributedMemoryCache();
builder.Services.AddSession(options =>
{
    options.IdleTimeout = TimeSpan.FromMinutes(15);
    options.Cookie.Name = ".NexusSocial.Session";
    options.Cookie.HttpOnly = true;
    options.Cookie.IsEssential = true;
    options.Cookie.SameSite = SameSiteMode.Lax;
});

builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.AllowAnyHeader()
              .AllowAnyMethod()
              .SetIsOriginAllowed(_ => true)
              .AllowCredentials();
    });
});

var app = builder.Build();

app.UseCors();
app.UseSession();

// Serve static web assets directly from the project directory
var contentRootProvider = new PhysicalFileProvider(app.Environment.ContentRootPath);

var defaultFilesOptions = new DefaultFilesOptions
{
    FileProvider = contentRootProvider,
    RequestPath = ""
};
defaultFilesOptions.DefaultFileNames.Clear();
defaultFilesOptions.DefaultFileNames.Add("index.html");

app.UseDefaultFiles(defaultFilesOptions);

app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = contentRootProvider,
    RequestPath = ""
});

// SignalR Hub Endpoint
app.MapHub<NexusHub>("/hubs/nexus");

// ─── REST & SESSION APIS ──────────────────────────────────────
app.MapGet("/api/health", () => Results.Ok(new
{
    status = "healthy",
    framework = ".NET 8.0",
    app = "Nexus Social",
    sessionTimeoutMinutes = 15,
    timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()
}));

// Session Heartbeat & Inactivity validation
app.MapGet("/api/session/status", (HttpContext context) =>
{
    var userId = context.Session.GetString("UserId");
    var lastActiveStr = context.Session.GetString("LastActive");
    
    if (string.IsNullOrEmpty(userId) || string.IsNullOrEmpty(lastActiveStr))
    {
        return Results.Ok(new { isAuthenticated = false, expired = true });
    }

    if (long.TryParse(lastActiveStr, out var lastActive))
    {
        var elapsedMs = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds() - lastActive;
        if (elapsedMs > 15 * 60 * 1000)
        {
            context.Session.Clear();
            return Results.Ok(new { isAuthenticated = false, expired = true, reason = "15 minutes inactivity reached" });
        }
    }

    return Results.Ok(new
    {
        isAuthenticated = true,
        userId,
        expired = false,
        lastActive = lastActiveStr
    });
});

app.MapPost("/api/session/login", (SessionLoginRequest request, HttpContext context) =>
{
    if (string.IsNullOrWhiteSpace(request.UserId))
    {
        return Results.BadRequest(new { error = "UserId is required" });
    }

    context.Session.SetString("UserId", request.UserId);
    context.Session.SetString("LastActive", DateTimeOffset.UtcNow.ToUnixTimeMilliseconds().ToString());

    return Results.Ok(new
    {
        success = true,
        userId = request.UserId,
        sessionTimeoutMinutes = 15
    });
});

app.MapPost("/api/session/ping", (HttpContext context) =>
{
    var userId = context.Session.GetString("UserId");
    if (!string.IsNullOrEmpty(userId))
    {
        context.Session.SetString("LastActive", DateTimeOffset.UtcNow.ToUnixTimeMilliseconds().ToString());
        return Results.Ok(new { active = true, timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds() });
    }

    return Results.Ok(new { active = false });
});

app.MapPost("/api/session/logout", (HttpContext context) =>
{
    context.Session.Clear();
    return Results.Ok(new { success = true });
});

// Client-side fallback to index.html for SPA routing
app.MapFallbackToFile("index.html", new StaticFileOptions
{
    FileProvider = contentRootProvider
});

app.Run();

public record SessionLoginRequest(string UserId);
