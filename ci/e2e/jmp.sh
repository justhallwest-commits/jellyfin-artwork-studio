#!/usr/bin/env bash
# Jellyfin Media Player (the desktop app) against the server run.sh left running.
set -x
cd "$(dirname "$0")"
RES=$PWD/results; mkdir -p "$RES"
TOKEN=$(cat work/token); URL=http://localhost:8096
H="Authorization: MediaBrowser Client=\"HallFlix E2E\", Device=\"CI\", DeviceId=\"hallflix-e2e\", Version=\"1.0\", Token=\"$TOKEN\""
AS=$(curl -fsS "$URL/Plugins" -H "$H" | python3 -c "import json,sys; print([p['Id'] for p in json.load(sys.stdin) if 'Artwork Studio' in p['Name']][0])")
curl -fsS "$URL/Plugins/$AS/Configuration" -H "$H" > work/as-config.json
python3 -c "
import json; c=json.load(open('work/as-config.json')); c['Theme']['LoginLayout']='split-left'; c['Theme']['LoginGlass']=True; json.dump(c, open('work/as-config-split.json','w'))"
curl -fsS -X POST "$URL/Plugins/$AS/Configuration" -H "$H" -H 'Content-Type: application/json' --data @work/as-config-split.json

UID_=$(curl -fsS "$URL/Users" -H "$H" | python3 -c "import json,sys; print(json.load(sys.stdin)[0]['Id'])")
curl -fsS "$URL/Users/$UID_" -H "$H" | python3 -c "import json,sys; p=json.load(sys.stdin)['Policy']; p['IsHidden']=False; json.dump(p, open('work/policy.json','w'))"
curl -fsS -X POST "$URL/Users/$UID_/Policy" -H "$H" -H 'Content-Type: application/json' --data @work/policy.json
curl -fsS "$URL/Users/Public" | head -c 300; echo
export QTWEBENGINE_CHROMIUM_FLAGS="--remote-debugging-port=9222"
xvfb-run -a -s "-screen 0 1920x1080x24" flatpak run com.github.iwalton3.jellyfin-media-player --remote-debugging-port=9222 > "$RES/jmp-app.log" 2>&1 &
APP=$!
JF_URL=$URL RES=$RES NODE_PATH=$PWD/oldchrome/node_modules timeout 240 node jmp.js
kill $APP 2>/dev/null; pkill -f jellyfinmediaplayer 2>/dev/null
curl -fsS -X POST "$URL/Plugins/$AS/Configuration" -H "$H" -H 'Content-Type: application/json' --data @work/as-config.json
tail -40 "$RES/jmp-app.log"
exit 0
