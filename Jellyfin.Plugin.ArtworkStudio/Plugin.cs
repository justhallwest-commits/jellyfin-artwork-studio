using System;
using System.Collections.Generic;
using Jellyfin.Plugin.ArtworkStudio.Configuration;
using MediaBrowser.Common.Configuration;
using MediaBrowser.Common.Plugins;
using MediaBrowser.Model.Plugins;
using MediaBrowser.Model.Serialization;

namespace Jellyfin.Plugin.ArtworkStudio;

/// <summary>
/// Artwork Studio: a friendly dashboard page for managing posters, backdrops,
/// logos and other artwork for libraries and items.
/// </summary>
public class Plugin : BasePlugin<PluginConfiguration>, IHasWebPages
{
    public Plugin(IApplicationPaths applicationPaths, IXmlSerializer xmlSerializer)
        : base(applicationPaths, xmlSerializer)
    {
        Instance = this;
    }

    public static Plugin? Instance { get; private set; }

    public override string Name => "Artwork Studio";

    public override Guid Id => Guid.Parse("7143ab64-23ea-4969-b0b9-672c6893c4b3");

    public override string Description =>
        "Add and manage posters, backdrops, logos and more for libraries and items — from uploads, web links, your NAS, or online providers.";

    public IEnumerable<PluginPageInfo> GetPages()
    {
        return new[]
        {
            new PluginPageInfo
            {
                Name = "ArtworkStudio",
                DisplayName = "Artwork Studio",
                EmbeddedResourcePath = GetType().Namespace + ".Web.artworkStudio.html",
                EnableInMainMenu = true,
                MenuSection = "server",
                MenuIcon = "photo_library"
            }
        };
    }
}
