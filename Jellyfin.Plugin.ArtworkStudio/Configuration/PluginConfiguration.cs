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

public class PluginConfiguration : BasePluginConfiguration
{
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
