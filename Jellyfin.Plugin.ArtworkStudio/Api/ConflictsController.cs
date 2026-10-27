using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using MediaBrowser.Common.Configuration;
using MediaBrowser.Common.Plugins;
using MediaBrowser.Controller.Configuration;
using MediaBrowser.Model.Branding;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;

namespace Jellyfin.Plugin.ArtworkStudio.Api;

/// <summary>
/// Finds other styling on the server that can fight with Artwork Studio's design (Jellyfin's own
/// Branding → Custom CSS, and theme code saved by other plugins), and lets an admin switch
/// Jellyfin's Custom CSS off with a backup.
/// </summary>
[ApiController]
[Route("ArtworkStudio/Conflicts")]
[Authorize(Policy = "RequiresElevation")]
public class ConflictsController : ControllerBase
{
    // Text that shows a stylesheet or script is changing the sign-in page or the backdrops.
    private static readonly string[] Markers =
    {
        "loginPage", "manualLoginForm", "visualLoginForm", "standalonePage", "divUsers",
        "Sign in to continue", "bg-splash", "--splash", "backdropContainer", "backgroundContainer",
        "imgur.com", "@import"
    };

    private static readonly string[] ThemePluginHints = { "skin", "theme", "javascript injector", "custom javascript", "css" };

    private readonly IServerConfigurationManager _config;
    private readonly IPluginManager _plugins;
    private readonly IApplicationPaths _paths;
    private readonly ILogger<ConflictsController> _logger;

    public ConflictsController(IServerConfigurationManager config, IPluginManager plugins, IApplicationPaths paths, ILogger<ConflictsController> logger)
    {
        _config = config;
        _plugins = plugins;
        _paths = paths;
        _logger = logger;
    }

    private string BackupDir => Path.Combine(Plugin.Instance?.DataFolderPath ?? _paths.DataPath, "branding-backups");

    /// <summary>Reports styling elsewhere on the server that may override Artwork Studio.</summary>
    [HttpGet]
    public ActionResult Get()
    {
        var branding = GetBranding();
        var css = branding?.CustomCss ?? string.Empty;

        var found = new List<object>();
        try
        {
            var dir = _paths.PluginConfigurationsPath;
            if (Directory.Exists(dir))
            {
                foreach (var file in Directory.EnumerateFiles(dir, "*.xml"))
                {
                    var name = Path.GetFileNameWithoutExtension(file);
                    if (name.Contains("ArtworkStudio", StringComparison.OrdinalIgnoreCase))
                    {
                        continue;
                    }

                    var text = System.IO.File.ReadAllText(file);
                    var hits = MarkersIn(text);
                    if (hits.Length > 0)
                    {
                        found.Add(new { Source = FriendlyName(name), File = Path.GetFileName(file), Markers = hits });
                    }
                }
            }
        }
        catch (Exception ex) when (ex is IOException || ex is UnauthorizedAccessException)
        {
            _logger.LogDebug(ex, "Artwork Studio: couldn't scan plugin settings");
        }

        var themePlugins = _plugins.Plugins
            .Where(p => !string.Equals(p.Name, "Artwork Studio", StringComparison.OrdinalIgnoreCase)
                && ThemePluginHints.Any(h => p.Name.Contains(h, StringComparison.OrdinalIgnoreCase)))
            .Select(p => new { p.Name, Version = p.Version?.ToString() })
            .ToList();

        var backups = Directory.Exists(BackupDir)
            ? Directory.EnumerateFiles(BackupDir, "*.css").OrderByDescending(f => f).Select(Path.GetFileName).ToList()
            : new List<string?>();

        return Ok(new
        {
            BrandingCss = new
            {
                Length = css.Length,
                Markers = MarkersIn(css),
                Preview = css.Length > 600 ? css[..600] + "…" : css
            },
            LoginDisclaimer = (branding?.LoginDisclaimer ?? string.Empty).Length,
            OtherPluginSettings = found,
            ThemePlugins = themePlugins,
            Backups = backups
        });
    }

    /// <summary>Backs up Jellyfin's Branding → Custom CSS to a file and clears it.</summary>
    [HttpPost("DisableBrandingCss")]
    public ActionResult DisableBrandingCss()
    {
        var branding = GetBranding();
        if (branding is null)
        {
            return BadRequest(new { message = "Couldn't read Jellyfin's branding settings." });
        }

        var css = branding.CustomCss ?? string.Empty;
        if (css.Length == 0)
        {
            return Ok(new { success = true, message = "Jellyfin's Custom CSS is already empty." });
        }

        Directory.CreateDirectory(BackupDir);
        var file = Path.Combine(BackupDir, "custom-css-" + DateTime.UtcNow.ToString("yyyyMMdd-HHmmss", System.Globalization.CultureInfo.InvariantCulture) + ".css");
        System.IO.File.WriteAllText(file, css);

        branding.CustomCss = string.Empty;
        _config.SaveConfiguration("branding", branding);
        _logger.LogInformation("Artwork Studio: backed up Jellyfin Custom CSS to {File} and cleared it", file);
        return Ok(new { success = true, Backup = Path.GetFileName(file) });
    }

    /// <summary>Puts back the most recent (or a named) Custom CSS backup.</summary>
    [HttpPost("RestoreBrandingCss")]
    public ActionResult RestoreBrandingCss([FromQuery] string? file)
    {
        if (!Directory.Exists(BackupDir))
        {
            return NotFound(new { message = "There's no backup to restore." });
        }

        var path = string.IsNullOrWhiteSpace(file)
            ? Directory.EnumerateFiles(BackupDir, "*.css").OrderByDescending(f => f).FirstOrDefault()
            : Path.Combine(BackupDir, Path.GetFileName(file));
        if (path is null || !System.IO.File.Exists(path))
        {
            return NotFound(new { message = "That backup doesn't exist." });
        }

        var branding = GetBranding();
        if (branding is null)
        {
            return BadRequest(new { message = "Couldn't read Jellyfin's branding settings." });
        }

        branding.CustomCss = System.IO.File.ReadAllText(path);
        _config.SaveConfiguration("branding", branding);
        return Ok(new { success = true, Restored = Path.GetFileName(path) });
    }

    private BrandingOptions? GetBranding()
    {
        try
        {
            return _config.GetConfiguration<BrandingOptions>("branding");
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Artwork Studio: couldn't read branding settings");
            return null;
        }
    }

    private static string[] MarkersIn(string text)
    {
        if (string.IsNullOrEmpty(text))
        {
            return Array.Empty<string>();
        }

        return Markers.Where(m => text.Contains(m, StringComparison.OrdinalIgnoreCase)).ToArray();
    }

    private static string FriendlyName(string configName)
    {
        // e.g. "Jellyfin.Plugin.JavaScriptInjector" -> "JavaScript Injector"
        var last = configName.Split('.').Last();
        return System.Text.RegularExpressions.Regex.Replace(last, "(?<=[a-z])(?=[A-Z])", " ");
    }
}
