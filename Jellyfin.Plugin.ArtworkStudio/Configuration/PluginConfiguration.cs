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

    /// <summary>Gets or sets the login text size in percent.</summary>
    public int LoginTextSize { get; set; } = 100;

    /// <summary>Gets or sets backdrop blur in px.</summary>
    public int BackdropBlur { get; set; }

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

public class PluginConfiguration : BasePluginConfiguration
{
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
