"""Draws the HallFlix TV app icons (run: python3 tv/art/make-icons.py). Needs Pillow."""
import os
from PIL import Image, ImageDraw, ImageFont, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
TV = os.path.dirname(HERE)
BG, RED, RED2 = (11, 11, 15), (229, 9, 20), (150, 4, 12)
BOLD = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'


def font(size):
    return ImageFont.truetype(BOLD, size)


def backdrop(w, h):
    im = Image.new('RGB', (w, h), BG)
    glow = Image.new('RGB', (w, h), BG)
    d = ImageDraw.Draw(glow)
    d.ellipse((-w * 0.2, h * 0.35, w * 0.9, h * 1.6), fill=(70, 4, 10))
    return Image.blend(im, glow.filter(ImageFilter.GaussianBlur(max(w, h) / 8)), 0.9)


def mark(size):
    """The 'H' with a play notch, on a transparent square."""
    s = size * 4
    im = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    bar, gap = s * 0.2, s * 0.14
    x0 = (s - (2 * bar + gap + bar * 0.0)) / 2 - bar * 0.25
    top, bot = s * 0.16, s * 0.84
    d.rectangle((x0, top, x0 + bar, bot), fill=RED)
    x1 = x0 + bar + gap + bar * 0.5
    d.rectangle((x1, top, x1 + bar, bot), fill=RED)
    # the crossbar is a play triangle
    cy = s / 2
    d.polygon([(x0 + bar - 2, cy - bar * 0.95), (x0 + bar - 2, cy + bar * 0.95), (x1 + bar * 0.15, cy)], fill=RED)
    return im.resize((size, size), Image.LANCZOS)


def icon(size, pad=0.12, radius=0.22):
    im = backdrop(size, size).convert('RGBA')
    m = mark(int(size * (1 - 2 * pad)))
    im.alpha_composite(m, (int(size * pad), int(size * pad)))
    mask = Image.new('L', (size * 4, size * 4), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, size * 4 - 1, size * 4 - 1), radius=int(size * 4 * radius), fill=255)
    out = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    out.paste(im, (0, 0), mask.resize((size, size), Image.LANCZOS))
    return out


def wordmark(w, h, text='HALLFLIX', sub=None):
    im = backdrop(w, h).convert('RGBA')
    d = ImageDraw.Draw(im)
    m = mark(int(h * 0.5))
    fs = int(h * 0.3)
    f = font(fs)
    tw = d.textlength(text, font=f)
    while m.width + h * 0.06 + tw > w * 0.84:
        fs = int(fs * 0.94); f = font(fs); tw = d.textlength(text, font=f)
        m = mark(int(fs * 1.7))
    total = m.width + h * 0.06 + tw
    x = (w - total) / 2
    im.alpha_composite(m, (int(x), int((h - m.height) / 2 - (h * 0.05 if sub else 0))))
    d.text((x + m.width + h * 0.06, h / 2 - (h * 0.05 if sub else 0)), text, font=f, fill=(255, 255, 255), anchor='lm')
    if sub:
        d.text((w / 2, h * 0.8), sub, font=font(int(h * 0.075)), fill=(170, 170, 180), anchor='mm')
    return im


def save(im, *path):
    p = os.path.join(TV, *path)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    im.save(p)
    print('wrote', os.path.relpath(p, TV), im.size)


if __name__ == '__main__':
    save(icon(80, radius=0.0), 'webos', 'icon.png')
    save(icon(130, radius=0.0), 'webos', 'largeIcon.png')
    save(wordmark(1920, 1080, sub='Connecting…').convert('RGB'), 'webos', 'splash.png')
    t = Image.new('RGBA', (512, 423), (0, 0, 0, 0)); t.alpha_composite(icon(423, radius=0.0), (44, 0))
    save(t, 'tizen', 'icon.png')
    res = os.path.join('android', 'app', 'src', 'main', 'res')
    for name, px in (('mdpi', 48), ('hdpi', 72), ('xhdpi', 96), ('xxhdpi', 144), ('xxxhdpi', 192)):
        save(icon(px), res, 'mipmap-' + name, 'ic_launcher.png')
    save(wordmark(640, 360).convert('RGB'), res, 'drawable-xhdpi', 'banner.png')
    save(icon(512, radius=0.0).convert('RGB'), 'store', 'icon-512.png')
    save(wordmark(1280, 720, sub='Your HallFlix server on the big screen').convert('RGB'), 'store', 'banner-1280x720.png')
