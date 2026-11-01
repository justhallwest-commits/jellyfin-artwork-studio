# Installing HallFlix on your TVs

HallFlix TV is a remote-control version of your server, built around Artwork Studio. The TV apps are small: each one asks for your server's address once, then opens the interface that **Artwork Studio** serves at `<server>/ArtworkStudio/TV/`. So:

- your accent colour, preset, fonts, card corners, logo, login backdrops, home backdrops, spotlight, badges, announcements and the admin's home-screen order all show up on the TV;
- **Pre-Roll Videos** play before movies, and **Content Guard** rules apply, because both come from the server;
- updating Artwork Studio updates every TV. You only reinstall a TV app when the release notes say the app itself changed.

**Before you start:** update Artwork Studio to **1.0.35 or newer** (Dashboard → Plugins), restart Jellyfin, and check that `http://<server>:8096/ArtworkStudio/TV/` opens in a web browser on your network.

Downloads are in the [tv-app release](https://github.com/justhallwest-commits/jellyfin-artwork-studio/releases/tag/tv-app). Your server also has short links you can type on a TV:

| Short link | File |
|---|---|
| `<server>/ArtworkStudio/TV/apk` | Android TV / Google TV / Fire TV app |
| `<server>/ArtworkStudio/TV/lg` | LG app |
| `<server>/ArtworkStudio/TV/samsung` | Samsung app (unsigned) |

`<server>` is the address you use in a browser, for example `192.168.1.20:8096`.

---

## Amazon Fire TV

1. On the Fire TV, go to **Settings → My Fire TV → Developer Options**. If you don't see Developer Options, go to **About**, highlight your Fire TV's name and press the select button 7 times.
2. Install the **Downloader** app (by AFTVnews) from the Amazon Appstore.
3. In Developer Options, turn on **Install unknown apps** for **Downloader** (on older models: **Apps from Unknown Sources** → On).
4. Open Downloader, type `<server>/ArtworkStudio/TV/apk` (for example `192.168.1.20:8096/ArtworkStudio/TV/apk`) and press **Go**.
5. Choose **Install**, then **Open**. You can delete the downloaded file afterwards when Downloader asks.
6. Type your server's address and press **Connect**. Pick your profile and sign in, or use **Quick Connect**.

HallFlix appears under **Your Apps & Games**. To put it on the home row, highlight it, press the menu (☰) button and choose **Move to front**.

## Android TV / Google TV (Chromecast with Google TV, Sony, TCL, Hisense, NVIDIA Shield…)

1. **Settings → System → About**, highlight **Android TV OS build** (or **Build**) and press select 7 times to turn on developer options.
2. Install **Downloader** by AFTVnews from the Google Play Store.
3. **Settings → Apps → Security & restrictions → Unknown sources** → turn on **Downloader**. (The wording varies; search Settings for "unknown".)
4. Open Downloader, enter `<server>/ArtworkStudio/TV/apk`, install and open, then connect as above.

HallFlix shows in the apps row with its own banner.

## LG TVs (webOS 4 / 2018 and newer)

LG only allows your own apps through its free **Developer Mode**. It's official, it doesn't void anything and firmware updates keep working.

1. On a computer, create a free account at [webostv.developer.lge.com](https://webostv.developer.lge.com) (Sign In → Create Account).
2. On the TV, install **Developer Mode** from the LG Content Store, open it, sign in, turn **Dev Mode Status** on and let the TV restart.
3. Open Developer Mode again and turn on **Key Server**. Note the TV's IP address shown there.
4. On the computer, install **webOS Dev Manager** ([webosbrew/dev-manager-desktop](https://github.com/webosbrew/dev-manager-desktop/releases)), click **Add device**, enter the TV's IP and the passphrase from the Developer Mode app.
5. Download `HallFlix-LG-webOS.ipk` from the release, then in Dev Manager choose **Apps → Install** and pick the file.
6. Open **HallFlix** from the TV's app list, type your server's address and connect.

**Keep it installed:** Developer Mode sessions last about 1000 hours. Before it runs out, open the Developer Mode app and press **Extend** next to the session time, otherwise LG removes developer apps and you reinstall with step 5. Dev Manager can also extend the session for you.

The Magic Remote pointer works too: point at anything and click.

## Samsung TVs (Tizen 4 / 2018 and newer)

Samsung needs every sideloaded app signed with a certificate made for your TV. **Apps2Samsung** (formerly Jellyfin2Samsung) does the signing and installing for you.

1. On the TV, open **Apps**, then press **1 2 3 4 5** on the remote. In the Developer Mode box, turn it **On**, enter your computer's IP address and restart the TV (hold the power button until it restarts).
2. On the computer, download and run **Apps2Samsung** ([Apps2Samsung releases](https://github.com/Apps2Samsung/Apps2Samsung/releases)). It finds the TV on your network.
3. Download `HallFlix-Samsung-unsigned.wgt` from the release.
4. In Apps2Samsung choose **Custom WGT file**, pick the file and install. Sign in with a Samsung account if it asks: that's how it makes the certificate for your TV.
5. Open **HallFlix** from Apps, type your server's address and connect.

Prefer Samsung's own tools? Tizen Studio with the Samsung Certificate Extension works too: make a Samsung **TV** certificate profile, then `tizen package -t wgt -s <profile> -- HallFlix-Samsung-unsigned.wgt` and `tizen install -n HallFlix-Samsung-unsigned.wgt -t <tv>`.

---

## Using it

| Remote | What it does |
|---|---|
| Arrows | Move around. Left/right on the top banner's buttons flips through the spotlight titles. |
| OK / Enter | Open or play |
| Back | Back a screen. On the home screen it jumps to the top first, then closes the app. |
| Play/Pause, ⏪ ⏩ | Work during playback. Left/right with the controls hidden skip back 10 s / ahead 30 s. |

- **Pre-rolls:** you'll see a PRE-ROLL tag and a **Skip pre-roll** button (on Android TV / Fire TV press → or ⏩).
- **Versions, audio and subtitles:** buttons on a title's page, and Audio / Subtitles in the player.
- **Settings** (your picture, top right): streaming quality, subtitles, switch user, change server.
- **Up next:** the next episode is offered at the end of an episode and starts by itself after 10 seconds.

## If something isn't right

- **"Couldn't reach a Jellyfin server"** – type the address with the port (`:8096`). If you use `hallflix.net`, make sure it opens in a browser from inside your home network.
- **"…doesn't have Artwork Studio 1.0.35 or newer"** – update the plugin and restart Jellyfin.
- **A video won't play** – Settings → Streaming quality → pick a lower value so the server converts it. LG and Samsung play most files directly; Android TV / Fire TV play nearly everything.
- **Server moved** – Settings → Change server.

## Your own signing key (Android)

The Android app is signed with a key kept in this repository so updates install over the top. To use a private key instead, add two repository secrets, `HALLFLIX_KEYSTORE_B64` (your `.jks` file, base64) and `HALLFLIX_KEYSTORE_PASSWORD`, then rerun **HallFlix TV apps**. Do it before installing on your TVs: switching keys later means uninstalling the app once.
