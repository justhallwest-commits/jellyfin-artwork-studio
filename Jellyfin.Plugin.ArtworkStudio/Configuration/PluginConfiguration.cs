using System;
using MediaBrowser.Model.Plugins;

namespace Jellyfin.Plugin.ArtworkStudio.Configuration;

/// <summary>
/// A folder (as seen from inside the Jellyfin container) that Artwork Studio can browse.
/// </summary>
public class NasRoot
{
    /// <summary>Gets or sets the friendly name shown in the picker, e.g. "UGREEN Artwork".</summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>Gets or sets the absolute path inside the Jellyfin container, e.g. "/artwork".</summary>
    public string Path { get; set; } = string.Empty;
}

/// <summary>Look-and-feel changes applied to the Jellyfin web app. Empty / default values leave Jellyfin unchanged.</summary>
public class ThemeSettings
{
    public bool Enabled { get; set; } = true;

    /// <summary>Gets or sets the name shown in the browser tab instead of "Jellyfin".</summary>
    public string SiteName { get; set; } = string.Empty;

    /// <summary>Gets or sets the header logo height in em (0 = Jellyfin default).</summary>
    public double LogoHeight { get; set; }

    /// <summary>Gets or sets the login page logo height in em (0 = default, 6em).</summary>
    public double LoginLogoHeight { get; set; }

    public string AccentColor { get; set; } = string.Empty;

    public string BackgroundColor { get; set; } = string.Empty;

    /// <summary>Gets or sets the header style: "default", "glass" (blurred) or "solid".</summary>
    public string HeaderStyle { get; set; } = "default";

    /// <summary>Gets or sets the size of the profile picture in the top bar, in em (0 = Jellyfin default).</summary>
    public double HeaderUserSize { get; set; }

    public string BodyFont { get; set; } = string.Empty;

    public string HeadingFont { get; set; } = string.Empty;

    /// <summary>Gets or sets card corner roundness in px (-1 = Jellyfin default).</summary>
    public int CardRadius { get; set; } = -1;

    public bool CardHover { get; set; }

    /// <summary>Gets or sets the width of library covers on the home screen, in % of screen width (0 = Jellyfin default).</summary>
    public double LibraryCardSize { get; set; }

    /// <summary>Gets or sets the library cover shape: default, wide, ultrawide, square, poster.</summary>
    public string LibraryCardShape { get; set; } = "default";

    public bool LibraryHideNames { get; set; }

    /// <summary>Gets or sets the size of user pictures on the login screen, in em (0 = Jellyfin default).</summary>
    public double LoginUserSize { get; set; }

    public bool LoginUserRound { get; set; }

    /// <summary>Gets or sets a value indicating whether the login window gets cleaner spacing.</summary>
    public bool LoginTidy { get; set; } = true;

    /// <summary>Gets or sets the login window width in em (0 = automatic).</summary>
    public double LoginBoxWidth { get; set; }

    /// <summary>Gets or sets the space between login fields in em (0 = automatic).</summary>
    public double LoginSpacing { get; set; }

    /// <summary>Gets or sets the login layout: "center", "split" (form left, image right) or "split-right" (image left, form right).</summary>
    public string LoginLayout { get; set; } = "center";

    /// <summary>Gets or sets the width of the sign-in panel in split layouts, in % of the screen.</summary>
    public int LoginSplitWidth { get; set; } = 38;

    /// <summary>Gets or sets how wide the blend between the image and the sign-in panel is, in % of the screen.</summary>
    public int LoginFadeWidth { get; set; } = 24;

    /// <summary>Gets or sets the login text size in percent.</summary>
    public int LoginTextSize { get; set; } = 100;

    /// <summary>Gets or sets backdrop blur in px.</summary>
    public int BackdropBlur { get; set; }

    /// <summary>Gets or sets a value indicating whether the blur also applies to movie / show backdrops (not just page backgrounds).</summary>
    public bool BlurItemBackdrops { get; set; }

    public string LoginMessage { get; set; } = string.Empty;

    public bool LoginGlass { get; set; }

    public bool HideForgotPassword { get; set; }

    public bool HideQuickConnect { get; set; }

    public string Announcement { get; set; } = string.Empty;

    /// <summary>Gets or sets the announcement colour style: info, success, warning, accent.</summary>
    public string AnnouncementStyle { get; set; } = "info";

    public bool AnnouncementDismissible { get; set; } = true;

    public string CustomCss { get; set; } = string.Empty;

    /// <summary>Gets or sets the active theme preset id (empty = none).</summary>
    public string Preset { get; set; } = string.Empty;

    /// <summary>Gets or sets the user's own style settings saved before a preset was applied (JSON), for "Reset to my design".</summary>
    public string BeforePreset { get; set; } = string.Empty;
}

/// <summary>A home-page banner shown between two dates.</summary>
public class ScheduledAnnouncement
{
    public string Text { get; set; } = string.Empty;

