using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using Jellyfin.Plugin.ArtworkStudio.Configuration;
using MediaBrowser.Common.Configuration;
using MediaBrowser.Common.Plugins;
using MediaBrowser.Controller;
using MediaBrowser.Model.Plugins;
using MediaBrowser.Model.Serialization;
using Microsoft.Extensions.Logging;

namespace Jellyfin.Plugin.ArtworkStudio;

/// <summary>
/// Artwork Studio: a friendly dashboard page for managing posters, backdrops,
/// logos and other artwork for libraries and items.
/// </summary>
public class Plugin : BasePlugin<PluginConfiguration>, IHasWebPages
{
    private const string ScriptMarker = "data-artwork-studio";
    private const string ScriptTag = "<script data-artwork-studio defer src=\"../ArtworkStudio/ClientScript\"></script>";

    private readonly ILogger<Plugin> _logger;
    private readonly string? _webPath;

    public Plugin(IApplicationPaths applicationPaths, IXmlSerializer xmlSerializer, ILogger<Plugin> logger)
        : base(applicationPaths, xmlSerializer)
    {
        Instance = this;
        _logger = logger;
        _webPath = (applicationPaths as IServerApplicationPaths)?.WebPath;
        InjectClientScript();
        SyncMenuLinks();
        ConfigurationChanged += (_, _) => SyncMenuLinks();
    }

    /// <summary>
    /// Writes the Design → side-menu links into the web app's config.json ("menuLinks"), keeping any links
    /// that were put there by hand. Links Artwork Studio added before are tracked by URL in the plugin's data folder.
    /// </summary>
    public void SyncMenuLinks()
    {
        try
        {
            var file = string.IsNullOrEmpty(_webPath) ? null : Path.Combine(_webPath, "config.json");
            if (file is null || !File.Exists(file))
            {
                return;
            }

            var stateFile = Path.Combine(DataFolderPath, "menu-links.json");
            var ours = File.Exists(stateFile)
                ? (System.Text.Json.JsonSerializer.Deserialize<string[]>(File.ReadAllText(stateFile)) ?? Array.Empty<string>())
                : Array.Empty<string>();

            var root = System.Text.Json.Nodes.JsonNode.Parse(File.ReadAllText(file)) as System.Text.Json.Nodes.JsonObject;
            if (root is null)
            {
                return;
            }

            var existing = root["menuLinks"] as System.Text.Json.Nodes.JsonArray ?? new System.Text.Json.Nodes.JsonArray();
            var keep = new System.Text.Json.Nodes.JsonArray();
            foreach (var link in existing)
            {
                var url = link?["url"]?.GetValue<string>() ?? string.Empty;
                if (!ours.Contains(url, StringComparer.Ordinal))
                {
                    keep.Add(link?.DeepClone());
                }
            }

            var wanted = (Configuration.Theme?.MenuLinks ?? Array.Empty<MenuLink>())
                .Where(l => !string.IsNullOrWhiteSpace(l.Name) && Uri.TryCreate(l.Url?.Trim(), UriKind.Absolute, out var u) && (u.Scheme == Uri.UriSchemeHttps || u.Scheme == Uri.UriSchemeHttp))
                .ToList();
            foreach (var l in wanted)
            {
                keep.Add(new System.Text.Json.Nodes.JsonObject
                {
                    ["name"] = l.Name.Trim(),
                    ["url"] = l.Url.Trim(),
                    ["icon"] = string.IsNullOrWhiteSpace(l.Icon) ? "link" : l.Icon.Trim()
                });
            }

            var before = existing.ToJsonString();
            if (before != keep.ToJsonString())
            {
                root["menuLinks"] = keep;
                File.WriteAllText(file, root.ToJsonString(new System.Text.Json.JsonSerializerOptions { WriteIndented = true }));
                _logger.LogInformation("Artwork Studio: updated side-menu links in {File}", file);
            }

            Directory.CreateDirectory(DataFolderPath);
            File.WriteAllText(stateFile, System.Text.Json.JsonSerializer.Serialize(wanted.Select(l => l.Url.Trim()).ToArray()));
        }
        catch (Exception ex) when (ex is UnauthorizedAccessException || ex is IOException || ex is System.Text.Json.JsonException || ex is InvalidOperationException)
        {
            _logger.LogWarning("Artwork Studio: couldn't update side-menu links: {Message}", ex.Message);
        }
    }

    public static Plugin? Instance { get; private set; }

    /// <summary>Gets a short description of whether the browser script is installed in the web app.</summary>
    public string ClientScriptStatus { get; private set; } = "unknown";

    /// <summary>Gets a value indicating whether the browser script is installed in the web app.</summary>
    public bool ClientScriptInstalled { get; private set; }

    /// <summary>Adds the library-backdrop script tag to jellyfin-web's index.html (idempotent).</summary>
    public void InjectClientScript()
    {
        try
        {
            var index = string.IsNullOrEmpty(_webPath) ? null : Path.Combine(_webPath, "index.html");
            if (index is null || !File.Exists(index))
            {
                ClientScriptStatus = "Couldn't find the Jellyfin web files to add the script to.";
                return;
            }

            var html = File.ReadAllText(index);
            if (html.Contains(ScriptMarker, StringComparison.Ordinal))
            {
                ClientScriptInstalled = true;
                ClientScriptStatus = "Installed in the Jellyfin web app.";
                return;
            }

            var at = html.LastIndexOf("</body>", StringComparison.OrdinalIgnoreCase);
            if (at < 0)
            {
                ClientScriptStatus = "The Jellyfin web page has an unexpected layout.";
                return;
            }

            File.WriteAllText(index, html.Insert(at, ScriptTag));
            ClientScriptInstalled = true;
            ClientScriptStatus = "Installed in the Jellyfin web app.";
            _logger.LogInformation("Artwork Studio: added library backdrop script to {Index}", index);
        }
        catch (Exception ex) when (ex is UnauthorizedAccessException || ex is IOException)
        {
            ClientScriptStatus = "Jellyfin isn't allowed to modify its web files (" + ex.Message + ").";
            _logger.LogWarning("Artwork Studio: couldn't add library backdrop script: {Message}", ex.Message);
        }
    }

    public override void OnUninstalling()
    {
        try
        {
            var index = string.IsNullOrEmpty(_webPath) ? null : Path.Combine(_webPath, "index.html");
            if (index is not null && File.Exists(index))
            {
                var html = File.ReadAllText(index);
                if (html.Contains(ScriptTag, StringComparison.Ordinal))
                {
                    File.WriteAllText(index, html.Replace(ScriptTag, string.Empty, StringComparison.Ordinal));
                }
            }
        }
        catch (Exception ex) when (ex is UnauthorizedAccessException || ex is IOException)
        {
            _logger.LogWarning("Artwork Studio: couldn't remove library backdrop script: {Message}", ex.Message);
        }

        base.OnUninstalling();
    }

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
