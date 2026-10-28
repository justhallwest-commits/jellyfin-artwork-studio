using System;
using System.IO;
using System.Linq;
using System.Text.Json;
using Jellyfin.Plugin.ArtworkStudio.Configuration;
using MediaBrowser.Common.Configuration;
using MediaBrowser.Controller.Configuration;
using MediaBrowser.Model.Branding;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;

namespace Jellyfin.Plugin.ArtworkStudio.Api;

/// <summary>Request body for <see cref="EverywhereController.Apply"/>.</summary>
public class EverywhereApplyRequest
{
    /// <summary>Gets or sets the design CSS built by the dashboard (published when "PublishCss" is on).</summary>
    public string? Css { get; set; }

    /// <summary>Gets or sets the font @import lines that must sit at the top of the stylesheet.</summary>
    public string? Imports { get; set; }
}

/// <summary>What Artwork Studio changed in Jellyfin's own branding, so it can be put back exactly.</summary>
internal sealed class EverywhereState
{
    public bool ManagedSplash { get; set; }

    public bool PrevSplashEnabled { get; set; }

    public string? PrevSplashLocation { get; set; }

    public bool ManagedDisclaimer { get; set; }

    public string? PrevDisclaimer { get; set; }
}

/// <summary>
/// Copies the design into Jellyfin's built-in branding (splashscreen, login disclaimer and Custom CSS),
/// which native apps such as Roku, Android TV / Fire TV and Swiftfin read — they never run the site script.
/// </summary>
internal static class BrandingSync
{
    internal const string CssStart = "/* >>> Artwork Studio design (managed by the Artwork Studio plugin; change it there) */";
    internal const string CssEnd = "/* <<< Artwork Studio design */";
    internal const string ImportsStart = "/* >>> Artwork Studio fonts */";
    internal const string ImportsEnd = "/* <<< Artwork Studio fonts */";
    private const string SplashPrefix = "splashscreen-artworkstudio-";

    private static readonly object Gate = new();

    private static readonly string[] StillExtensions = { ".jpg", ".jpeg", ".png", ".webp", ".bmp", ".gif" };

    private static EverywhereSettings Settings => Plugin.Instance?.Configuration.Everywhere ?? new EverywhereSettings();

    private static string StatePath => Path.Combine(Plugin.Instance?.DataFolderPath ?? Path.GetTempPath(), "everywhere-state.json");

    internal static BrandingOptions GetBranding(IServerConfigurationManager config) => config.GetConfiguration<BrandingOptions>("branding");

    /// <summary>Removes Artwork Studio's managed blocks from a stylesheet.</summary>
    internal static string StripManaged(string? css)
    {
        var s = css ?? string.Empty;
        s = Cut(s, ImportsStart, ImportsEnd);
        s = Cut(s, CssStart, CssEnd);
        return s.Trim('\n', '\r', ' ');
    }

    /// <summary>Returns just Artwork Studio's design block (empty if none).</summary>
    internal static string ManagedBlock(string? css)
    {
        var s = css ?? string.Empty;
        var a = s.IndexOf(CssStart, StringComparison.Ordinal);
        var b = a < 0 ? -1 : s.IndexOf(CssEnd, a, StringComparison.Ordinal);
        return a < 0 || b < 0 ? string.Empty : s[a..(b + CssEnd.Length)];
    }

    internal static string ManagedImports(string? css)
    {
        var s = css ?? string.Empty;
        var a = s.IndexOf(ImportsStart, StringComparison.Ordinal);
        var b = a < 0 ? -1 : s.IndexOf(ImportsEnd, a, StringComparison.Ordinal);
        return a < 0 || b < 0 ? string.Empty : s[a..(b + ImportsEnd.Length)];
    }

    private static string Cut(string s, string start, string end)
    {
        while (true)
        {
            var a = s.IndexOf(start, StringComparison.Ordinal);
            if (a < 0)
            {
                return s;
            }

            var b = s.IndexOf(end, a, StringComparison.Ordinal);
            s = b < 0 ? s[..a] : s[..a] + s[(b + end.Length)..];
        }
    }

    internal static EverywhereState LoadState()
    {
        try
        {
            if (File.Exists(StatePath))
            {
                return JsonSerializer.Deserialize<EverywhereState>(File.ReadAllText(StatePath)) ?? new EverywhereState();
            }
        }
        catch (Exception ex) when (ex is IOException || ex is JsonException || ex is UnauthorizedAccessException)
        {
            // fall through to a fresh state
        }

        return new EverywhereState();
    }

