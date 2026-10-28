#!/usr/bin/env python3
"""Draws the shelf icons FreeTV makes itself (Live TV and the Store) into assets/tiles/: full squares with their own
background, like the icons LG gives for its apps, so they fill the tile the same way.

    python3 tools/make_tiles.py

Drawn at 4x and shrunk. Needs Pillow."""
import os

from PIL import Image, ImageDraw

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets', 'tiles')
S, K = 320, 4


def gradient(top, bottom):
    """A diagonal gradient, light at the top left."""
    n = S * K
    im = Image.new('RGB', (n, n))
    d = ImageDraw.Draw(im)
    for i in range(2 * n):
        t = i / (2 * n - 1)
        c = tuple(int(top[j] + (bottom[j] - top[j]) * t) for j in range(3))
        d.line([(i, 0), (0, i)], fill=c, width=2)
    return im


def save(im, name):
    os.makedirs(OUT, exist_ok=True)
    im.resize((S, S), Image.LANCZOS).save(os.path.join(OUT, name + '.png'), optimize=True)


def k(*v):
    return [x * K for x in v]


def live_tv():
    im = gradient((64, 156, 255), (10, 52, 160))
    d = ImageDraw.Draw(im)
    w = 15
    # antenna
    d.line(k(124, 58, 160, 92), fill='white', width=w * K)
    d.line(k(196, 58, 160, 92), fill='white', width=w * K)
    for x, y in ((124, 58), (196, 58)):
        d.ellipse(k(x - w / 2, y - w / 2, x + w / 2, y + w / 2), fill='white')
    # the screen, and its stand
    d.rounded_rectangle(k(58, 92, 262, 232), radius=30 * K, outline='white', width=w * K)
    d.rounded_rectangle(k(118, 252, 202, 266), radius=7 * K, fill='white')
    # on air: a red dot with its waves
    cx, cy = 160, 162
    d.ellipse(k(cx - 19, cy - 19, cx + 19, cy + 19), fill=(255, 59, 48))
    for r in (38, 56):
        d.arc(k(cx - r, cy - r, cx + r, cy + r), start=-40, end=40, fill='white', width=10 * K)
        d.arc(k(cx - r, cy - r, cx + r, cy + r), start=140, end=220, fill='white', width=10 * K)
    save(im, 'livetv')


def store():
    im = gradient((255, 154, 120), (168, 92, 255))
    d = ImageDraw.Draw(im)
    # the bag's handle, then the bag
    d.arc(k(118, 50, 202, 140), start=180, end=360, fill='white', width=16 * K)
    d.line(k(118, 95, 118, 112), fill='white', width=16 * K)
    d.line(k(202, 95, 202, 112), fill='white', width=16 * K)
    d.rounded_rectangle(k(66, 104, 254, 270), radius=32 * K, fill='white')
    # a download arrow cut out of it
    c = (210, 110, 200)
    d.line(k(160, 140, 160, 216), fill=c, width=18 * K)
    d.polygon(k(126, 194, 194, 194, 160, 234), fill=c)
    d.ellipse(k(151, 131, 169, 149), fill=c)
    save(im, 'store')


if __name__ == '__main__':
    live_tv()
    store()
    print('tiles written to', os.path.normpath(OUT))