    /// <summary>Gets or sets the colour style: info, success, warning, accent.</summary>
    public string Style { get; set; } = "info";

    /// <summary>Gets or sets the local start time (yyyy-MM-ddTHH:mm), empty = straight away.</summary>
    public string Start { get; set; } = string.Empty;

    /// <summary>Gets or sets the local end time (yyyy-MM-ddTHH:mm), empty = no end.</summary>
    public string End { get; set; } = string.Empty;

    public bool Dismissible { get; set; } = true;
}

/// <summary>Optional enhancements to the Jellyfin web app.</summary>
public class ExtrasSettings
{
    // Home
    public bool Spotlight { get; set; } = true;

    /// <summary>Gets or sets what the spotlight shows: latest, random, unwatched, favorites.</summary>
    public string SpotlightSource { get; set; } = "latest";

    public int SpotlightCount { get; set; } = 8;

    public int SpotlightSeconds { get; set; } = 9;

    public int SpotlightHeight { get; set; } = 62;

    public bool SpotlightTrailers { get; set; } = true;

    /// <summary>Gets or sets where previews come from: clips (from the title itself), trailers, clips-then-trailers, trailers-then-clips.</summary>
    public string PreviewSource { get; set; } = "clips";

    /// <summary>Gets or sets how long each clip plays, in seconds.</summary>
    public int ClipSeconds { get; set; } = 30;

    /// <summary>Gets or sets a value indicating whether the server may convert files the browser can't play directly (uses CPU).</summary>
    public bool ClipTranscode { get; set; } = true;

    public bool HoverTrailers { get; set; } = true;

    public int HoverDelay { get; set; } = 900;

    public bool Badges { get; set; } = true;

    public bool BadgeQuality { get; set; } = true;

    public bool BadgeNew { get; set; } = true;

    public int BadgeNewDays { get; set; } = 14;

    public bool BadgeRating { get; set; } = true;

    public bool AnimatedLibraryCovers { get; set; } = true;

    public bool SurpriseMe { get; set; } = true;

    // Movie & show pages
    public bool CinematicBackdrop { get; set; } = true;

    public bool DetailLogo { get; set; } = true;

    public bool AmbientColor { get; set; } = true;

    public bool EndsAt { get; set; } = true;

    // Playback
    public bool PauseScreen { get; set; } = true;

    public int PauseDelay { get; set; } = 3;

    public bool BrandedLoader { get; set; } = true;

    public bool UpNextStyle { get; set; } = true;

    public bool LogoSpinner { get; set; } = true;

    // Sign-in
    public bool AnimatedProfiles { get; set; } = true;

    // Seasonal
    public bool Seasonal { get; set; } = true;

    /// <summary>Gets or sets the season: auto (by date) or a fixed season id.</summary>
    public string SeasonMode { get; set; } = "auto";

    public bool SeasonEffects { get; set; } = true;

    public bool SeasonAccent { get; set; }

    // Site-wide
    public bool QuickSearch { get; set; } = true;

    public ScheduledAnnouncement[] Announcements { get; set; } = Array.Empty<ScheduledAnnouncement>();
}

public class PluginConfiguration : BasePluginConfiguration
{
    /// <summary>Gets or sets the optional web app enhancements.</summary>
    public ExtrasSettings Extras { get; set; } = new ExtrasSettings();

    /// <summary>Gets or sets the site design settings.</summary>
    public ThemeSettings Theme { get; set; } = new ThemeSettings();

    /// <summary>Gets or sets the folders available in the NAS picker.</summary>
    public NasRoot[] NasRoots { get; set; } = Array.Empty<NasRoot>();

    /// <summary>Gets or sets the default NAS mode: "copy" (Jellyfin keeps its own copy) or "link" (point at the NAS file).</summary>
    public string DefaultNasMode { get; set; } = "copy";

    /// <summary>Gets or sets where copied artwork goes: "library" (library setting), "media" (next to media), "metadata" (Jellyfin metadata folder).</summary>
    public string SaveLocation { get; set; } = "library";

    /// <summary>Gets or sets the largest image allowed from a link or upload, in MB.</summary>
    public int MaxImageSizeMb { get; set; } = 40;

    /// <summary>Gets or sets the timeout for downloading from links, in seconds.</summary>
    public int DownloadTimeoutSeconds { get; set; } = 45;

    /// <summary>Gets or sets a value indicating whether library pages show the library's own backdrops.</summary>
    public bool LibraryBackdrops { get; set; } = true;

    /// <summary>Gets or sets how often library backdrops rotate, in seconds.</summary>
    public int BackdropRotateSeconds { get; set; } = 12;

    /// <summary>Gets or sets how dark the overlay on top of backdrops is (0 = none, 100 = black).</summary>
    public int BackdropDimPercent { get; set; } = 45;

    /// <summary>Gets or sets a value indicating whether the darkness setting also applies to Jellyfin's normal backdrops.</summary>
    public bool DimAllBackdrops { get; set; }
}
