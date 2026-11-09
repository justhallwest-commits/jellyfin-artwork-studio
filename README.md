# Artwork Studio for Jellyfin

A friendly place in the Jellyfin dashboard to add and manage artwork for your libraries and everything in them — posters, backdrops, logos, thumbs, banners, clear art, disc art, box art and more.

**Works with Jellyfin 10.10, 10.11 and 12**: each release contains a build for each, and the plugin catalog picks the right one.

## What it does

- **Browse everything** by library, search by title, filter by type, or show only items **missing** a poster/backdrop/logo/etc. Each card shows P/B/L/T badges for what it already has.
- **Library artwork** — change the tiles shown for each library on the home screen.
- **One editor per item** with a slot for every artwork type, showing size and resolution.
- **Four sources for every slot:**
  - **Upload** from your computer or phone
  - **Web link** — any public image URL; Google Drive, Dropbox, OneDrive and Imgur share links are converted automatically
  - **NAS** — browse or search your artwork folders with thumbnails, then **Copy** into Jellyfin or **Link** to the file in place
  - **Online** — Jellyfin's built-in providers (TMDB, Fanart.tv…), sorted by rating, with language filter
- **Shortcuts:** drag a file onto a slot, drag a picture straight from another browser tab, or click a slot and press **Ctrl+V**.
- **Multiple backdrops:** add, reorder, make any one the main backdrop, remove.
- **Design tab:** your own header logo, login logo and browser-tab icon; site name in the tab; accent and background colours; Google Fonts; top-bar style (glass/solid/transparent); poster corner roundness and hover zoom; backdrop blur; login welcome message, frosted sign-in box, hide Forgot Password / Quick Connect; a home-page announcement banner; custom CSS — with a live preview.
- **Extras tab** (each switchable, all pause during video playback): spotlight banner with muted trailers, trailer-on-hover, poster badges (4K / HDR / Dolby Vision / Atmos / NEW / rating), animated library covers (GIF / MP4 / WebM), "Surprise me" random picker, cinematic drifting backdrops, title logos, ambient page colour, time left & "Ends at", pause screen, branded loading screen and logo spinner, restyled up-next card, animated "Who's watching?", seasonal themes with falling effects, Ctrl+K quick search and scheduled announcements. Login, home and library backgrounds can also be MP4/WebM loops.
- **13 theme presets:** one-click looks inspired by JellyFlix, DarkFlix, ElegantFin, NeutralFin, Jamfin, better-jellyfin-ui, Ultrachromic, Monochromic, Finimalism, Catppuccin, Scyfin, Evergarden and JellySkin — rebuilt from scratch, version-independent, blended with your own backdrops and logo colour, and never touching your uploads.
- **Page backgrounds:** your own backdrops for each library page, the home page and the login page, with adjustable darkness.
- **Fill from online:** select items and fill missing artwork with the best-rated provider image.
- **Backup:** export/import all settings as a file.
- **Bulk apply:** select many items and put the same image on all of them, optionally skipping ones that already have it.

## Screensaver gallery

The **Screensaver** tab holds a gallery of your own pictures for your TVs' screensavers. Drop in as many as you like (big photos are shrunk to 4K as they upload), or add them from a web link, your NAS or online through the editor.

| App | How your pictures show |
|---|---|
| Jellyfin app on **Fire TV / Android TV** | Automatically, in the app's own screensaver (on by default, after 5 minutes; app Settings → Screensaver). Fire TV runs it while the Jellyfin app is open. |
| Jellyfin on **LG / Samsung TVs**, browsers, Jellyfin Media Player, Xbox | After choosing Settings → Display → Screensaver → **Backdrop** in the app (once per device). |
| **HallFlix TV** app | Built-in screensaver: starts after a few minutes without a button press (never during playback), any button closes it. Timing, picture length and clock are set on the tab. |
| Apple TV (Swiftfin, Infuse), Roku | Not possible: Apple TV doesn't let apps provide a screensaver, and Jellyfin's Roku app has none. Apple TV's own screensaver can show the same pictures from an iCloud Photos album. |

Choose **only my pictures** or **mixed with movie & show backdrops** (with how much of each), and which apps get them. With no pictures (or the option off) every screensaver works as before.

