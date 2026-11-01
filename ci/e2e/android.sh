#!/usr/bin/env bash
# HallFlix for Android TV on an emulator, against the Jellyfin 12 server run.sh left running.
# Drives it with remote keys (adb keyevents) and saves screenshots to results/android/.
set -x
cd "$(dirname "$0")"
RES=results/android; mkdir -p "$RES"
TOKEN=$(cat work/token)
A="Authorization: MediaBrowser Client=\"HallFlix E2E\", Device=\"CI\", DeviceId=\"hallflix-e2e\", Version=\"1.0\", Token=\"$TOKEN\""
snap() { adb exec-out screencap -p > "$RES/$1.png"; }
key() { adb shell input keyevent "$1"; sleep "${2:-1}"; }
top() { adb shell dumpsys activity activities | grep -E "mResumedActivity|topResumedActivity|ResumedActivity" | head -3; }

adb install -r ../../out/HallFlix-AndroidTV.apk > "$RES/install.txt" 2>&1
adb logcat -c
adb shell am start -n net.hallflix.tv/.MainActivity
sleep 15; snap 01-launcher
adb shell input text "10.0.2.2:8096"; sleep 1
key 66 12; snap 02-login
# TV interface: "Enter user name" → name → password
key 23 4
adb shell input text admin; key 66 2
adb shell input text "HallFlix-e2e-1"; key 66 18
snap 03-home
key 22 2; key 21 2; snap 03b-home-dpad
# Play the spotlight title: pre-roll first, in the native player
key 23 9
snap 04-preroll
top > "$RES/activity-playing.txt"
curl -fsS "http://localhost:8096/Sessions" -H "$A" > "$RES/sessions-preroll.json" || true
sleep 12; snap 05-movie
curl -fsS "http://localhost:8096/Sessions" -H "$A" > "$RES/sessions-movie.json" || true
key 22 3; snap 05b-seek
key 4 2; key 4 5
snap 06-after-back
top > "$RES/activity-after.txt"
curl -fsS "http://localhost:8096/Sessions" -H "$A" > "$RES/sessions-after.json" || true
key 4 3; snap 07-exit
top > "$RES/activity-exit.txt"
adb logcat -d > "$RES/logcat-full.txt"
grep -iE "hallflix|chromium|ExoPlayer|MediaCodec|AndroidRuntime|FATAL" "$RES/logcat-full.txt" | tail -300 > "$RES/logcat.txt"
python3 - "$RES" <<'PY'
import json, sys, os
r = sys.argv[1]
out = {}
for n in ('sessions-preroll', 'sessions-movie', 'sessions-after'):
    try:
        s = json.load(open(os.path.join(r, n + '.json')))
        out[n] = [{'client': x.get('Client'), 'device': x.get('DeviceName'), 'playing': (x.get('NowPlayingItem') or {}).get('Name'), 'method': (x.get('PlayState') or {}).get('PlayMethod'), 'pos': (x.get('PlayState') or {}).get('PositionTicks')} for x in s if x.get('Client') == 'HallFlix TV']
    except Exception as e:
        out[n] = str(e)
for n in ('activity-playing', 'activity-after', 'activity-exit'):
    try: out[n] = open(os.path.join(r, n + '.txt')).read().strip()
    except Exception as e: out[n] = str(e)
out['crash'] = 'FATAL EXCEPTION' in open(os.path.join(r, 'logcat-full.txt'), errors='ignore').read()
json.dump(out, open(os.path.join(r, 'android-results.json'), 'w'), indent=2)
print(json.dumps(out, indent=2))
PY
rm -f "$RES/logcat-full.txt"
exit 0