    private static void SaveState(EverywhereState state)
    {
        Directory.CreateDirectory(Path.GetDirectoryName(StatePath)!);
        File.WriteAllText(StatePath, JsonSerializer.Serialize(state));
    }

    /// <summary>First still image (not a video loop) in a backdrop slot.</summary>
    internal static string? FirstStillImage(string page)
    {
        var dir = Path.Combine(Plugin.Instance?.DataFolderPath ?? Path.GetTempPath(), "backdrops", page);
        if (!Directory.Exists(dir))
        {
            return null;
        }

        return Directory.EnumerateFiles(dir)
            .Where(f => StillExtensions.Contains(Path.GetExtension(f), StringComparer.OrdinalIgnoreCase))
            .OrderBy(f => Path.GetFileName(f), StringComparer.Ordinal)
            .FirstOrDefault();
    }

    /// <summary>Points Jellyfin's splashscreen at the chosen backdrop, or puts the old one back. Returns a note for the admin, or null.</summary>
    internal static string? SyncSplash(IServerConfigurationManager config, IApplicationPaths paths, ILogger logger)
    {
        lock (Gate)
        {
            var ev = Settings;
            var state = LoadState();
            var branding = GetBranding(config);

            if (!ev.SyncSplashscreen)
            {
                if (!state.ManagedSplash)
                {
                    return null;
                }

                DeleteOurSplashes(paths, null);
                branding.SplashscreenLocation = !string.IsNullOrEmpty(state.PrevSplashLocation) && File.Exists(state.PrevSplashLocation) ? state.PrevSplashLocation : null;
                branding.SplashscreenEnabled = state.PrevSplashEnabled;
                config.SaveConfiguration("branding", branding);
                state.ManagedSplash = false;
                SaveState(state);
                logger.LogInformation("Artwork Studio: restored Jellyfin's previous splashscreen");
                return "Jellyfin's splashscreen is back to how it was.";
            }

            var source = string.Equals(ev.SplashscreenSource, "home", StringComparison.OrdinalIgnoreCase) ? "home" : "login";
            var file = FirstStillImage(source) ?? FirstStillImage(source == "home" ? "login" : "home");
            if (file is null)
            {
                return "Add a picture (not a video) to the " + source + " page backdrops so the other apps have something to show.";
            }

            if (!state.ManagedSplash)
            {
                state.PrevSplashEnabled = branding.SplashscreenEnabled;
                state.PrevSplashLocation = branding.SplashscreenLocation;
                state.ManagedSplash = true;
                SaveState(state);
            }

            // A new file name each time the picture changes, so apps and Jellyfin's image cache pick it up.
            var target = Path.Combine(paths.DataPath, SplashPrefix + Path.GetFileName(file));
            if (!File.Exists(target))
            {
                DeleteOurSplashes(paths, target);
                File.Copy(file, target, true);
            }

            if (!string.Equals(branding.SplashscreenLocation, target, StringComparison.Ordinal) || !branding.SplashscreenEnabled)
            {
                branding.SplashscreenLocation = target;
                branding.SplashscreenEnabled = true;
                config.SaveConfiguration("branding", branding);
                logger.LogInformation("Artwork Studio: Jellyfin splashscreen now uses {File}", Path.GetFileName(file));
            }

            return null;
        }
    }

    private static void DeleteOurSplashes(IApplicationPaths paths, string? keep)
    {
        if (!Directory.Exists(paths.DataPath))
        {
            return;
        }

        foreach (var f in Directory.EnumerateFiles(paths.DataPath, SplashPrefix + "*"))
        {
            if (!string.Equals(f, keep, StringComparison.Ordinal))
            {
                try
                {
                    File.Delete(f);
                }
                catch (IOException)
                {
                    // in use; it'll be replaced next time
                }
            }
        }
    }

    /// <summary>Copies the Design login message into Jellyfin's login disclaimer, or restores the old one.</summary>
    internal static void SyncDisclaimer(IServerConfigurationManager config, ILogger logger)
    {
        lock (Gate)
        {
            var ev = Settings;
            var state = LoadState();
            var branding = GetBranding(config);
            var message = (Plugin.Instance?.Configuration.Theme?.LoginMessage ?? string.Empty).Trim();

            if (ev.SyncLoginMessage)
            {
                if (!state.ManagedDisclaimer)
                {
                    state.PrevDisclaimer = branding.LoginDisclaimer;
                    state.ManagedDisclaimer = true;
                    SaveState(state);
                }

                var want = message.Length == 0 ? null : message;
                if (!string.Equals(branding.LoginDisclaimer ?? string.Empty, want ?? string.Empty, StringComparison.Ordinal))
                {
                    branding.LoginDisclaimer = want;
                    config.SaveConfiguration("branding", branding);
                    logger.LogInformation("Artwork Studio: updated Jellyfin's login disclaimer");
                }
            }
            else if (state.ManagedDisclaimer)
            {
                branding.LoginDisclaimer = state.PrevDisclaimer;
                config.SaveConfiguration("branding", branding);
                state.ManagedDisclaimer = false;
                SaveState(state);
                logger.LogInformation("Artwork Studio: restored Jellyfin's previous login disclaimer");
            }
        }
    }

