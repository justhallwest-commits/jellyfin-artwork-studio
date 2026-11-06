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
# Another theme in Branding -> Custom CSS that styles the sign-in page itself (like an ElegantFin-based
# theme): Artwork Studio's split layout has to win over it
curl -fsS "$URL/System/Configuration/branding" -H "$H" > work/branding.json
python3 - <<'PY'
import json
b = json.load(open('work/branding.json'))
b['CustomCss'] = '@import url("https://cdn.jsdelivr.net/gh/lscambo13/ElegantFin@main/Theme/ElegantFin-jellyfin-theme-build-latest-minified.css");\n' + (b.get('CustomCss') or '') + '''
/* stand-in for another login theme */
#loginPage{width:auto!important;max-width:none!important;margin:0 auto!important;padding:0!important;background:#182030!important;display:flex!important;justify-content:center!important;align-items:center!important}
#loginPage .padded-left.padded-right{max-width:15em!important;margin:0 auto!important;padding:2em 1.5em!important;background:#1e2636!important;border-radius:16px!important;text-align:center!important}
#loginPage h1{text-align:center!important;position:relative!important;margin-top:-3.2em!important}
'''
json.dump(b, open('work/branding-theme.json', 'w'))
PY
curl -fsS -X POST "$URL/System/Configuration/branding" -H "$H" -H 'Content-Type: application/json' --data @work/branding-theme.json
JF_URL=$URL RES=$RES node chrome-login.js || true
docker rm -f jmp >/dev/null 2>&1
docker run -d --name jmp --network host -v /tmp/jmp.deb:/jmp.deb:ro ubuntu:22.04 bash -c '
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -qq && apt-get install -y -qq /jmp.deb xvfb xauth imagemagick iproute2 procps > /tmp/apt.log 2>&1; echo "apt exit $?"; tail -3 /tmp/apt.log
  dpkg -s libqt5webenginecore5 | grep -i ^version
  export QTWEBENGINE_DISABLE_SANDBOX=1 QTWEBENGINE_REMOTE_DEBUGGING=0.0.0.0:9222 QTWEBENGINE_CHROMIUM_FLAGS="--remote-debugging-port=9222 --remote-debugging-address=0.0.0.0 --no-sandbox"
  Xvfb :99 -screen 0 1920x1080x24 & sleep 2
  DISPLAY=:99 jellyfinmediaplayer --remote-debugging-port=9222 2>&1 | tail -200'
JF_URL=$URL RES=$RES NODE_PATH=$PWD/oldchrome/node_modules timeout 300 node jmp.js
docker exec jmp bash -c 'DISPLAY=:99 import -window root /tmp/x.png; ps aux | grep -iE "jelly|webengine" | grep -v grep | cut -c1-200; ss -ltnp; tail -60 /root/.local/share/jellyfinmediaplayer/logs/*.log' > "$RES/jmp-debug.log" 2>&1
docker cp jmp:/tmp/x.png "$RES/jmp-screen.png" 2>/dev/null
docker logs jmp > "$RES/jmp-app.log" 2>&1; docker rm -f jmp >/dev/null 2>&1
curl -fsS -X POST "$URL/Plugins/$AS/Configuration" -H "$H" -H 'Content-Type: application/json' --data @work/as-config.json
curl -fsS -X POST "$URL/System/Configuration/branding" -H "$H" -H 'Content-Type: application/json' --data @work/branding.json
tail -40 "$RES/jmp-app.log"
exit 0
