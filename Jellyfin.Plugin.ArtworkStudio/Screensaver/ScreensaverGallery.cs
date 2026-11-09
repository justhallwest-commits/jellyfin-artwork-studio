using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Security.Cryptography;
using System.Text;

namespace Jellyfin.Plugin.ArtworkStudio.Screensaver;

/// <summary>One picture in the screensaver gallery.</summary>
/// <param name="Id">Stable id the TV apps use to load it (as if it were an item's backdrop).</param>
/// <param name="File">File name in the gallery folder.</param>
/// <param name="FullPath">Full path on the server.</param>
/// <param name="Tag">Changes whenever the file changes, so apps don't show an old copy.</param>
public sealed record GalleryPicture(Guid Id, string File, string FullPath, string Tag);

/// <summary>
/// The screensaver gallery: the pictures uploaded on Artwork Studio's Screensaver tab. They live in the
/// plugin's data folder ("backdrops/screensaver"), next to the home and login page backdrops.
/// </summary>
public static class ScreensaverGallery
{
    public const string Page = "screensaver";

    private static readonly HashSet<string> Extensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp"
    };

    private static readonly TimeSpan CacheFor = TimeSpan.FromSeconds(10);

    private static readonly object Lock = new();

    private static IReadOnlyList<GalleryPicture> _cached = Array.Empty<GalleryPicture>();

    private static Dictionary<Guid, GalleryPicture> _byId = new();

    private static DateTime _cachedAt = DateTime.MinValue;

    public static string Folder => Path.Combine(Plugin.Instance?.DataFolderPath ?? Path.GetTempPath(), "backdrops", Page);

    /// <summary>The gallery, oldest first.</summary>
    public static IReadOnlyList<GalleryPicture> List()
    {
        lock (Lock)
        {
            if (DateTime.UtcNow - _cachedAt < CacheFor)
            {
                return _cached;
            }

            var list = new List<GalleryPicture>();
            try
            {
                var dir = new DirectoryInfo(Folder);
                if (dir.Exists)
                {
                    list = dir.EnumerateFiles()
                        .Where(f => Extensions.Contains(f.Extension))
                        .OrderBy(f => f.Name, StringComparer.Ordinal)
                        .Select(f => new GalleryPicture(IdFor(f.Name), f.Name, f.FullName, TagFor(f)))
                        .ToList();
                }
            }
            catch (Exception ex) when (ex is IOException || ex is UnauthorizedAccessException)
            {
                // unreadable folder: behave as if empty
            }

            _cached = list;
            _byId = list.ToDictionary(p => p.Id);
            _cachedAt = DateTime.UtcNow;
            return _cached;
        }
    }

    /// <summary>Finds a gallery picture by the id the apps use.</summary>
    public static GalleryPicture? Find(Guid id)
    {
        List();
        lock (Lock)
        {
            return _byId.TryGetValue(id, out var p) ? p : null;
        }
    }

    /// <summary>Call after adding or removing pictures so the apps see the change straight away.</summary>
    public static void Invalidate()
    {
        lock (Lock)
        {
            _cachedAt = DateTime.MinValue;
        }
    }

    public static Guid IdFor(string file) => new(MD5.HashData(Encoding.UTF8.GetBytes("ArtworkStudio.Screensaver/" + file)));

    public static string MimeFor(string path) => Path.GetExtension(path).ToLowerInvariant() switch
    {
        ".png" => "image/png",
        ".webp" => "image/webp",
        ".gif" => "image/gif",
        ".bmp" => "image/bmp",
        _ => "image/jpeg"
    };

    private static string TagFor(FileInfo f)
        => Convert.ToHexString(MD5.HashData(Encoding.UTF8.GetBytes(f.Name + "|" + f.Length + "|" + f.LastWriteTimeUtc.Ticks))).ToLowerInvariant()[..16];
}