    /// <summary>Writes (or removes) Artwork Studio's block in Branding → Custom CSS, leaving everything else as it is.</summary>
    internal static void SyncCss(IServerConfigurationManager config, string? css, string? imports, ILogger logger)
    {
        lock (Gate)
        {
            var branding = GetBranding(config);
            var current = branding.CustomCss ?? string.Empty;
            var rest = StripManaged(current);
            string result;

            if (Settings.PublishCss && !string.IsNullOrWhiteSpace(css))
            {
                var top = string.IsNullOrWhiteSpace(imports) ? string.Empty : ImportsStart + "\n" + imports.Trim() + "\n" + ImportsEnd + "\n";
                result = top + (rest.Length > 0 ? rest + "\n\n" : string.Empty) + CssStart + "\n" + css.Trim() + "\n" + CssEnd + "\n";
            }
            else if (Settings.PublishCss)
            {
                // Nothing new from the dashboard (e.g. an automatic sync): keep the block that's there
                return;
            }
            else
            {
                result = rest;
            }

            if (!string.Equals(result, current, StringComparison.Ordinal))
            {
                branding.CustomCss = result;
                config.SaveConfiguration("branding", branding);
                logger.LogInformation("Artwork Studio: {Action} the design in Jellyfin's Custom CSS", Settings.PublishCss ? "published" : "removed");
            }
        }
    }
}

/// <summary>Shares the design with Jellyfin apps that don't run the site script.</summary>
[ApiController]
[Route("ArtworkStudio/Everywhere")]
[Authorize(Policy = "RequiresElevation")]
public class EverywhereController : ControllerBase
{
    private readonly IServerConfigurationManager _config;
    private readonly IApplicationPaths _paths;
    private readonly ILogger<EverywhereController> _logger;

    public EverywhereController(IServerConfigurationManager config, IApplicationPaths paths, ILogger<EverywhereController> logger)
    {
        _config = config;
        _paths = paths;
        _logger = logger;
    }

    /// <summary>What's currently shared with the other apps.</summary>
    [HttpGet]
    public ActionResult Get()
    {
        var branding = BrandingSync.GetBranding(_config);
        var state = BrandingSync.LoadState();
        var location = branding.SplashscreenLocation;
        var block = BrandingSync.ManagedBlock(branding.CustomCss);
        return Ok(new
        {
            Settings = Plugin.Instance?.Configuration.Everywhere ?? new EverywhereSettings(),
            Splashscreen = new
            {
                Enabled = branding.SplashscreenEnabled,
                Custom = !string.IsNullOrEmpty(location) && System.IO.File.Exists(location),
                Ours = state.ManagedSplash,
                File = string.IsNullOrEmpty(location) ? null : Path.GetFileName(location)
            },
            LoginDisclaimer = branding.LoginDisclaimer ?? string.Empty,
            DisclaimerOurs = state.ManagedDisclaimer,
            Css = new
            {
                Published = block.Length > 0,
                Length = block.Length,
                OtherLength = BrandingSync.StripManaged(branding.CustomCss).Length
            },
            ScriptInstalled = Plugin.Instance?.ClientScriptInstalled ?? false
        });
    }

    /// <summary>Applies the "Other apps" settings to Jellyfin's branding.</summary>
    [HttpPost("Apply")]
    public ActionResult Apply([FromBody] EverywhereApplyRequest? request)
    {
        try
        {
            var note = BrandingSync.SyncSplash(_config, _paths, _logger);
            BrandingSync.SyncDisclaimer(_config, _logger);
            BrandingSync.SyncCss(_config, request?.Css, request?.Imports, _logger);
            return Ok(new { success = true, message = note });
        }
        catch (Exception ex) when (ex is IOException || ex is UnauthorizedAccessException)
        {
            _logger.LogWarning(ex, "Artwork Studio: couldn't update Jellyfin's branding");
            return BadRequest(new { message = "Couldn't update Jellyfin's branding: " + ex.Message });
        }
    }
}
