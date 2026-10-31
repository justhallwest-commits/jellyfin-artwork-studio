#!/bin/sh
# Installs or updates the HallFlix plugins (Artwork Studio, Pre-Roll Videos, Bulk Metadata Editor,
# Content Guard)
# for Jellyfin 12 into /config/plugins. Run by the "hallflix-plugins" helper in docker-compose.yml
# before Jellyfin starts; safe to run on every start (it only downloads what's new).
set -u

CATALOG="${HALLFLIX_CATALOG:-https://raw.githubusercontent.com/justhallwest-commits/jellyfin-artwork-studio/main/catalog/manifest.json}"
MAJOR="${JELLYFIN_MAJOR:-12}"
PLUGINS=/config/plugins
TMP=$(mktemp -d)

apk add --no-cache jq unzip >/dev/null 2>&1 || { echo "Couldn't install helper tools (no internet?) - keeping the plugins already installed."; exit 0; }
mkdir -p "$PLUGINS"

if ! wget -qO "$TMP/catalog.json" "$CATALOG"; then
  echo "Couldn't reach the HallFlix plugin catalog - keeping the plugins already installed."
  exit 0
fi

jq -c '.[]' "$TMP/catalog.json" | while read -r plugin; do
  name=$(echo "$plugin" | jq -r '.name')
  best=$(echo "$plugin" | jq -c --arg m "$MAJOR." '[.versions[] | select(.targetAbi | startswith($m))] | sort_by(.version | split(".") | map(tonumber)) | last // empty')
  if [ -z "$best" ]; then echo "$name: no build for Jellyfin $MAJOR yet - skipped"; continue; fi

  version=$(echo "$best" | jq -r '.version')
  url=$(echo "$best" | jq -r '.sourceUrl')
  sum=$(echo "$best" | jq -r '.checksum // empty')
  dest="$PLUGINS/${name}_${version}"

  if [ -d "$dest" ]; then echo "$name $version: already installed"; continue; fi

  if ! wget -qO "$TMP/plugin.zip" "$url"; then echo "$name $version: download failed - skipped"; continue; fi
  if [ -n "$sum" ] && [ "$(md5sum "$TMP/plugin.zip" | cut -d' ' -f1)" != "$sum" ]; then
    echo "$name $version: checksum mismatch - skipped"; continue
  fi

  rm -rf "$TMP/unpack" && mkdir -p "$TMP/unpack"
  unzip -oq "$TMP/plugin.zip" -d "$TMP/unpack"
  # Remove older copies of this plugin, then put the new one in place
  for old in "$PLUGINS/${name}_"*; do [ -d "$old" ] && rm -rf "$old"; done
  mv "$TMP/unpack" "$dest"
  echo "$name $version: installed"
done

# Match the owner Jellyfin runs as (only matters if PUID/PGID are set)
if [ -n "${PUID:-}" ]; then chown -R "$PUID:${PGID:-$PUID}" "$PLUGINS" 2>/dev/null || true; fi
rm -rf "$TMP"
echo "HallFlix plugins are ready."
