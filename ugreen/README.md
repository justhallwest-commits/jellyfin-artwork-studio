# HallFlix on Jellyfin 12 — UGREEN NAS setup

This sets up **Jellyfin 12** on a UGREEN NAS (UGOS Pro) with all the HallFlix plugins already installed:

- **Artwork Studio** — artwork, site design, themes, sign-in page, Extras, Other apps
- **Pre-Roll Videos** — pre-rolls before movies and episodes
- **Bulk Metadata Editor** — bulk editing across all libraries

Everything is done in the UGOS web interface — no terminal. The new server runs **next to** the Jellyfin you have now (App Center, port 8899) on port **8097**, so nothing changes on the current server until you decide to switch.

> UGREEN's App Center Jellyfin can't be upgraded to 12 itself, so this uses UGOS's Docker app with the official `jellyfin/jellyfin` image.

---

## 1. Make the folders

In **Files**, open your `docker` shared folder (create it if it doesn't exist) and make:

```
docker/jellyfin12/config
docker/jellyfin12/cache
```

Check which volume your shares are on: right-click the `docker` folder → **Properties**. The paths below assume **volume 1** (`/volume1/...`). Also note the name of the shared folder that holds your movies and shows (the file uses `Media`).

## 2. Create the Docker project

1. Open **Docker → Project → Create**.
2. **Project name:** `hallflix-jellyfin12`
3. **Storage path:** `docker/jellyfin12`
4. **Compose configuration:** paste the contents of [`docker-compose.yml`](docker-compose.yml).
5. Edit two things in the pasted text:
   - `/volume1/Media:/media` — change `/volume1/Media` to your media share (keep `:/media`).
   - If any path isn't on volume 1, change `/volume1` to match.
6. **Deploy**.

UGOS first runs a small helper (`hallflix-plugins`) that downloads the Jellyfin 12 versions of the three plugins into the config folder. It finishes after a few seconds, and then Jellyfin starts. The helper showing as *Exited* afterwards is normal.

> If deployment fails with a message about `/dev/dri`, your model has no Intel graphics device. Delete the two `devices:` lines and deploy again (you only lose hardware transcoding).

## 3. First start

1. Open `http://<your NAS IP>:8097` (e.g. `http://192.168.254.204:8097`).
2. Go through the setup wizard: language, your admin user, and then your libraries.
   - Your media is at `/media` inside Jellyfin. For example: Movies → `/media/Movies`, Shows → `/media/TV Shows`, Pre-rolls → `/media/Prerolls`.
3. Open **Dashboard → Plugins**. Artwork Studio, Pre-Roll Videos and Bulk Metadata Editor should all show as **Active**.

## 4. Add the HallFlix catalog (for updates)

**Dashboard → Plugins → Repositories → +**

- Name: `HallFlix`
- URL: `https://raw.githubusercontent.com/justhallwest-commits/jellyfin-artwork-studio/main/catalog/manifest.json`

This one address covers all three plugins. Jellyfin then offers updates on its own. Restarting the Docker project also fetches the newest versions.

## 5. Set up the plugins

- **Pre-Roll Videos:** Dashboard → Plugins → Pre-Roll Videos → choose your Prerolls library → Save.
- **Artwork Studio:** Dashboard → Artwork Studio.
  - **Move your design over:** on the *old* server use **Settings → Export settings**, then **Settings → Import settings…** here. This brings your design, Extras and options. Afterwards, check **Settings → NAS folders** (container paths may differ on the new server), and re-add uploaded logos, page backdrops and animated covers (Design and Extras tabs), since those files live in the old server's hidden app folder.
  - **Posters and backdrops you set on movies and shows** come back on their own only if they were saved next to the media files. That's the case when *Settings → Where copied artwork is saved* was "Next to the media files", or when the library had Jellyfin's "Save artwork into media folders" switched on. Otherwise they're in the old server's own metadata: Jellyfin downloads the standard artwork again, and custom picks need setting again. To keep custom artwork from now on, choose "Next to the media files" on the new server.
  - **Other apps** tab: switch on the splashscreen, sign-in message and Custom CSS options so Roku, Fire TV, Apple TV and Samsung TVs pick up the design.
- **Bulk Metadata Editor:** Dashboard → Bulk Metadata Editor. No setup needed.

Refresh the browser (Ctrl+F5) after saving designs.

## 6. Switch HallFlix to the new server

When you're happy with it, point `hallflix.net` at port **8097** instead of **8899**, wherever that's set up today (router port forward, reverse proxy or tunnel). Then stop the old Jellyfin in App Center. Apps that already know the server just need signing in again.

---

## Notes

- **Jellyfin 12 changes:** the web app uses the new **Modern** layout by default (users can pick *Legacy* under Settings → Display). Artwork Studio styles both, and the TV layout too. Older apps that still use the legacy `/emby/` addresses or the old sign-in method won't connect. Current official apps are fine.
- **Users and watch history** don't come across in a fresh install. Moving them means copying the App Center server's hidden config folder, which needs SSH, so it isn't covered here.
- **Keep Jellyfin running as root** (the image's default; don't add `user:` or `PUID` to the file). Artwork Studio adds its script to Jellyfin's web files, and only root can write there.
- **Updating Jellyfin:** in **Docker → Image**, pull `jellyfin/jellyfin:12.4` again (or use the project's update/rebuild option if your UGOS version has one), then restart the project. This gets the newest 12.4 fixes. To move to a later 12.x release, change `jellyfin/jellyfin:12.4` in the project to the new number.
- **Plugin shows "Malfunctioned" or "Not supported":** open the HallFlix catalog (step 4) and install the version for Jellyfin 12 (the last number of the version is `12`), then restart.
