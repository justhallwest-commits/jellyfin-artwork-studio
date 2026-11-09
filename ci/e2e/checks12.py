"""API checks for the Jellyfin 12 options of Artwork Studio, Pre-Roll Videos, Bulk Metadata Editor and
Content Guard. Every check is independent; results go to results/checks12.json."""
import json, os, time, urllib.parse, urllib.request

URL, TOKEN, RES = os.environ['URL'], os.environ['TOKEN'], os.environ['RES']
R = {}


def call(method, path, body=None, token=TOKEN, query=None, raw=False):
    if query:
        path += ('&' if '?' in path else '?') + urllib.parse.urlencode(query)
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(URL + path, data=data, method=method)
    req.add_header('Authorization', f'MediaBrowser Client="HallFlix E2E", Device="CI", DeviceId="hallflix-e2e-{token[:6]}", Version="1.0", Token="{token}"')
    if data is not None:
        req.add_header('Content-Type', 'application/json')
    with urllib.request.urlopen(req, timeout=60) as r:
        txt = r.read().decode()
        return txt if raw else (json.loads(txt) if txt.strip() else None)


def check(name, fn):
    try:
        R[name] = {'ok': True, **(fn() or {})}
    except Exception as e:  # noqa: BLE001
        R[name] = {'ok': False, 'error': f'{type(e).__name__}: {e}'[:500]}
    print('[e2e]', name, 'ok' if R[name]['ok'] else 'FAILED', json.dumps(R[name])[:300])


me = call('GET', '/Users/Me')
uid = me['Id']
movies = call('GET', '/Items', query={'userId': uid, 'Recursive': 'true', 'IncludeItemTypes': 'Movie', 'Fields': 'MediaSourceCount,Genres,MediaSources'})['Items']
byname = {m['Name']: m for m in movies}
libs = {l['Name']: l for l in call('GET', '/Library/VirtualFolders')}


def versions():
    s = byname.get('Sintel', {})
    return {'movies': sorted(byname), 'sintelVersions': s.get('MediaSourceCount') or len(s.get('MediaSources') or [])}
check('versions-grouped', versions)


# ---- Artwork Studio
def menu_links():
    cfg = call('GET', '/web/config.json')
    links = cfg.get('menuLinks') or []
    assert any(l.get('url') == 'https://hallflix.net/requests' for l in links), links
    return {'menuLinks': links}
check('as-menu-links', menu_links)


def search_shortcut():
    hits = call('GET', '/Search/Hints', query={'searchTerm': 'missing banner', 'userId': uid, 'limit': 50})
    names = [h['Name'] for h in hits.get('SearchHints', [])]
    normal = [h['Name'] for h in call('GET', '/Search/Hints', query={'searchTerm': 'Tears', 'userId': uid}).get('SearchHints', [])]
    assert names, 'no results for "missing banner"'
    assert any('Tears' in n for n in normal), normal
    return {'missingBanner': names, 'normalSearch': normal}
check('as-search-shortcut', search_shortcut)


# ---- Pre-Roll Videos
PR = 'a4b2c3d4-e5f6-7890-abcd-ef1234567891'
target = byname.get('Tears of Steel') or movies[0]
clips = call('GET', '/Items', query={'userId': uid, 'Recursive': 'true', 'ParentId': libs['Prerolls']['ItemId'], 'IncludeItemTypes': 'Video,Movie'})['Items']


def pr_config(**kw):
    c = call('GET', f'/Plugins/{PR}/Configuration')
    c.update(kw)
    call('POST', f'/Plugins/{PR}/Configuration', c)


def pr_basic():
    pr_config(PrerollLibraryId=libs['Prerolls']['ItemId'], PlaylistId='', SkippablePrerolls=True, SkippableType='Intro', SimilarFallback=True, SameForAllVersions=True)
    p = call('GET', '/PrerollVideos/Preview', query={'itemId': target['Id']})
    return {'preview': {k: p.get(k) for k in ('Reason', 'Clips') if k in p} or p}
check('pr-preview', pr_basic)


def pr_version():
    s = byname.get('Sintel')
    if not s:
        return {'skipped': 'no Sintel'}
    out = {}
    for ms in (s.get('MediaSources') or []):
        p = call('GET', '/PrerollVideos/Preview', query={'itemId': ms['Id']})
        out[ms.get('Name') or ms['Id']] = p.get('Reason')
    return {'perVersion': out}
check('pr-versions', pr_version)


def pr_playlist():
    pl = call('POST', '/Playlists', {'Name': 'Pre-roll line-up', 'Ids': [c['Id'] for c in clips], 'UserId': uid})
    pr_config(PlaylistId=pl['Id'], PlaylistRotate=True)
    p = call('GET', '/PrerollVideos/Preview', query={'itemId': target['Id']})
    pr_config(PlaylistId='')
    assert 'playlist' in json.dumps(p).lower(), p
    return {'reason': p.get('Reason')}
