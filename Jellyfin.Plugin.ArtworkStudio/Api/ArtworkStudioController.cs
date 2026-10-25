using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Net.Http;
using System.Net.Mime;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using Jellyfin.Plugin.ArtworkStudio.Configuration;
using MediaBrowser.Common.Configuration;
using MediaBrowser.Common.Net;
using MediaBrowser.Controller.Entities;
using MediaBrowser.Controller.Library;
using MediaBrowser.Controller.Providers;
using MediaBrowser.Model.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;

namespace Jellyfin.Plugin.ArtworkStudio.Api;

/// <summary>Request body for adding artwork from a web link.</summary>
public class UrlImageRequest
{
    public string Type { get; set; } = "Primary";

    public int? Index { get; set; }

    public string Url { get; set; } = string.Empty;
}

/// <summary>Request body for adding artwork from a NAS folder.</summary>
public class NasImageRequest
{
    public string Type { get; set; } = "Primary";

    public int? Index { get; set; }

    public int Root { get; set; }

    public string Path { get; set; } = string.Empty;

    /// <summary>Gets or sets "copy" or "link". Empty uses the plugin default.</summary>
    public string? Mode { get; set; }
}

/// <summary>
/// Server-side helpers for Artwork Studio. Everything that the stock Jellyfin API
/// already does well (deleting, reordering, listing provider images) is called
/// directly from the page; this controller covers uploads, web links and NAS files.
/// </summary>
[ApiController]
[Route("ArtworkStudio")]
[Authorize(Policy = "RequiresElevation")]
public class ArtworkStudioController : ControllerBase
{
    private const long MaxUploadBytes = 200L * 1024 * 1024;

