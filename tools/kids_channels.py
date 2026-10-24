#!/usr/bin/env python3
"""The "Custom" tab's YouTube shortcuts (children's channels for YouTube AdFree) and their cover pictures.

    python3 tools/kids_channels.py [--config config.properties] [--strict]

Run by install.sh on the computer (it needs the internet; the TV never reads YouTube pages). For each shortcut it opens the
channel (or video) page on YouTube, takes the cover picture YouTube itself publishes for it (og:image) into work/channels/, and
checks the things a shortcut for a child must be: a video shortcut has to belong to the channel it says (otherwise it is left
out), and a @handle is turned into the channel's real id. build_home.py then puts the pictures and the list into the app.
The pictures are other people's logos: they stay on your computer (work/ and out/ are not in git).

Add your own in config.properties:  kids_channels=Cocomelon|@Cocomelon;Name|UCxxxxxxxxxxxxxxxxxxxxxx;Name|video:VIDEOID
"""
import json
import os
import re
import sys
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WORK = os.path.join(ROOT, 'work', 'channels')
BASE = os.environ.get('FREETV_YT_BASE', 'https://www.youtube.com')

DISNEY_JR = 'UCNcdbMyA59zE-Vk668bKWOg'   # the "Disney Jr." channel
# English-language channels only. Sofia the First and Minnie's Bow-Toons are shows on the Disney Jr. channel, not channels of their
# own, so they are shortcuts to a full-length video of the show; it is used only if the page confirms the video is Disney Jr.'s.
DEFAULTS = [
    {'key': 'bluey', 'title': 'Bluey', 'kind': 'channel', 'id': 'UCVzLLZkDuFGAE2BGdBuBNBg'},
    {'key': 'sofia', 'title': 'Sofia the First', 'kind': 'video', 'id': 'jzRE0HXm9NY', 'owner': DISNEY_JR},
    {'key': 'minnie', 'title': "Minnie's Bow-Toons", 'kind': 'video', 'id': '96k9TYXDMrA', 'owner': DISNEY_JR},
    {'key': 'msrachel', 'title': 'Ms Rachel', 'kind': 'channel', 'id': 'UCG2CL6EUjG8TVT1Tpl9nJdg'},
]
CHANNEL_ID = re.compile(r'^UC[A-Za-z0-9_-]{22}$')
VIDEO_ID = re.compile(r'^[A-Za-z0-9_-]{11}$')
HANDLE = re.compile(r'^@[A-Za-z0-9._-]{3,60}$')


def slug(text):
    return re.sub(r'[^a-z0-9]+', '-', text.lower()).strip('-')[:40] or 'channel'


def parse_extra(value):
    """'Name|@handle;Name|UC...;Name|video:ID' -> entries; anything that is not one of those three forms is refused."""
    out = []
    for part in [p.strip() for p in (value or '').split(';') if p.strip()]:
        if '|' not in part:
            sys.exit('config.properties: kids_channels needs Name|@handle, Name|UC… or Name|video:ID (got "%s")' % part)
        title, ref = [x.strip() for x in part.split('|', 1)]
        title = re.sub(r'[<>"\\]', '', title)[:40]
        entry = {'key': slug(title), 'title': title}
        if CHANNEL_ID.match(ref):
            entry.update(kind='channel', id=ref)
        elif ref.startswith('video:') and VIDEO_ID.match(ref[6:]):
            entry.update(kind='video', id=ref[6:])
        elif HANDLE.match(ref):
            entry.update(kind='channel', handle=ref)
        else:
            sys.exit('config.properties: "%s" is not a @handle, a channel id (UC…) or video:ID' % ref)
        out.append(entry)
    return out


def all_entries(extra_value):
    entries, keys = [dict(d) for d in DEFAULTS], set(d['key'] for d in DEFAULTS)
    for e in parse_extra(extra_value):
        if e['key'] not in keys:
            keys.add(e['key'])
            entries.append(e)
    return entries


def status_path(key):
    return os.path.join(WORK, key + '.json')


def read_status(key):
    try:
        with open(status_path(key), encoding='utf-8') as f:
            return json.load(f)
    except (OSError, ValueError):
        return None


def for_build(extra_value):
    """The list the app gets (CONFIG.channels). A shortcut that was checked and failed is left out; a video shortcut that has not
    been checked is left out too (it is only trusted once its channel is confirmed); a channel keeps working without its picture."""
    out = []
    for e in all_entries(extra_value):
        s = read_status(e['key'])
        item = {'key': e['key'], 'title': e['title'], 'kind': e['kind'], 'id': e.get('id', '')}
        if s is not None:
            if not s.get('ok'):
                continue
            item['id'] = s.get('id') or item['id']
            if VIDEO_ID.match(s.get('latest') or ''):
                item['latest'] = s['latest']
            if s.get('thumb') and os.path.exists(os.path.join(WORK, s['thumb'])):
                item['thumb'] = 'channels/' + s['thumb']
        elif e['kind'] == 'video' or not item['id']:
            continue
        out.append(item)
    return out