How it works: those screensavers ask the server for "random movies and shows with a backdrop". Artwork Studio recognises exactly those requests (from the Fire TV app, or the web app's backdrop screensaver) and answers with your pictures, served at Jellyfin's normal image address. Every other request is left alone.

## Other Jellyfin apps

Web-based apps (browsers, the Android and iPhone/iPad apps, Jellyfin Media Player, LG webOS, Xbox, custom WebView apps) load the server's web app and get everything. Native apps don't run the site script, so the **Other apps** tab fills in Jellyfin's own branding for them:

- **Splashscreen** — the first sign-in (or home) backdrop becomes Jellyfin's splashscreen, kept in sync. Roku (Settings → User Interface → General → Channel Background Image → Splashscreen Image), Android TV / Fire TV (sign-in screens) and Swiftfin ("Use splashscreen") show it.
- **Login disclaimer** — the Design sign-in message is copied into Jellyfin's login disclaimer (Android TV / Fire TV, Swiftfin, Samsung).
- **Custom CSS** — the design is published as a marked block in Branding → Custom CSS for apps with their own copy of the web app (Samsung TVs). Existing Custom CSS is kept.

Item artwork, library tile pictures and user pictures are saved into Jellyfin itself, so every app shows them. Switching any option off restores what Jellyfin had before.

## HallFlix TV app

A remote-control interface for TVs, served by this plugin at `<server>/ArtworkStudio/TV/` and wrapped as apps for **LG (webOS)**, **Samsung (Tizen)**, **Android TV / Google TV** and **Amazon Fire TV**. It's built around the Design and Extras settings (accent, preset, fonts, corners, logo, backdrops, spotlight and its libraries, badges, announcements, the admin's home layout), plays Pre-Roll Videos before titles, and follows Content Guard because everything comes from the server. Android TV / Fire TV hand playback to ExoPlayer for wide format support. Updating the plugin updates every TV.

Downloads: the [tv-app release](https://github.com/justhallwest-commits/jellyfin-artwork-studio/releases/tag/tv-app). Fire TV / Android TV: open Downloader and type `<server>/ArtworkStudio/TV/apk`. Step-by-step for every TV: [tv/INSTALL.md](tv/INSTALL.md).

## Install

### Option A — plugin repository (recommended)
1. Push this repo to GitHub as `justhallwest-commits/jellyfin-artwork-studio`.
2. Every push to `main` builds the plugin and publishes a new release (`v1.0.<build number>`) with the zip and `manifest.json` attached — no manual tagging needed. Change `BASE_VERSION` in the workflow for a bigger version bump.
3. In Jellyfin: **Dashboard → Plugins → Repositories → +**, URL:
   `https://github.com/justhallwest-commits/jellyfin-artwork-studio/releases/latest/download/manifest.json`
4. **Catalog → Artwork Studio → Install**, then restart Jellyfin.

### Option B — manual
1. Download the zip from the latest release (or the `artwork-studio` artifact on any workflow run).
2. Unzip `Jellyfin.Plugin.ArtworkStudio.dll` into a new folder `plugins/ArtworkStudio_1.0.0.0/` inside Jellyfin's config folder.
3. Restart Jellyfin.

It then appears in the dashboard sidebar as **Artwork Studio**.

## Hooking up the UGREEN NAS

Jellyfin runs in a container, so it only sees folders you map into it.

1. UGOS → **Docker → Containers** → stop Jellyfin → **Edit**.
2. **Storage space / Volume → Add**: NAS folder e.g. `/volume1/Media/Artwork` → container path `/artwork` (read-only is fine for Copy mode).
3. Start the container. In **Artwork Studio → Settings** add a NAS folder with path `/artwork`. A green **Found** tick confirms it.

Folders already mapped for your libraries (e.g. `/media`) can be added too.

### Copy vs Link
- **Copy** (default) — Jellyfin stores its own copy. Safe if the NAS file moves later.
- **Link** — Jellyfin points at the NAS file; nothing is duplicated, and editing the file on the NAS updates the artwork. Linked images show an orange **NAS** tag. Moving/renaming the file, or a metadata refresh with *Replace existing images*, will drop it.

### Where copies go
Settings → *Where copied artwork is saved*: follow each library's "Save artwork into media folders" setting, always next to the media (`poster.jpg`, `fanart.jpg`…), or always in Jellyfin's metadata folder.

## Notes
- Only administrators can open the page or use its API.
- NAS browsing is locked to the folders you configure.
- Web links are downloaded by the Jellyfin server, so the link must be reachable from it. Default limit 40 MB, 45 s timeout (adjustable).

## API (admin only)
| Method | Route | Purpose |
|---|---|---|
| GET | `/ArtworkStudio/Roots` | Configured NAS folders + whether they exist |
| GET | `/ArtworkStudio/Browse?root=&path=` | Folders and images in a NAS folder |
| GET | `/ArtworkStudio/Search?root=&path=&q=` | Search image file names recursively |
| GET | `/ArtworkStudio/File?root=&path=` | Stream a NAS image (previews) |
| POST | `/ArtworkStudio/Items/{id}/Upload?type=&index=` | Multipart upload (`file`) |
| POST | `/ArtworkStudio/Items/{id}/FromUrl` | `{ Type, Index, Url }` |
| POST | `/ArtworkStudio/Items/{id}/FromNas` | `{ Type, Index, Root, Path, Mode }` |
| GET / DELETE | `/ArtworkStudio/Backdrops/screensaver[/{file}]` | List / remove screensaver pictures |
| POST | `/ArtworkStudio/Backdrops/screensaver/Upload` · `FromUrl` · `FromNas` | Add a screensaver picture |

Delete, reorder and provider lookups use Jellyfin's standard image endpoints. Omit `Index` to add a new backdrop; pass one to replace that backdrop.