    private static readonly HashSet<string> ImageExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp", ".tbn"
    };

    private readonly ILibraryManager _libraryManager;
    private readonly IProviderManager _providerManager;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IApplicationPaths _appPaths;
    private readonly ILogger<ArtworkStudioController> _logger;

    public ArtworkStudioController(
        ILibraryManager libraryManager,
        IProviderManager providerManager,
        IHttpClientFactory httpClientFactory,
        IApplicationPaths appPaths,
        ILogger<ArtworkStudioController> logger)
    {
        _libraryManager = libraryManager;
        _providerManager = providerManager;
        _httpClientFactory = httpClientFactory;
        _appPaths = appPaths;
        _logger = logger;
    }

    private static PluginConfiguration Config => Plugin.Instance?.Configuration ?? new PluginConfiguration();

    // ---------------------------------------------------------------- Library backdrops (browser script)

    /// <summary>Serves the browser script that shows library backdrops on library pages.</summary>
    [HttpGet("ClientScript")]
    [AllowAnonymous]
    [Produces("application/javascript")]
    public ActionResult GetClientScript()
    {
        var asm = typeof(Plugin).Assembly;
        var script = new System.Text.StringBuilder();
        foreach (var name in new[] { "libraryBackdrops.js", "siteTheme.js" })
        {
            using var stream = asm.GetManifestResourceStream(typeof(Plugin).Namespace + ".Web." + name);
            if (stream is null)
            {
                continue;
            }

            using var reader = new StreamReader(stream);
            script.Append(reader.ReadToEnd()).Append('\n');
        }

        var cfg = Config;
        var clientCfg = new
        {
            enabled = cfg.LibraryBackdrops,
            interval = Math.Clamp(cfg.BackdropRotateSeconds, 5, 600),
            dim = Math.Clamp(cfg.BackdropDimPercent, 0, 100),
            dimAll = cfg.DimAllBackdrops,
            home = ListPageFiles("home"),
            login = ListPageFiles("login"),
            brand = new
            {
                logo = ListPageFiles("logo").FirstOrDefault(),
                loginLogo = ListPageFiles("loginlogo").FirstOrDefault(),
                favicon = ListPageFiles("favicon").FirstOrDefault()
            },
            theme = cfg.Theme ?? new ThemeSettings()
        };
        var prefix = "window.__artworkStudioCfg=" + System.Text.Json.JsonSerializer.Serialize(clientCfg) + ";\n";
        Response.Headers.CacheControl = "no-cache";
        return Content(prefix + script, "application/javascript; charset=utf-8");
    }

    /// <summary>Reports whether the browser script is installed, and retries installing it.</summary>
    [HttpGet("ClientStatus")]
    public ActionResult GetClientStatus()
    {
        var plugin = Plugin.Instance;
        plugin?.InjectClientScript();
        return Ok(new
        {
            Installed = plugin?.ClientScriptInstalled ?? false,
            Status = plugin?.ClientScriptStatus ?? "Plugin not loaded."
        });
    }

    // ---------------------------------------------------------------- Home & login page backdrops

    // "home"/"login" hold several rotating backdrops; the brand slots hold a single image each.
    private static readonly string[] Pages = { "home", "login", "logo", "loginlogo", "favicon" };

    private static readonly string[] SingleImagePages = { "logo", "loginlogo", "favicon" };

    /// <summary>Lists the backdrops for the home or login page.</summary>
    [HttpGet("Backdrops/{page}")]
    [AllowAnonymous]
    public ActionResult ListPageBackdrops([FromRoute] string page)
    {
        if (!IsPage(page))
        {
            return NotFound();
        }

        var dir = PageDir(page);
        var files = Directory.Exists(dir)
            ? new DirectoryInfo(dir).EnumerateFiles()
                .Where(f => ImageExtensions.Contains(f.Extension))
                .OrderBy(f => f.Name, StringComparer.Ordinal)
                .Select(f => new { f.Name, Size = f.Length, Modified = f.LastWriteTimeUtc })
                .ToList<object>()
            : new List<object>();
        return Ok(new { Page = page, Files = files });
    }

    /// <summary>Serves one home/login backdrop (public, so the login page can show it).</summary>
    [HttpGet("Backdrops/{page}/{file}")]
    [AllowAnonymous]
    public ActionResult GetPageBackdrop([FromRoute] string page, [FromRoute] string file)
    {
        if (!IsPage(page) || !SafeFileName(file))
        {
            return NotFound();
        }

        var full = System.IO.Path.Combine(PageDir(page), file);
        if (!System.IO.File.Exists(full))
        {
            return NotFound();
        }

        Response.Headers.CacheControl = "public, max-age=86400";
        return PhysicalFile(full, MimeFromExtension(full) ?? "image/jpeg");
    }

    /// <summary>Adds a home/login backdrop from an uploaded file.</summary>
    [HttpPost("Backdrops/{page}/Upload")]
    [Consumes("multipart/form-data")]
    [RequestSizeLimit(MaxUploadBytes)]
    [RequestFormLimits(MultipartBodyLengthLimit = MaxUploadBytes)]
    public async Task<ActionResult> UploadPageBackdrop([FromRoute] string page, IFormFile file, CancellationToken cancellationToken)
    {
        if (!IsPage(page))
        {
            return NotFound();
        }

        if (file is null || file.Length == 0)
        {
            return BadRequest(new { message = "No file was received." });
        }

        if (file.Length > MaxBytes)
        {
            return BadRequest(new { message = $"That image is larger than the {Config.MaxImageSizeMb} MB limit." });
        }

        var temp = TempPath();
        try
        {
            await using (var output = System.IO.File.Create(temp))
            {
                await file.CopyToAsync(output, cancellationToken).ConfigureAwait(false);
            }

            return StorePageBackdrop(page, temp);
        }
        finally
        {
            TryDelete(temp);
        }
    }

    /// <summary>Adds a home/login backdrop from a web link.</summary>
    [HttpPost("Backdrops/{page}/FromUrl")]
    public async Task<ActionResult> PageBackdropFromUrl([FromRoute] string page, [FromBody] UrlImageRequest request, CancellationToken cancellationToken)
    {
        if (!IsPage(page))
        {
            return NotFound();
        }

        var temp = TempPath();
        try
        {
            var (error, _, _) = await DownloadToTempAsync(request.Url, temp, cancellationToken).ConfigureAwait(false);
            return error is not null ? BadRequest(new { message = error }) : StorePageBackdrop(page, temp);
        }
        finally
        {
            TryDelete(temp);
        }
    }

    /// <summary>Adds a home/login backdrop by copying a NAS image.</summary>
    [HttpPost("Backdrops/{page}/FromNas")]
    public ActionResult PageBackdropFromNas([FromRoute] string page, [FromBody] NasImageRequest request)
    {
        if (!IsPage(page))
        {
            return NotFound();
        }

        if (!TryResolve(request.Root, request.Path, out var full, out _, out var error))
        {
            return BadRequest(new { message = error });
        }

        if (!System.IO.File.Exists(full))
        {
            return NotFound(new { message = "That file no longer exists on the NAS." });
        }

        return StorePageBackdrop(page, full);
    }

    /// <summary>Removes a home/login backdrop.</summary>
    [HttpDelete("Backdrops/{page}/{file}")]
    public ActionResult DeletePageBackdrop([FromRoute] string page, [FromRoute] string file)
    {
        if (!IsPage(page) || !SafeFileName(file))
        {
            return NotFound();
        }

        var full = System.IO.Path.Combine(PageDir(page), file);
        if (System.IO.File.Exists(full))
        {
            System.IO.File.Delete(full);
        }

        return Ok(new { success = true });
    }

    private ActionResult StorePageBackdrop(string page, string source)
    {
        var mime = SniffFile(source);
        if (mime is null)
        {
            return BadRequest(new { message = "That file doesn't look like a supported image (JPG, PNG, WebP, GIF or BMP)." });
        }

        var ext = mime switch
        {
            "image/png" => ".png",
            "image/webp" => ".webp",
            "image/gif" => ".gif",
            "image/bmp" => ".bmp",
            _ => ".jpg"
        };
        var dir = PageDir(page);
        Directory.CreateDirectory(dir);
        if (SingleImagePages.Contains(page, StringComparer.Ordinal))
        {
            foreach (var existing in Directory.EnumerateFiles(dir))
            {
                System.IO.File.Delete(existing);
            }
        }

        var name = DateTime.UtcNow.ToString("yyyyMMddHHmmss", System.Globalization.CultureInfo.InvariantCulture) + "-" + Guid.NewGuid().ToString("N")[..8] + ext;
        System.IO.File.Copy(source, System.IO.Path.Combine(dir, name));
        _logger.LogInformation("Artwork Studio: added {Page} page backdrop {Name}", page, name);
        return Ok(new { success = true, Name = name });
    }

    private static bool IsPage(string page) => Pages.Contains(page, StringComparer.Ordinal);

    private static bool SafeFileName(string file) => Regex.IsMatch(file, "^[A-Za-z0-9][A-Za-z0-9._-]{0,120}$") && !file.Contains("..", StringComparison.Ordinal);

    private static string PageDir(string page)
    {
        var root = Plugin.Instance?.DataFolderPath ?? System.IO.Path.GetTempPath();
        return System.IO.Path.Combine(root, "backdrops", page);
    }

    private static string[] ListPageFiles(string page)
    {
        var dir = PageDir(page);
        if (!Directory.Exists(dir))
        {
            return Array.Empty<string>();
        }

        return new DirectoryInfo(dir).EnumerateFiles()
            .Where(f => ImageExtensions.Contains(f.Extension))
            .OrderBy(f => f.Name, StringComparer.Ordinal)
            .Select(f => f.Name)
            .ToArray();
    }

    // ---------------------------------------------------------------- NAS browsing

    /// <summary>Lists the configured NAS folders and whether Jellyfin can see them.</summary>
    [HttpGet("Roots")]
    public ActionResult GetRoots()
    {
        var roots = Config.NasRoots.Select((r, i) => new
        {
            Index = i,
            r.Name,
            r.Path,
            Exists = !string.IsNullOrWhiteSpace(r.Path) && Directory.Exists(r.Path)
        });
        return Ok(new { Roots = roots, Config.DefaultNasMode });
    }

    /// <summary>Lists folders and images inside a NAS folder.</summary>
    [HttpGet("Browse")]
    public ActionResult Browse([FromQuery] int root, [FromQuery] string? path)
    {
        if (!TryResolve(root, path, out var full, out var rootFull, out var error))
        {
            return BadRequest(new { message = error });
        }

        if (!Directory.Exists(full))
        {
            return NotFound(new { message = "That folder doesn't exist (or Jellyfin can't see it)." });
        }

        try
        {
            var dir = new DirectoryInfo(full);
            var folders = dir.EnumerateDirectories()
                .Where(d => !d.Name.StartsWith('.') && !d.Name.StartsWith('@') && !d.Name.StartsWith('#'))
                .OrderBy(d => d.Name, StringComparer.OrdinalIgnoreCase)
                .Select(d => new { d.Name, Path = Rel(rootFull, d.FullName) })
                .ToList();

            var files = dir.EnumerateFiles()
                .Where(f => ImageExtensions.Contains(f.Extension) && !f.Name.StartsWith('.'))
                .OrderBy(f => f.Name, StringComparer.OrdinalIgnoreCase)
                .Select(f => new { f.Name, Path = Rel(rootFull, f.FullName), Size = f.Length, Modified = f.LastWriteTimeUtc })
                .ToList();

            var rel = Rel(rootFull, full);
            string? parent = null;
            if (rel.Length > 0)
            {
                var cut = rel.LastIndexOf('/');
                parent = cut > 0 ? rel[..cut] : string.Empty;
            }

            return Ok(new { Path = rel, Parent = parent, Folders = folders, Files = files });
        }
        catch (UnauthorizedAccessException)
        {
            return StatusCode(403, new { message = "Jellyfin doesn't have permission to read that folder. Check the container's folder permissions on the NAS." });
        }
    }

    /// <summary>Searches a NAS folder (and its subfolders) for images whose name contains the text.</summary>
    [HttpGet("Search")]
    public ActionResult Search([FromQuery] int root, [FromQuery] string? path, [FromQuery] string q)
    {
        if (string.IsNullOrWhiteSpace(q))
        {
            return BadRequest(new { message = "Type something to search for." });
        }

        if (!TryResolve(root, path, out var full, out var rootFull, out var error))
        {
            return BadRequest(new { message = error });
        }

        if (!Directory.Exists(full))
        {
            return NotFound(new { message = "That folder doesn't exist." });
        }

        // Match every word in any order, ignoring punctuation: "dark knight" finds "The.Dark.Knight-backdrop.jpg"
        var words = Regex.Split(q.ToLowerInvariant(), "[^a-z0-9]+").Where(w => w.Length > 0).ToArray();
        var options = new EnumerationOptions
        {
            RecurseSubdirectories = true,
            IgnoreInaccessible = true,
            MaxRecursionDepth = 10,
            AttributesToSkip = FileAttributes.Hidden | FileAttributes.System
        };

        var results = new List<object>();
        foreach (var file in Directory.EnumerateFiles(full, "*", options))
        {
            if (!ImageExtensions.Contains(System.IO.Path.GetExtension(file)))
            {
                continue;
            }

            var rel = Rel(rootFull, file);
            var hay = Regex.Replace(rel.ToLowerInvariant(), "[^a-z0-9]+", " ");
            if (words.All(w => hay.Contains(w, StringComparison.Ordinal)))
            {
                var info = new FileInfo(file);
                results.Add(new { info.Name, Path = rel, Size = info.Length, Modified = info.LastWriteTimeUtc });
                if (results.Count >= 300)
                {
                    break;
                }
            }
        }

        return Ok(new { Path = Rel(rootFull, full), Files = results });
    }

    /// <summary>Streams a NAS image so the page can preview it.</summary>
    [HttpGet("File")]
    public ActionResult GetFile([FromQuery] int root, [FromQuery] string path)
    {
        if (!TryResolve(root, path, out var full, out _, out var error))
        {
            return BadRequest(new { message = error });
        }

        if (!System.IO.File.Exists(full) || !ImageExtensions.Contains(System.IO.Path.GetExtension(full)))
        {
            return NotFound();
        }

        Response.Headers.CacheControl = "private, max-age=300";
        return PhysicalFile(full, MimeFromExtension(full) ?? "application/octet-stream", enableRangeProcessing: false);
    }

    // ---------------------------------------------------------------- Setting artwork

    /// <summary>Uploads an image file from the browser.</summary>
    [HttpPost("Items/{itemId}/Upload")]
    [Consumes("multipart/form-data")]
    [RequestSizeLimit(MaxUploadBytes)]
    [RequestFormLimits(MultipartBodyLengthLimit = MaxUploadBytes)]
    public async Task<ActionResult> Upload(
        [FromRoute] Guid itemId,
        [FromQuery] string type,
        [FromQuery] int? index,
        IFormFile file,
        CancellationToken cancellationToken)
    {
        if (!TryGetTarget(itemId, type, out var item, out var imageType, out var fail))
        {
            return fail!;
        }

        if (file is null || file.Length == 0)
        {
            return BadRequest(new { message = "No file was received." });
        }

        if (file.Length > MaxBytes)
        {
            return BadRequest(new { message = $"That image is larger than the {Config.MaxImageSizeMb} MB limit set in Artwork Studio settings." });
        }

        var temp = TempPath();
        try
        {
            await using (var output = System.IO.File.Create(temp))
            {
                await file.CopyToAsync(output, cancellationToken).ConfigureAwait(false);
            }

            var mime = SniffFile(temp) ?? MimeFromExtension(file.FileName);
            if (mime is null)
            {
                return BadRequest(new { message = "That file doesn't look like a supported image (JPG, PNG, WebP, GIF or BMP)." });
            }

            await SaveCopyAsync(item!, temp, mime, imageType, index, cancellationToken).ConfigureAwait(false);
            _logger.LogInformation("Artwork Studio: uploaded {Type} for {Item}", imageType, item!.Name);
            return Ok(new { success = true });
        }
        finally
        {
            TryDelete(temp);
        }
    }

    /// <summary>Downloads an image from a web link and saves it to the item.</summary>
    [HttpPost("Items/{itemId}/FromUrl")]
    public async Task<ActionResult> FromUrl([FromRoute] Guid itemId, [FromBody] UrlImageRequest request, CancellationToken cancellationToken)
    {
        if (!TryGetTarget(itemId, request.Type, out var item, out var imageType, out var fail))
        {
            return fail!;
        }

        var temp = TempPath();
        try
        {
            var (error, mime, host) = await DownloadToTempAsync(request.Url, temp, cancellationToken).ConfigureAwait(false);
            if (error is not null)
            {
                return BadRequest(new { message = error });
            }

            await SaveCopyAsync(item!, temp, mime!, imageType, request.Index, cancellationToken).ConfigureAwait(false);
            _logger.LogInformation("Artwork Studio: saved {Type} for {Item} from {Url}", imageType, item!.Name, host);
            return Ok(new { success = true });
        }
        finally
        {
            TryDelete(temp);
        }
    }

    /// <summary>Downloads a web image into <paramref name="temp"/>. Returns an error message, or the detected MIME type.</summary>
    private async Task<(string? Error, string? Mime, string? Host)> DownloadToTempAsync(string? rawUrl, string temp, CancellationToken cancellationToken)
    {
        var normalized = NormalizeShareLink(rawUrl?.Trim() ?? string.Empty);
        if (!Uri.TryCreate(normalized, UriKind.Absolute, out var uri) || (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps))
        {
            return ("Please paste a full web link starting with http:// or https://", null, null);
        }

        try
        {
            using var cts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
            cts.CancelAfter(TimeSpan.FromSeconds(Math.Clamp(Config.DownloadTimeoutSeconds, 5, 600)));

            var client = _httpClientFactory.CreateClient(NamedClient.Default);
            using var message = new HttpRequestMessage(HttpMethod.Get, uri);
            message.Headers.TryAddWithoutValidation("Accept", "image/avif,image/webp,image/png,image/jpeg,image/*;q=0.9,*/*;q=0.5");
            message.Headers.TryAddWithoutValidation("User-Agent", "Mozilla/5.0 (Jellyfin Artwork Studio)");

            using var response = await client.SendAsync(message, HttpCompletionOption.ResponseHeadersRead, cts.Token).ConfigureAwait(false);
            if (!response.IsSuccessStatusCode)
            {
                return ($"The website answered with an error ({(int)response.StatusCode} {response.ReasonPhrase}). The link may be private or expired.", null, null);
            }

            var tooBig = $"That image is larger than the {Config.MaxImageSizeMb} MB limit.";
            if (response.Content.Headers.ContentLength is long len && len > MaxBytes)
            {
                return (tooBig, null, null);
            }

            await using (var input = await response.Content.ReadAsStreamAsync(cts.Token).ConfigureAwait(false))
            await using (var output = System.IO.File.Create(temp))
            {
                var buffer = new byte[81920];
                long total = 0;
                int read;
                while ((read = await input.ReadAsync(buffer, cts.Token).ConfigureAwait(false)) > 0)
                {
                    total += read;
                    if (total > MaxBytes)
                    {
                        return (tooBig, null, null);
                    }

                    await output.WriteAsync(buffer.AsMemory(0, read), cts.Token).ConfigureAwait(false);
                }
            }

            var mime = SniffFile(temp);
            if (mime is null)
            {
                var got = response.Content.Headers.ContentType?.MediaType ?? "unknown";
                var hint = got.Contains("html", StringComparison.OrdinalIgnoreCase)
                    ? " That's a web page, not the image itself — right-click the picture and choose \"Copy image address\", then paste that."
                    : string.Empty;
                return ($"That link didn't return a supported image (got {got}).{hint}", null, null);
            }

            return (null, mime, uri.Host);
        }
        catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            return ("The website took too long to respond.", null, null);
        }
        catch (HttpRequestException ex)
        {
            return ("Couldn't reach that website from the Jellyfin server: " + ex.Message, null, null);
        }
    }

    /// <summary>Uses an image from a NAS folder, either copying it or linking to it in place.</summary>
    [HttpPost("Items/{itemId}/FromNas")]
    public async Task<ActionResult> FromNas([FromRoute] Guid itemId, [FromBody] NasImageRequest request, CancellationToken cancellationToken)
    {
        if (!TryGetTarget(itemId, request.Type, out var item, out var imageType, out var fail))
        {
            return fail!;
        }

        if (!TryResolve(request.Root, request.Path, out var full, out _, out var error))
        {
            return BadRequest(new { message = error });
        }

        if (!System.IO.File.Exists(full))
        {
            return NotFound(new { message = "That file no longer exists on the NAS." });
        }

        var mime = SniffFile(full) ?? MimeFromExtension(full);
        if (mime is null)
        {
            return BadRequest(new { message = "That file isn't a supported image." });
        }

        var mode = string.IsNullOrWhiteSpace(request.Mode) ? Config.DefaultNasMode : request.Mode;
        if (string.Equals(mode, "link", StringComparison.OrdinalIgnoreCase))
        {
            var images = item!.GetImages(imageType).ToList();
            var index = item.AllowsMultipleImages(imageType)
                ? Math.Clamp(request.Index ?? images.Count, 0, images.Count)
                : 0;

            item.SetImage(
                new ItemImageInfo
                {
                    Path = full,
                    Type = imageType,
                    DateModified = System.IO.File.GetLastWriteTimeUtc(full)
                },
                index);

            await item.UpdateToRepositoryAsync(ItemUpdateType.ImageUpdate, cancellationToken).ConfigureAwait(false);
            _logger.LogInformation("Artwork Studio: linked {Type} for {Item} to {Path}", imageType, item.Name, full);
        }
        else
        {
            await SaveCopyAsync(item!, full, mime, imageType, request.Index, cancellationToken).ConfigureAwait(false);
            _logger.LogInformation("Artwork Studio: copied {Type} for {Item} from {Path}", imageType, item!.Name, full);
        }

        return Ok(new { success = true });
    }

    // ---------------------------------------------------------------- Helpers

    private static long MaxBytes => Math.Clamp(Config.MaxImageSizeMb, 1, 200) * 1024L * 1024L;

    private async Task SaveCopyAsync(BaseItem item, string sourcePath, string mime, ImageType type, int? index, CancellationToken cancellationToken)
    {
        bool? saveWithMedia = Config.SaveLocation?.ToLowerInvariant() switch
        {
            "media" => true,
            "metadata" => false,
            _ => null
        };

        // Only multi-image types (backdrops) use an index; null appends a new one.
        int? imageIndex = item.AllowsMultipleImages(type) ? index : null;

        await _providerManager.SaveImage(item, sourcePath, mime, type, imageIndex, saveWithMedia, cancellationToken).ConfigureAwait(false);
        await item.UpdateToRepositoryAsync(ItemUpdateType.ImageUpdate, cancellationToken).ConfigureAwait(false);
    }

    private bool TryGetTarget(Guid itemId, string? type, out BaseItem? item, out ImageType imageType, out ActionResult? fail)
    {
        item = _libraryManager.GetItemById(itemId);
        imageType = ImageType.Primary;
        fail = null;

        if (item is null)
        {
            fail = NotFound(new { message = "That item no longer exists in Jellyfin." });
            return false;
        }

        if (!Enum.TryParse(type, true, out imageType) || imageType == ImageType.Chapter || imageType == ImageType.Profile)
        {
            fail = BadRequest(new { message = $"Unknown artwork type '{type}'." });
            return false;
        }

        return true;
    }

    private static bool TryResolve(int rootIndex, string? relative, out string full, out string rootFull, out string error)
    {
        full = rootFull = error = string.Empty;
        var roots = Config.NasRoots;
        if (rootIndex < 0 || rootIndex >= roots.Length || string.IsNullOrWhiteSpace(roots[rootIndex].Path))
        {
            error = "That NAS folder isn't set up. Add it under Artwork Studio → Settings.";
            return false;
        }

        rootFull = System.IO.Path.GetFullPath(roots[rootIndex].Path).TrimEnd(System.IO.Path.DirectorySeparatorChar);
        if (rootFull.Length == 0)
        {
            rootFull = "/";
        }

        var rel = (relative ?? string.Empty).Replace('\\', '/').TrimStart('/');
        full = System.IO.Path.GetFullPath(System.IO.Path.Combine(rootFull, rel));

        var prefix = rootFull.EndsWith(System.IO.Path.DirectorySeparatorChar) ? rootFull : rootFull + System.IO.Path.DirectorySeparatorChar;
        if (!string.Equals(full, rootFull, StringComparison.Ordinal) && !full.StartsWith(prefix, StringComparison.Ordinal))
        {
            error = "That path is outside the configured NAS folder.";
            return false;
        }

        return true;
    }

    private static string Rel(string rootFull, string full)
    {
        var rel = System.IO.Path.GetRelativePath(rootFull, full).Replace('\\', '/');
        return rel == "." ? string.Empty : rel;
    }

    /// <summary>Turns common "share" links into direct image links.</summary>
    private static string NormalizeShareLink(string url)
    {
        // Google Drive: /file/d/{id}/view  or  open?id={id}
        var drive = Regex.Match(url, @"drive\.google\.com/(?:file/d/|open\?id=|uc\?(?:export=\w+&)?id=)([\w-]{10,})");
        if (drive.Success)
        {
            return "https://drive.google.com/uc?export=download&id=" + drive.Groups[1].Value;
        }

        // Dropbox: force raw content
        if (url.Contains("dropbox.com/", StringComparison.OrdinalIgnoreCase))
        {
            url = Regex.Replace(url, @"([?&])dl=0", "$1raw=1");
            if (!url.Contains("raw=1", StringComparison.Ordinal) && !url.Contains("dl=1", StringComparison.Ordinal))
            {
                url += (url.Contains('?') ? "&" : "?") + "raw=1";
            }

            return url;
        }

        // OneDrive short share links support ?download=1
        if (url.Contains("1drv.ms/", StringComparison.OrdinalIgnoreCase) && !url.Contains("download=1", StringComparison.Ordinal))
        {
            return url + (url.Contains('?') ? "&" : "?") + "download=1";
        }

        // Imgur page link -> direct image
        var imgur = Regex.Match(url, @"^https?://imgur\.com/([A-Za-z0-9]{5,8})$");
        if (imgur.Success)
        {
            return "https://i.imgur.com/" + imgur.Groups[1].Value + ".jpg";
        }

        return url;
    }

    private static string? SniffFile(string path)
    {
        Span<byte> b = stackalloc byte[16];
        int n;
        using (var fs = System.IO.File.OpenRead(path))
        {
            n = fs.Read(b);
        }

        b = b[..n];
        if (n >= 3 && b[0] == 0xFF && b[1] == 0xD8 && b[2] == 0xFF)
        {
            return MediaTypeNames.Image.Jpeg;
        }

        if (n >= 8 && b[0] == 0x89 && b[1] == 0x50 && b[2] == 0x4E && b[3] == 0x47)
        {
            return "image/png";
        }

        if (n >= 6 && b[0] == 'G' && b[1] == 'I' && b[2] == 'F' && b[3] == '8')
        {
            return MediaTypeNames.Image.Gif;
        }

        if (n >= 12 && b[0] == 'R' && b[1] == 'I' && b[2] == 'F' && b[3] == 'F' && b[8] == 'W' && b[9] == 'E' && b[10] == 'B' && b[11] == 'P')
        {
            return "image/webp";
        }

        if (n >= 2 && b[0] == 'B' && b[1] == 'M')
        {
            return "image/bmp";
        }

        return null;
    }

    private static string? MimeFromExtension(string name)
    {
        return System.IO.Path.GetExtension(name).ToLowerInvariant() switch
        {
            ".jpg" or ".jpeg" or ".tbn" => MediaTypeNames.Image.Jpeg,
            ".png" => "image/png",
            ".webp" => "image/webp",
            ".gif" => MediaTypeNames.Image.Gif,
            ".bmp" => "image/bmp",
            _ => null
        };
    }

    private string TempPath()
    {
        Directory.CreateDirectory(_appPaths.TempDirectory);
        return System.IO.Path.Combine(_appPaths.TempDirectory, "artworkstudio-" + Guid.NewGuid().ToString("N"));
    }

    private void TryDelete(string path)
    {
        try
        {
            if (System.IO.File.Exists(path))
            {
                System.IO.File.Delete(path);
            }
        }
        catch (IOException ex)
        {
            _logger.LogDebug(ex, "Artwork Studio: couldn't delete temp file {Path}", path);
        }
    }
}
