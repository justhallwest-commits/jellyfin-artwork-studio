using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using Jellyfin.Data.Enums;
using Jellyfin.Plugin.ArtworkStudio.Configuration;
using MediaBrowser.Controller;
using MediaBrowser.Model.Dto;
using MediaBrowser.Model.Entities;
using MediaBrowser.Model.Querying;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Controllers;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.Extensions.Logging;

namespace Jellyfin.Plugin.ArtworkStudio.Screensaver;

/// <summary>
/// Puts the screensaver gallery into the screensavers of Jellyfin's TV apps.
///
/// Those screensavers ask the server for random movies and shows that have a backdrop, then show each
/// backdrop full screen:
/// <list type="bullet">
/// <item>Jellyfin for Android TV / Fire TV: <c>GET /Items?includeItemTypes=Movie,Series&amp;recursive=true&amp;sortBy=Random&amp;limit=60&amp;imageTypes=Backdrop</c></item>
/// <item>The web app (browsers, LG, Samsung, Jellyfin Media Player), Display → Screensaver → Backdrop:
/// <c>GET /Users/{id}/Items?ImageTypes=Backdrop&amp;EnableImageTypes=Backdrop&amp;IncludeItemTypes=Movie,Series,MusicArtist&amp;SortBy=Random&amp;Recursive=true&amp;Fields=Taglines&amp;Limit=200</c></item>
/// </list>
/// For exactly those requests the answer gets one entry per gallery picture (alone, or mixed with the
/// library's backdrops). Each entry's backdrop is served by <see cref="ScreensaverImageFilter"/>.
/// </summary>
public sealed class ScreensaverItemsFilter : IAsyncResultFilter
{
    private const string ClientClaim = "Jellyfin-Client";

    private static readonly Regex AuthField = new("(\\w+)=\"([^\"]*)\"", RegexOptions.Compiled);

    // Any of these means the request is for a specific page or search, not the screensaver.
    private static readonly string[] NarrowingParams =
    {
        "parentId", "searchTerm", "ids", "genres", "genreIds", "personIds", "person", "studioIds", "studios", "tags",
        "years", "filters", "isFavorite", "nameStartsWith", "nameStartsWithOrGreater", "nameLessThan", "artistIds",
        "albumArtistIds", "contributingArtistIds", "albumIds", "excludeItemIds", "officialRatings", "seriesStatus",
        "isPlayed", "minCommunityRating", "minCriticRating", "hasTrailer", "is4K", "isHd"
    };

    private static readonly Random Rng = new();

    private readonly IServerApplicationHost _appHost;
    private readonly ILogger<ScreensaverItemsFilter> _logger;

    public ScreensaverItemsFilter(IServerApplicationHost appHost, ILogger<ScreensaverItemsFilter> logger)
    {
        _appHost = appHost;
        _logger = logger;
    }

    public enum Kind
    {
        None,

        /// <summary>Jellyfin for Android TV / Fire TV.</summary>
        AndroidTv,

        /// <summary>The web app's backdrop screensaver (browsers, LG, Samsung, Jellyfin Media Player).</summary>
        Web
    }

    public async Task OnResultExecutionAsync(ResultExecutingContext context, ResultExecutionDelegate next)
    {
        try
        {
            Apply(context);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Artwork Studio: couldn't add the screensaver pictures");
        }

        await next().ConfigureAwait(false);
    }

    private void Apply(ResultExecutingContext context)
    {
        if (context.ActionDescriptor is not ControllerActionDescriptor action
            || !string.Equals(action.ControllerName, "Items", StringComparison.OrdinalIgnoreCase)
            || !action.ActionName.StartsWith("GetItems", StringComparison.OrdinalIgnoreCase)
            || context.Result is not ObjectResult { Value: QueryResult<BaseItemDto> result })
        {
            return;
        }

        var settings = Plugin.Instance?.Configuration.Screensaver;
        if (settings is null || !settings.Enabled)
        {
            return;
        }

        var kind = Classify(context.HttpContext);
        if (kind == Kind.None || (kind == Kind.AndroidTv && !settings.NativeApps) || (kind == Kind.Web && !settings.WebApps))
        {
            return;
        }

        var pictures = ScreensaverGallery.List();
        if (pictures.Count == 0)
        {
            return;
        }

        var library = result.Items ?? Array.Empty<BaseItemDto>();
        var serverId = library.FirstOrDefault(i => !string.IsNullOrEmpty(i.ServerId))?.ServerId ?? _appHost.SystemId;
        var limit = int.TryParse(context.HttpContext.Request.Query["limit"].ToString(), out var l) && l > 0 ? l : 200;

        var items = Build(pictures, library, settings, limit, p => ToDto(p, serverId));
        result.Items = items;
        result.TotalRecordCount = items.Count;
        _logger.LogDebug("Artwork Studio: screensaver ({Kind}) gets {Pictures} gallery picture(s) in {Count} slides", kind, pictures.Count, items.Count);
    }

