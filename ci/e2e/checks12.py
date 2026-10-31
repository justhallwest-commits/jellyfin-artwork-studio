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
    tasks = call('GET', '/ScheduledTasks')
    t = next((t for t in tasks if 'segment' in (t.get('Key', '') + t.get('Name', '')).lower()), None)
    assert t, [x.get('Name') for x in tasks]
    call('POST', f"/ScheduledTasks/Running/{t['Id']}")
    segs = None
    for _ in range(30):
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

json.dump(R, open(os.path.join(RES, 'checks12.json'), 'w'), indent=2)
