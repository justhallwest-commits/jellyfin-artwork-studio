#if JF12
using System;
using System.Collections.Generic;
using System.Linq;
using System.Runtime.CompilerServices;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using Jellyfin.Data;
using Jellyfin.Data.Enums;
using Jellyfin.Database.Implementations.Enums;
using MediaBrowser.Controller.Entities;
using MediaBrowser.Controller.Library;
using MediaBrowser.Model.Configuration;
using MediaBrowser.Model.Entities;

namespace Jellyfin.Plugin.ArtworkStudio.Api;

/// <summary>
/// Jellyfin 12 search shortcuts for admins: type "missing poster", "missing logo", "missing backdrop",
/// "missing banner", "missing thumb" or "missing art" into Jellyfin's normal search to list the movies
/// and shows that need artwork. Any other search is left to Jellyfin.
/// </summary>
public partial class ArtworkSearchProvider : IExternalSearchProvider
{
    private const int MaxResults = 300;

    private readonly ILibraryManager _libraryManager;
    private readonly IUserManager _userManager;

    public ArtworkSearchProvider(ILibraryManager libraryManager, IUserManager userManager)
    {
        _libraryManager = libraryManager;
        _userManager = userManager;
    }

    public string Name => "Artwork Studio";

    public MetadataPluginType Type => MetadataPluginType.SearchProvider;

    public int Priority => 0;

    [GeneratedRegex(@"^\s*(?:missing|no|without)[:\s]+(poster|posters|logo|logos|backdrop|backdrops|banner|banners|thumb|thumbs|art|artwork)\s*$", RegexOptions.IgnoreCase)]
    private static partial Regex Shortcut();

    public bool CanSearch(SearchProviderQuery query)
    {
        if (Plugin.Instance?.Configuration.Extras?.ArtworkSearch == false || string.IsNullOrWhiteSpace(query.SearchTerm) || !Shortcut().IsMatch(query.SearchTerm))
        {
            return false;
        }

        var user = query.UserId.HasValue ? _userManager.GetUserById(query.UserId.Value) : null;
        return user is not null && user.HasPermission(PermissionKind.IsAdministrator);
    }

    public Task<IReadOnlyList<SearchResult>> SearchAsync(SearchProviderQuery query, CancellationToken cancellationToken)
        => Task.FromResult<IReadOnlyList<SearchResult>>(Find(query).ToList());

    async IAsyncEnumerable<SearchResult> IExternalSearchProvider.SearchAsync(SearchProviderQuery query, [EnumeratorCancellation] CancellationToken cancellationToken)
    {
        foreach (var r in Find(query))
        {
            cancellationToken.ThrowIfCancellationRequested();
            yield return r;
        }

        await Task.CompletedTask.ConfigureAwait(false);
    }

    private IEnumerable<SearchResult> Find(SearchProviderQuery query)
    {
        var m = Shortcut().Match(query.SearchTerm ?? string.Empty);
        if (!m.Success)
        {
            yield break;
        }

        var word = m.Groups[1].Value.ToLowerInvariant().TrimEnd('s');
        var wanted = word switch
        {
            "poster" => new[] { ImageType.Primary },
            "logo" => new[] { ImageType.Logo },
            "backdrop" => new[] { ImageType.Backdrop },
            "banner" => new[] { ImageType.Banner },
            "thumb" => new[] { ImageType.Thumb },
            _ => new[] { ImageType.Primary, ImageType.Logo, ImageType.Backdrop }
        };

        var items = _libraryManager.GetItemList(new InternalItemsQuery
        {
            IncludeItemTypes = new[] { BaseItemKind.Movie, BaseItemKind.Series },
            Recursive = true,
            IsVirtualItem = false
        });

        var n = 0;
        foreach (var item in items.OrderBy(i => i.SortName ?? i.Name, StringComparer.OrdinalIgnoreCase))
        {
            var missing = wanted.Count(t => !item.HasImage(t, 0));
            if (missing == 0)
            {
                continue;
            }

            yield return new SearchResult(item.Id, 100f - n * 0.01f + missing);
            if (++n >= Math.Min(MaxResults, query.Limit ?? MaxResults))
            {
                yield break;
            }
        }
    }
}
#endif
