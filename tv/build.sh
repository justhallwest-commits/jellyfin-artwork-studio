#!/usr/bin/env bash
# Puts the LG and Samsung app folders together in tv/dist/ (CI packages them; see .github/workflows/tv-apps.yml).
set -euo pipefail
cd "$(dirname "$0")"
VERSION=${1:-1.0.0}
rm -rf dist && mkdir -p dist/webos dist/tizen
cp launcher/index.html webos/appinfo.json webos/*.png dist/webos/
cp launcher/index.html tizen/config.xml tizen/icon.png dist/tizen/
python3 - "$VERSION" <<'PY'
import json, re, sys
v = sys.argv[1]
p = 'dist/webos/appinfo.json'; a = json.load(open(p)); a['version'] = v; json.dump(a, open(p, 'w'), indent=2)
p = 'dist/tizen/config.xml'; s = open(p).read(); s = re.sub(r'(<widget[^>]*\sversion=")[^"]*"', r'\g<1>' + v + '"', s, count=1); open(p, 'w').write(s)
PY
echo "tv/dist ready for $VERSION"