def get(url, binary=False, timeout=30):
    request = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) FreeTV', 'Accept-Language': 'en-US,en;q=0.9',
                                                   'Cookie': 'CONSENT=YES+1; SOCS=CAI'})
    with urllib.request.urlopen(request, timeout=timeout) as r:
        data = r.read(3 * 1024 * 1024)
        return (data, r.headers.get('Content-Type', '')) if binary else data.decode('utf-8', 'replace')


def meta(html, prop):
    m = re.search(r'<meta[^>]+property="%s"[^>]+content="([^"]*)"' % re.escape(prop), html) or \
        re.search(r'<meta[^>]+content="([^"]*)"[^>]+property="%s"' % re.escape(prop), html)
    return m.group(1).replace('&amp;', '&') if m else ''


def page_channel_id(html):
    m = re.search(r'<link rel="canonical" href="https?://www\.youtube\.com/channel/(UC[A-Za-z0-9_-]{22})"', html) or \
        re.search(r'"(?:externalId|channelId)":"(UC[A-Za-z0-9_-]{22})"', html) or \
        re.search(r'itemprop="(?:channelId|identifier)" content="(UC[A-Za-z0-9_-]{22})"', html)
    return m.group(1) if m else ''


def latest_video(channel_id):
    """The channel's newest video that plays now (its public RSS feed), or ''. A live stream (marked 🔴) or a premiere that has not
    started (0 views) does not open in YouTube's TV screen, so those are skipped."""
    try:
        feed = get('%s/feeds/videos.xml?channel_id=%s' % (BASE, channel_id))
    except Exception:
        return ''
    for entry in re.findall(r'<entry>(.*?)</entry>', feed, re.S):
        vid = re.search(r'<yt:videoId>([A-Za-z0-9_-]{11})</yt:videoId>', entry)
        views = re.search(r'<media:statistics views="(\d+)"', entry)
        title = re.search(r'<title>(.*?)</title>', entry, re.S)
        if vid and views and int(views.group(1)) > 0 and '🔴' not in (title.group(1) if title else ''):
            return vid.group(1)
    return ''


def check(entry):
    """Looks the shortcut up on YouTube; returns the status that is saved ({'ok': bool, ...})."""
    if entry['kind'] == 'video':
        page = '%s/watch?v=%s' % (BASE, entry['id'])
    elif entry.get('id'):
        page = '%s/channel/%s' % (BASE, entry['id'])
    else:
        page = '%s/%s' % (BASE, entry['handle'])
    html = get(page)
    owner = page_channel_id(html)
    status = {'ok': True, 'title': meta(html, 'og:title'), 'owner': owner, 'id': entry.get('id', '')}
    if entry['kind'] == 'channel':
        if entry.get('id') and owner and owner != entry['id']:
            return {'ok': False, 'why': 'the page belongs to another channel (%s)' % owner}
        status['id'] = owner or entry.get('id', '')
        if not CHANNEL_ID.match(status['id']):
            return {'ok': False, 'why': 'could not read the channel id'}
        status['latest'] = latest_video(status['id'])
    elif entry.get('owner') and owner != entry['owner']:
        return {'ok': False, 'why': 'the video is not on the expected channel (%s, expected %s)' % (owner or 'unknown', entry['owner'])}
    image = meta(html, 'og:image')
    if entry['kind'] == 'video' and not image:
        image = 'https://i.ytimg.com/vi/%s/hqdefault.jpg' % entry['id']
    elif entry['kind'] == 'channel' and image:
        image = re.sub(r'=s\d+[^/]*$', '=s512-c-k-c0x00ffffff-no-rj', image)
    if image.startswith('https://') or (BASE != 'https://www.youtube.com' and image.startswith('http://')):
        try:
            data, kind = get(image, binary=True)
            ext = {'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp'}.get(kind.split(';')[0].strip().lower())
            if ext and 1000 < len(data) < 2 * 1024 * 1024:
                with open(os.path.join(WORK, '%s.%s' % (entry['key'], ext)), 'wb') as f:
                    f.write(data)
                status['thumb'] = '%s.%s' % (entry['key'], ext)
        except Exception as e:   # no picture: the shortcut still works, with its name
            status['thumbError'] = str(e)
    return status


def read_extra(config_path):
    try:
        with open(config_path, encoding='utf-8') as f:
            for line in f:
                if line.strip().startswith('kids_channels='):
                    return line.split('=', 1)[1].strip().strip('"')
    except OSError:
        pass
    return ''


def main(argv):
    config = os.path.join(ROOT, 'config.properties')
    if '--config' in argv:
        config = argv[argv.index('--config') + 1]
    os.makedirs(WORK, exist_ok=True)
    failed = 0
    for e in all_entries(read_extra(config)):
        try:
            s = check(e)
        except Exception as err:
            failed += 1
            print('  %-20s not checked (%s): %s' % (e['title'], type(err).__name__, err))
            continue   # no network: nothing is saved, the last good result (if any) stays
        with open(status_path(e['key']), 'w', encoding='utf-8') as f:
            json.dump(s, f)
        if s.get('ok'):
            print('  %-20s ok  %s%s' % (e['title'], s.get('title', ''), '' if s.get('thumb') else '  (no picture)'))
        else:
            failed += 1
            print('  %-20s LEFT OUT: %s' % (e['title'], s.get('why')))
    return 1 if failed and '--strict' in argv else 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
