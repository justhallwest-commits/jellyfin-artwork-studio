# Artwork Studio for Jellyfin

A friendly place in the Jellyfin dashboard to add and manage artwork for your libraries and everything in them — posters, backdrops, logos, thumbs, banners, clear art, disc art, box art and more.

**Works with Jellyfin 10.10 and 10.11** — each release contains a build for both, and the plugin catalog picks the right one.

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
- **Bulk apply:** select many items and put the same image on all of them, optionally skipping ones that already have it.

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

Delete, reorder and provider lookups use Jellyfin's standard image endpoints. Omit `Index` to add a new backdrop; pass one to replace that backdrop.
