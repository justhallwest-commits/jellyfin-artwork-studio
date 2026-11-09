using Jellyfin.Plugin.ArtworkStudio.Screensaver;
using MediaBrowser.Controller;
using MediaBrowser.Controller.Plugins;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.DependencyInjection;

namespace Jellyfin.Plugin.ArtworkStudio;

/// <summary>Registers the screensaver filters with Jellyfin's web API.</summary>
public class PluginServiceRegistrator : IPluginServiceRegistrator
{
    public void RegisterServices(IServiceCollection serviceCollection, IServerApplicationHost applicationHost)
    {
        serviceCollection.Configure<MvcOptions>(options =>
        {
            options.Filters.Add<ScreensaverItemsFilter>();
            options.Filters.Add<ScreensaverImageFilter>();
        });
    }
}