    /// <summary>The slides: gallery pictures only, or spread evenly among the library's backdrops.</summary>
    internal static List<BaseItemDto> Build(IReadOnlyList<GalleryPicture> pictures, IReadOnlyList<BaseItemDto> library, ScreensaverSettings settings, int limit, Func<GalleryPicture, BaseItemDto> toDto)
    {
        bool mix = string.Equals(settings.Mode, "mix", StringComparison.OrdinalIgnoreCase) && library.Count > 0;
        if (!mix)
        {
            return Deck(pictures, Math.Min(pictures.Count, limit)).Select(toDto).ToList();
        }

        int total = Math.Min(limit, Math.Max(library.Count, pictures.Count));
        double share = Math.Clamp(settings.MixPercent, 10, 90) / 100.0;
        int galleryCount = Math.Max(1, (int)Math.Round(total * share));
        var deck = new Queue<GalleryPicture>(Deck(pictures, galleryCount));
        var lib = new Queue<BaseItemDto>(library);
        var slides = new List<BaseItemDto>(total);
        for (int i = 0; i < total; i++)
        {
            // spread the gallery slots evenly: slot i is a gallery picture when the running share ticks over
            bool gallery = (int)Math.Floor((i + 1) * (double)galleryCount / total) > (int)Math.Floor(i * (double)galleryCount / total);
            if ((gallery && deck.Count > 0) || lib.Count == 0)
            {
                if (deck.Count == 0)
                {
                    break;
                }

                slides.Add(toDto(deck.Dequeue()));
            }
            else
            {
                slides.Add(lib.Dequeue());
            }
        }

        return slides;
    }

    /// <summary>
    /// <paramref name="count"/> pictures in shuffled-deck order: every picture once before any repeats,
    /// reshuffled each round, and never the same picture twice in a row.
    /// </summary>
    internal static List<GalleryPicture> Deck(IReadOnlyList<GalleryPicture> pictures, int count)
    {
        var result = new List<GalleryPicture>(count);
        while (result.Count < count && pictures.Count > 0)
        {
            var round = pictures.ToList();
            lock (Rng)
            {
                for (int i = round.Count - 1; i > 0; i--)
                {
                    int j = Rng.Next(i + 1);
                    (round[i], round[j]) = (round[j], round[i]);
                }
            }

            if (result.Count > 0 && round.Count > 1 && round[0].Id == result[^1].Id)
            {
                (round[0], round[^1]) = (round[^1], round[0]);
            }

            result.AddRange(round.Take(count - result.Count));
        }

        return result;
    }

    private static BaseItemDto ToDto(GalleryPicture p, string serverId) => new()
    {
        Id = p.Id,
        // The Fire TV screensaver writes the name where a logo would go; leave it empty.
        Name = string.Empty,
        ServerId = serverId,
        Type = BaseItemKind.Movie,
        IsFolder = false,
        BackdropImageTags = new[] { p.Tag },
        ImageTags = new Dictionary<ImageType, string>(),
        Taglines = Array.Empty<string>()
    };

    /// <summary>Is this one of the TV apps' screensaver requests?</summary>
    public static Kind Classify(HttpContext http)
    {
        var q = http.Request.Query;
        var sort = Values(q, "sortBy");
        if (sort.Count != 1 || !sort[0].Equals("Random", StringComparison.OrdinalIgnoreCase)
            || !Has(q, "imageTypes", "Backdrop")
            || !Has(q, "includeItemTypes", "Movie") || !Has(q, "includeItemTypes", "Series")
            || !string.Equals(q["recursive"].ToString(), "true", StringComparison.OrdinalIgnoreCase)
            || NarrowingParams.Any(p => !string.IsNullOrEmpty(q[p].ToString())))
        {
            return Kind.None;
        }

        var client = ClientName(http);
        if (client.Contains("Android TV", StringComparison.OrdinalIgnoreCase) && q.ContainsKey("limit"))
        {
            return Kind.AndroidTv;
        }

        // Only the web app's backdrop screensaver asks for taglines together with backdrop-only images.
        if (Has(q, "fields", "Taglines") && Has(q, "enableImageTypes", "Backdrop"))
        {
            return Kind.Web;
        }

        return Kind.None;
    }

    private static List<string> Values(IQueryCollection q, string key)
        => q[key].SelectMany(v => (v ?? string.Empty).Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)).ToList();

    private static bool Has(IQueryCollection q, string key, string value)
        => Values(q, key).Any(v => v.Equals(value, StringComparison.OrdinalIgnoreCase));

    private static string ClientName(HttpContext http)
    {
        var claim = http.User?.FindFirst(ClientClaim)?.Value;
        if (!string.IsNullOrEmpty(claim))
        {
            return claim;
        }

        var header = http.Request.Headers["Authorization"].ToString();
        if (string.IsNullOrEmpty(header))
        {
            header = http.Request.Headers["X-Emby-Authorization"].ToString();
        }

        foreach (Match m in AuthField.Matches(header))
        {
            if (m.Groups[1].Value.Equals("Client", StringComparison.OrdinalIgnoreCase))
            {
                return Uri.UnescapeDataString(m.Groups[2].Value);
            }
        }

        return string.Empty;
    }
}