check('pr-playlist', pr_playlist)


def pr_segments():
    # Pre-Roll Videos marks its clips itself when settings are saved (Jellyfin's scan skips home videos)
    pr_config(SkippablePrerolls=True, SkippableType='Intro')
    segs = None
    for _ in range(40):
        time.sleep(2)
        segs = call('GET', f"/MediaSegments/{clips[0]['Id']}")
        if segs and segs.get('Items'):
            break
    assert segs and segs.get('Items'), segs
    return {'segments': segs['Items']}
check('pr-skippable-segment', pr_segments)


# ---- Content Guard
CG = 'c4c95473-00dd-462d-9561-f825460e5048'


def cg():
    try:
        kid = call('POST', '/Users/New', {'Name': 'kid', 'Password': 'kid-pass-1'})
    except Exception:  # noqa: BLE001
        kid = next(u for u in call('GET', '/Users') if u['Name'] == 'kid')
    animation = [m['Name'] for m in movies if 'Animation' in (m.get('Genres') or [])]
    c = call('GET', f'/Plugins/{CG}/Configuration')
    c.update({'Enabled': True, 'ShareAcrossVersions': True, 'FilterRecommendations': True, 'HideEmptyCollections': True,
              'Profiles': [{'Id': '11111111-2222-3333-4444-555555555555', 'Name': 'Kids', 'Enabled': True, 'UserIds': [kid['Id']], 'BlockedGenres': ['Animation'],
                            'BlockedTags': [], 'BlockedRatings': [], 'AllowedTags': [], 'BlockUnrated': False, 'InheritFromParents': True, 'InheritFromLibrary': True}]})
    call('POST', f'/Plugins/{CG}/Configuration', c)
    try:
        call('POST', '/ContentGuard/Rebuild')
    except Exception:  # noqa: BLE001
        pass
    auth = call('POST', '/Users/AuthenticateByName', {'Username': 'kid', 'Pw': 'kid-pass-1'})
    kt = auth['AccessToken']
    seen = [m['Name'] for m in call('GET', '/Items', token=kt, query={'userId': kid['Id'], 'Recursive': 'true', 'IncludeItemTypes': 'Movie'})['Items']]
    recs = call('GET', '/Movies/Recommendations', token=kt, query={'userId': kid['Id'], 'categoryLimit': 5, 'itemLimit': 10})
    rec_names = [i['Name'] for r in recs for i in r.get('Items', [])]
    search = [h['Name'] for h in call('GET', '/Search/Hints', token=kt, query={'searchTerm': 'Sintel', 'userId': kid['Id']}).get('SearchHints', [])]
    leaked = [n for n in seen + rec_names + search if n in animation]
    assert not leaked, leaked
    return {'animation': animation, 'kidSees': seen, 'kidRecs': rec_names, 'kidSearchSintel': search}
check('cg-blocking', cg)

# ---- Artwork Studio: screensaver gallery (Fire TV / Android TV app and the web app's screensaver)
AS = '7143ab64-23ea-4969-b0b9-672c6893c4b3'


def png(w, h, rgb):
    import struct, zlib
    rows = b''.join(b'\x00' + bytes(rgb) * w for _ in range(h))
    def chunk(t, d): return struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    return b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 2, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(rows, 6)) + chunk(b'IEND', b'')


def as_client(client, path, query=None, raw=False):
    if query:
        path += ('&' if '?' in path else '?') + urllib.parse.urlencode(query, doseq=True)
    req = urllib.request.Request(URL + path)
    req.add_header('Authorization', f'MediaBrowser Client="{client}", Device="CI", DeviceId="ss-{client[:8]}", Version="1.0", Token="{TOKEN}"')
    with urllib.request.urlopen(req, timeout=60) as r:
        b = r.read()
        return (b, r.headers.get('Content-Type')) if raw else json.loads(b.decode())


def ss_upload(name, data):
    boundary = 'hallflix' + str(int(time.time() * 1000))
    body = (f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="{name}"\r\nContent-Type: image/png\r\n\r\n').encode() + data + f'\r\n--{boundary}--\r\n'.encode()
    req = urllib.request.Request(URL + '/ArtworkStudio/Backdrops/screensaver/Upload', data=body, method='POST')
    req.add_header('Authorization', f'MediaBrowser Client="HallFlix E2E", Device="CI", DeviceId="hallflix-e2e", Version="1.0", Token="{TOKEN}"')
    req.add_header('Content-Type', f'multipart/form-data; boundary={boundary}')
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read().decode())


def ss_config(**kw):
    c = call('GET', f'/Plugins/{AS}/Configuration')
    c.setdefault('Screensaver', {}).update(kw)
    call('POST', f'/Plugins/{AS}/Configuration', c)


