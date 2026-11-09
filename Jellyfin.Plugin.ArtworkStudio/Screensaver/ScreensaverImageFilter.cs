using System;
using System.IO;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Controllers;
using Microsoft.AspNetCore.Mvc.Filters;

namespace Jellyfin.Plugin.ArtworkStudio.Screensaver;

/// <summary>
/// Serves the screensaver gallery at Jellyfin's normal image address
/// (<c>/Items/{id}/Images/Backdrop/0</c>), which is where the TV apps load backdrops from. Every other
/// image request goes on to Jellyfin as usual.
/// </summary>
public sealed class ScreensaverImageFilter : IAsyncActionFilter
{
    public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
    {
        if (context.ActionDescriptor is ControllerActionDescriptor action
            && string.Equals(action.ControllerName, "Image", StringComparison.OrdinalIgnoreCase)
            && action.ActionName.StartsWith("GetItemImage", StringComparison.OrdinalIgnoreCase)
            && context.RouteData.Values.TryGetValue("itemId", out var raw)
            && Guid.TryParse(raw?.ToString(), out var id))
        {
            var picture = ScreensaverGallery.Find(id);
            if (picture is not null && File.Exists(picture.FullPath))
            {
                context.HttpContext.Response.Headers.CacheControl = "public, max-age=86400";
                context.Result = new PhysicalFileResult(picture.FullPath, ScreensaverGallery.MimeFor(picture.FullPath));
                return;
            }
        }

        await next().ConfigureAwait(false);
    }
}
