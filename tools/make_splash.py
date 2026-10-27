#!/usr/bin/env python3
"""Draws home/splash.png, what the TV shows while FreeTV starts (after turning the TV on, for example): the name and the
version from home/appinfo.json. Run it after changing the version; tests/run.js checks they match. Needs Pillow.

    python3 tools/make_splash.py"""
import json
import os

from PIL import Image, ImageDraw, ImageFilter, ImageFont, PngImagePlugin

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
W, H = 1920, 1080


def font(size, weight):
    f = ImageFont.truetype(os.path.join(ROOT, 'assets', 'fonts', 'InterVariable.ttf'), size)
    try:   # Inter's axes are optical size and weight
        f.set_variation_by_axes([min(32, size), weight] if len(f.get_variation_axes()) > 1 else [weight])
    except (OSError, AttributeError):
        pass
    return f


def main():
    version = json.load(open(os.path.join(ROOT, 'home', 'appinfo.json'), encoding='utf-8'))['version']
    im = Image.new('RGB', (W, H), (11, 13, 18))
    # a soft glow behind the logo, the same pink as the icon
    glow = Image.new('L', (W, H), 0)
    ImageDraw.Draw(glow).ellipse([W / 2 - 380, H / 2 - 330, W / 2 + 380, H / 2 + 170], fill=40)
    glow = glow.filter(ImageFilter.GaussianBlur(160))
    im.paste(Image.new('RGB', (W, H), (255, 122, 158)), (0, 0), glow)

    icon = Image.open(os.path.join(ROOT, 'home', 'largeIcon.png')).convert('RGBA').resize((168, 168), Image.LANCZOS)
    im.paste(icon, (W // 2 - 84, 318), icon)
    d = ImageDraw.Draw(im)
    name, ver = font(120, 650), font(42, 500)
    d.text((W / 2, 610), 'FreeTV', font=name, fill=(255, 255, 255), anchor='mm')
    d.text((W / 2, 712), 'v' + version, font=ver, fill=(150, 156, 168), anchor='mm')

    meta = PngImagePlugin.PngInfo()
    meta.add_text('version', version)
    out = os.path.join(ROOT, 'home', 'splash.png')
    im.save(out, pnginfo=meta, optimize=True)
    print('splash for v%s ->' % version, os.path.normpath(out))


if __name__ == '__main__':
    main()