ATV_Q = {'includeItemTypes': ['Movie', 'Series'], 'recursive': 'true', 'sortBy': 'Random', 'limit': 60, 'imageTypes': 'Backdrop'}
WEB_Q = {'ImageTypes': 'Backdrop', 'EnableImageTypes': 'Backdrop', 'IncludeItemTypes': 'Movie,Series,MusicArtist', 'SortBy': 'Random', 'Recursive': 'true',
         'Fields': 'Taglines', 'ImageTypeLimit': 10, 'StartIndex': 0, 'Limit': 200}
movie_ids = {m['Id'] for m in movies}
SS_PICS = {}


def ss_setup():
    before = as_client('Jellyfin for Android TV', '/Items', ATV_Q)['Items']
    for name, rgb in (('red.png', (200, 30, 40)), ('blue.png', (30, 60, 200))):
        r = ss_upload(name, png(640, 360, rgb))
        SS_PICS[r['Name']] = png(640, 360, rgb)
    files = [f['Name'] for f in call('GET', '/ArtworkStudio/Backdrops/screensaver')['Files']]
    assert set(SS_PICS) <= set(files), files
    return {'libraryBefore': [i.get('Name') for i in before], 'gallery': files}
check('as-screensaver-upload', ss_setup)


def ss_firetv():
    ss_config(Enabled=True, Mode='only', NativeApps=True, WebApps=True)
    items = as_client('Jellyfin for Android TV', '/Items', ATV_Q)['Items']
    assert len(items) == len(SS_PICS) and not any(i['Id'] in movie_ids for i in items), items
    got = []
    for it in items:
        tag = it['BackdropImageTags'][0]
        data, ctype = as_client('Jellyfin for Android TV', f"/Items/{it['Id']}/Images/Backdrop/0", {'tag': tag}, raw=True)
        assert data in SS_PICS.values(), (ctype, len(data))
        got.append({'id': it['Id'], 'type': ctype, 'bytes': len(data)})
    return {'slides': got}
check('as-screensaver-firetv', ss_firetv)


def ss_web():
    a = as_client('Jellyfin Web', f'/Users/{uid}/Items', WEB_Q)['Items']
    b = as_client('Jellyfin Web', '/Items', {**WEB_Q, 'userId': uid})['Items']
    assert len(a) == len(SS_PICS) and len(b) == len(SS_PICS), (a, b)
    data, ctype = as_client('Jellyfin Web', f"/Items/{a[0]['Id']}/Images/Backdrop/0", {'tag': a[0]['BackdropImageTags'][0], 'quality': 100}, raw=True)
    assert data in SS_PICS.values(), ctype
    return {'legacyRoute': len(a), 'itemsRoute': len(b), 'imageType': ctype}
check('as-screensaver-web', ss_web)


def ss_untouched():
    lib = call('GET', '/Library/VirtualFolders')
    movies_lib = next(l['ItemId'] for l in lib if l['Name'] == 'Movies')
    browse = as_client('Jellyfin for Android TV', '/Items', {**ATV_Q, 'parentId': movies_lib})['Items']
    spot = as_client('HallFlix TV', '/Items', {'userId': uid, 'IncludeItemTypes': 'Movie,Series', 'Recursive': 'true', 'Limit': 16, 'ImageTypes': 'Backdrop',
                                               'Fields': 'Overview', 'EnableImageTypes': 'Backdrop,Logo,Primary', 'SortBy': 'Random'})['Items']
    assert all(i['Id'] in movie_ids for i in browse + spot), (browse, spot)
    return {'browse': [i['Name'] for i in browse], 'spotlight': [i['Name'] for i in spot]}
check('as-screensaver-leaves-others', ss_untouched)


def ss_mix():
    ss_config(Mode='mix', MixPercent=50)
    items = as_client('Jellyfin for Android TV', '/Items', ATV_Q)['Items']
    mine = [i for i in items if i['Id'] not in movie_ids]
    theirs = [i for i in items if i['Id'] in movie_ids]
    assert mine, items
    ss_config(Mode='only')
    return {'slides': len(items), 'gallery': len(mine), 'library': [i['Name'] for i in theirs]}
check('as-screensaver-mix', ss_mix)


def ss_switches():
    ss_config(NativeApps=False)
    off = as_client('Jellyfin for Android TV', '/Items', ATV_Q)['Items']
    ss_config(NativeApps=True)
    assert all(i['Id'] in movie_ids for i in off), off
    cfg = call('GET', '/ArtworkStudio/AppConfig')['screensaver']
    assert cfg['enabled'] and len(cfg['files']) == len(SS_PICS), cfg
    ss_config(TvIdleMinutes=1, SlideSeconds=6)
    return {'fireTvOff': [i['Name'] for i in off], 'appConfig': cfg}
check('as-screensaver-switches', ss_switches)

json.dump(R, open(os.path.join(RES, 'checks12.json'), 'w'), indent=2)
