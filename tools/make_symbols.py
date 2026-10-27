#!/usr/bin/env python3
"""Draws FreeTV's own few symbols (white on transparent, like the Material Symbols PNGs next to them) into assets/symbols/.

    python3 tools/make_symbols.py

Simple outlines with round ends, drawn at 4x and shrunk, so they have the same weight as the others. Needs Pillow."""
import math
import os

from PIL import Image, ImageDraw

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets', 'symbols')
S, K = 144, 4          # size, supersampling
W = 12                 # stroke


def canvas():
    """A mask: 255 is symbol, 0 is cut out. Drawn at K times the size."""
    im = Image.new('L', (S * K, S * K), 0)
    return im, ImageDraw.Draw(im)


def done(im, name):
    mask = im.resize((S, S), Image.LANCZOS)
    out = Image.new('RGBA', (S, S), (255, 255, 255, 0))
    out.putalpha(mask)
    out.save(os.path.join(OUT, name + '.png'), optimize=True)


def line(d, pts, w=W, fill=255):
    d.line([(x * K, y * K) for x, y in pts], fill=fill, width=int(w * K), joint='curve')
    for x, y in (pts[0], pts[-1]):
        d.ellipse([(x - w / 2) * K, (y - w / 2) * K, (x + w / 2) * K, (y + w / 2) * K], fill=fill)


def ring(d, cx, cy, r, w=W, fill=255):
    d.ellipse([(cx - r) * K, (cy - r) * K, (cx + r) * K, (cy + r) * K], outline=fill, width=int(w * K))


def disc(d, cx, cy, r, fill=255):
    d.ellipse([(cx - r) * K, (cy - r) * K, (cx + r) * K, (cy + r) * K], fill=fill)


def search():
    im, d = canvas()
    ring(d, 60, 60, 40, 16)
    line(d, [(90, 90), (124, 124)], 18)
    done(im, 'search')


def kids():
    im, d = canvas()
    disc(d, 72, 72, 62)
    disc(d, 51, 58, 8, 0)
    disc(d, 93, 58, 8, 0)
    pts = [(72 + 31 * math.cos(math.radians(a)), 72 + 30 * math.sin(math.radians(a))) for a in range(28, 153, 5)]
    line(d, pts, 11, 0)
    done(im, 'kids')


def health():
    im, d = canvas()
    heart = []
    for i in range(0, 361, 4):
        t = math.radians(i)
        x = 16 * math.sin(t) ** 3
        y = 13 * math.cos(t) - 5 * math.cos(2 * t) - 2 * math.cos(3 * t) - math.cos(4 * t)
        heart.append((72 + x * 3.9, 64 - y * 3.9))
    d.polygon([(x * K, y * K) for x, y in heart], fill=255)
    line(d, [(34, 70), (58, 70), (68, 48), (80, 92), (90, 70), (110, 70)], 9, 0)
    done(im, 'health')


def calm():
    im, d = canvas()
    for y in (44, 74, 104):
        pts = [(18 + i * 4.1, y + 9 * math.sin(i / 3.2 + y)) for i in range(0, 26)]
        line(d, pts, 13)
    done(im, 'calm')


def lock():
    im, d = canvas()
    d.rounded_rectangle([26 * K, 62 * K, 118 * K, 130 * K], radius=16 * K, fill=255)
    pts = [(46 + 26 * (1 + math.cos(math.radians(a))), 66 - 34 * math.sin(math.radians(a))) for a in range(0, 181, 6)]
    line(d, pts, 14)
    disc(d, 72, 90, 9, 0)
    line(d, [(72, 92), (72, 108)], 10, 0)
    done(im, 'lock')


def timer():
    im, d = canvas()
    disc(d, 72, 82, 54)
    line(d, [(72, 82), (72, 54)], 11, 0)
    line(d, [(72, 82), (92, 94)], 11, 0)
    d.rounded_rectangle([52 * K, 10 * K, 92 * K, 22 * K], radius=6 * K, fill=255)
    line(d, [(72, 20), (72, 30)], 10)
    done(im, 'timer')


if __name__ == '__main__':
    for fn in (search, kids, health, calm, lock, timer):
        fn()
    print('symbols written to', os.path.normpath(OUT))
