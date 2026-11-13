#!/usr/bin/env python3
"""Draw the Ember voxel launcher icon. Needs Pillow.
  python make_icon.py ember.png            lit (Start)
  python make_icon.py ember-off.png --off  burnt out (End)
"""
import math
import random
import sys

from PIL import Image, ImageDraw, ImageFilter

SIZE, SCALE = 512, 2
N = SIZE * SCALE
rng = random.Random(7)


def shade(rgb, k):
    return tuple(max(0, min(255, int(c * k))) for c in rgb)


def lerp(a, b, t):
    return tuple(a[i] + (b[i] - a[i]) * t for i in range(3))


# Background: dark ember vignette with a glow behind the flame.
glow = Image.new("L", (N, N), 0)
ImageDraw.Draw(glow).ellipse((N * .12, N * .38, N * .88, N * 1.0), fill=255)
glow = glow.filter(ImageFilter.GaussianBlur(N * .11))
img = Image.composite(Image.new("RGB", (N, N), (46, 42, 42) if '--off' in sys.argv else (150, 48, 14)),
                      Image.new("RGB", (N, N), (14, 8, 7)), glow)

# Flame-shaped voxel stack.
voxels = set()
for z in range(8):
    radius = 3.4 * (1 - z / 8.6) + 0.5
    for x in range(-4, 5):
        for y in range(-4, 5):
            d = math.hypot(x + rng.uniform(-.25, .25), y + rng.uniform(-.25, .25))
            if d <= radius and not (z > 4 and rng.random() < .22):
                voxels.add((x, y, z))
for _ in range(7):  # drifting sparks
    voxels.add((rng.randint(-3, 3), rng.randint(-3, 3), rng.randint(8, 9)))

OFF = '--off' in sys.argv
COLD, HOT = ((40, 36, 36), (120, 112, 108)) if OFF else ((122, 31, 14), (255, 190, 50))
unit = N * .047
cx, cy = N * .5, N * .70
draw = ImageDraw.Draw(img)


def proj(x, y, z):
    return (cx + (x - y) * unit * .866, cy + (x + y) * unit * .5 - z * unit)


for x, y, z in sorted(voxels, key=lambda v: (v[0] + v[1] + v[2], v[2])):
    t = min(1, z / 8) ** .8
    rgb = lerp(COLD, HOT, t)
    rgb = shade(rgb, rng.uniform(.9, 1.08))
    faces = (
        (1.12, [(0, 0, 1), (1, 0, 1), (1, 1, 1), (0, 1, 1)]),   # top
        (.78, [(1, 0, 0), (1, 1, 0), (1, 1, 1), (1, 0, 1)]),    # +x
        (.52, [(0, 1, 0), (1, 1, 0), (1, 1, 1), (0, 1, 1)]),    # +y
    )
    for k, corners in faces:
        pts = [proj(x + a, y + b, z + c) for a, b, c in corners]
        draw.polygon(pts, fill=shade(rgb, k), outline=shade(rgb, .3))

img = img.resize((SIZE, SIZE), Image.LANCZOS)
img.save(next((a for a in sys.argv[1:] if not a.startswith("--")), "ember.png"))
