#!/usr/bin/env bash
# End-to-end test: a real Jellyfin 12 server in Docker with Artwork Studio, Pre-Roll Videos and
# Bulk Metadata Editor installed, a few sample movies, then a browser run (e2e.js).
# Expects the plugin DLLs in ./plugins/<Name>/ and writes everything it finds to ./results/.
set -euo pipefail
cd "$(dirname "$0")"
ROOT=$PWD
RES=$ROOT/results
mkdir -p "$RES" work/config/plugins work/media/movies work/media/prerolls work/cache
log() { echo "[e2e] $*" | tee -a "$RES/run.log"; }

# ---- image (first tag that exists)
IMAGE=""
for T in ${JELLYFIN_TAGS:-12.4 12.4.0 12 latest}; do
  if docker pull -q "jellyfin/jellyfin:$T" >/dev/null 2>&1; then IMAGE="jellyfin/jellyfin:$T"; break; fi
done
[ -n "$IMAGE" ] || { log "no Jellyfin image found"; exit 1; }
log "image $IMAGE"

# ---- plugins: one folder each, like Jellyfin's own plugins directory
for d in plugins/*/; do
  name=$(basename "$d")
  cp -r "$d" "work/config/plugins/${name}_1.0.0.0"
  log "plugin $name: $(ls "$d" | tr '\n' ' ')"
done

# ---- sample media (made with the image's own ffmpeg; real titles so metadata and artwork download)
FF="docker run --rm --user $(id -u):$(id -g) --entrypoint /usr/lib/jellyfin-ffmpeg/ffmpeg -v $ROOT/work/media:/media $IMAGE -hide_banner -loglevel error -y"
mk() { mkdir -p "work/media/$1"; $FF -f lavfi -i "testsrc2=size=1280x720:rate=24" -f lavfi -i "sine=frequency=$3" -t "$2" -c:v libx264 -pix_fmt yuv420p -c:a aac -shortest "/media/$1/$(basename "$1").mp4"; }
mk "movies/Big Buck Bunny (2008)" 40 440
mk "movies/Sintel (2010)" 40 550
mk "movies/Tears of Steel (2012)" 40 660
mk "prerolls/HallFlix Intro" 4 880
log "media ready"

# ---- start
docker run -d --name jf -p 8096:8096 \
  -v "$ROOT/work/config:/config" -v "$ROOT/work/cache:/cache" -v "$ROOT/work/media:/media:ro" \
  "$IMAGE" >/dev/null
URL=http://localhost:8096
for i in $(seq 1 120); do
  if curl -fsS "$URL/health" 2>/dev/null | grep -q Healthy; then break; fi
  sleep 2
done
curl -fsS "$URL/System/Info/Public" | tee "$RES/system-info.json"; echo

H='Authorization: MediaBrowser Client="HallFlix E2E", Device="CI", DeviceId="hallflix-e2e", Version="1.0"'
J='Content-Type: application/json'
post() { local body="${2:-}"; [ -n "$body" ] || body="{}"; curl -fsS -X POST "$URL$1" -H "$H" -H "$J" -d "$body"; }

# ---- startup wizard
post /Startup/Configuration '{"UICulture":"en-US","MetadataCountryCode":"US","PreferredMetadataLanguage":"en"}' >/dev/null
curl -fsS "$URL/Startup/User" -H "$H" >/dev/null
post /Startup/User '{"Name":"admin","Password":"HallFlix-e2e-1"}' >/dev/null
post /Startup/RemoteAccess '{"EnableRemoteAccess":true}' >/dev/null || true
post /Startup/Complete >/dev/null
TOKEN=$(post /Users/AuthenticateByName '{"Username":"admin","Pw":"HallFlix-e2e-1"}' | python3 -c 'import json,sys; print(json.load(sys.stdin)["AccessToken"])')
A="Authorization: MediaBrowser Client=\"HallFlix E2E\", Device=\"CI\", DeviceId=\"hallflix-e2e\", Version=\"1.0\", Token=\"$TOKEN\""
apost() { local body="${2:-}"; [ -n "$body" ] || body="{}"; curl -fsS -X POST "$URL$1" -H "$A" -H "$J" -d "$body"; }
aget() { curl -fsS "$URL$1" -H "$A"; }
log "wizard done"

# ---- libraries
apost "/Library/VirtualFolders?name=Movies&collectionType=movies&refreshLibrary=false" '{"LibraryOptions":{"PathInfos":[{"Path":"/media/movies"}]}}' >/dev/null
apost "/Library/VirtualFolders?name=Prerolls&collectionType=homevideos&refreshLibrary=false" '{"LibraryOptions":{"PathInfos":[{"Path":"/media/prerolls"}]}}' >/dev/null
apost /Library/Refresh >/dev/null
for i in $(seq 1 90); do
  N=$(aget "/Items?Recursive=true&IncludeItemTypes=Movie" | python3 -c 'import json,sys; print(json.load(sys.stdin)["TotalRecordCount"])')
  [ "$N" -ge 3 ] && break; sleep 2
done
sleep 20   # let images download
log "movies in library: $N"

# ---- plugin status as Jellyfin sees it
aget /Plugins | tee "$RES/plugins.json" | python3 -c 'import json,sys; [print("[e2e] plugin", p["Name"], p["Version"], p["Status"]) for p in json.load(sys.stdin)]' | tee -a "$RES/run.log"
curl -fsS "$URL/web/index.html" | grep -o 'data-artwork-studio[^>]*' > "$RES/index-injection.txt" || echo "NOT INJECTED" > "$RES/index-injection.txt"
log "index.html: $(cat "$RES/index-injection.txt")"

# ---- Artwork Studio: a login backdrop + a design, so there's something to look at
python3 - <<'PY'
import struct, zlib
w, h = 960, 540
rows = b''.join(b'\x00' + bytes(v for x in range(w) for v in (x * 255 // w, 50, y * 255 // h)) for y in range(h))
def chunk(t, d): return struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
png = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 2, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(rows, 6)) + chunk(b'IEND', b'')
open('work/login.png', 'wb').write(png)
PY
curl -fsS -X POST "$URL/ArtworkStudio/Backdrops/login/Upload" -H "$A" -F "file=@work/login.png;type=image/png" > "$RES/upload-login.json" || echo '{"error":true}' > "$RES/upload-login.json"
log "login backdrop upload: $(cat "$RES/upload-login.json")"
AS=7143ab64-23ea-4969-b0b9-672c6893c4b3
aget "/Plugins/$AS/Configuration" > work/as-config.json
python3 - <<'PY'
import json
c = json.load(open('work/as-config.json'))
t = c.setdefault('Theme', {})
t.update({'Enabled': True, 'Preset': 'jellyskin', 'AccentColor': '#e50914', 'LoginLayout': 'split', 'LoginMessage': 'Welcome to HallFlix', 'SiteName': 'HallFlix', 'HeaderStyle': 'glass', 'HeaderUserSize': 2.2})
x = c.setdefault('Extras', {})
x.update({'Spotlight': True, 'SpotlightTrailers': False, 'Badges': True, 'SurpriseMe': True, 'QuickSearch': True})
json.dump(c, open('work/as-config.json', 'w'))
PY
curl -fsS -X POST "$URL/Plugins/$AS/Configuration" -H "$A" -H "$J" --data @work/as-config.json >/dev/null && log "Artwork Studio configured"

# ---- browser run
echo "$TOKEN" > work/token
JF_URL=$URL JF_USER=admin JF_PASS=HallFlix-e2e-1 JF_TOKEN=$TOKEN RES=$RES node e2e.js 2>&1 | tee -a "$RES/run.log" || true

# ---- what the server did with Artwork Studio's branding sync
aget /Branding/Configuration > "$RES/branding.json" || true
curl -s -o /dev/null -w '%{http_code}' "$URL/Branding/Splashscreen" > "$RES/splashscreen-status.txt" || true
docker logs jf > "$RES/jellyfin.log" 2>&1 || true
grep -iE "artwork|preroll|pre-roll|bulkmetadata|bulk metadata|plugin" "$RES/jellyfin.log" | grep -iE "error|warn|fail|loaded|exception" | head -80 > "$RES/plugin-log-lines.txt" || true
log "done"
