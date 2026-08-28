#!/usr/bin/env python3
"""Generate 1200×630 OG image for Human Check article."""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

OUT = Path("/workspace/blog/assets/og-human-check.png")
W, H = 1200, 630

BG = (23, 23, 21)
CARD = (242, 238, 230)
INK = (23, 23, 21)
MUTED = (92, 86, 80)
ACCENT = (208, 138, 76)

img = Image.new("RGB", (W, H), BG)
draw = ImageDraw.Draw(img)

# Card
draw.rounded_rectangle((56, 56, 720, H - 56), radius=8, fill=CARD)

# Accent bar
draw.rectangle((88, 96, 128, 100), fill=INK)

try:
    font_cat = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 22)
    font_title = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 44)
    font_sub = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 22)
    font_brand = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 20)
except OSError:
    font_cat = font_title = font_sub = font_brand = ImageFont.load_default()

draw.text((88, 118), "EXPERIMENTS", fill=MUTED, font=font_cat)
title = "Can verification become\nan interaction, not\nan interruption?"
draw.multiline_text((88, 168), title, fill=INK, font=font_title, spacing=8)
draw.text((88, H - 96), "Vulcet Journal", fill=MUTED, font=font_brand)

# Trajectory graphic (right side)
cx, cy = 930, 315
draw.ellipse((cx - 210, cy - 210, cx + 210, cy + 210), outline=(208, 138, 76, 90), width=2)
draw.ellipse((cx - 64, cy - 64, cx + 64, cy + 64), outline=(242, 238, 230, 120), width=2)
sx, sy = 780, 420
draw.ellipse((sx - 22, sy - 22, sx + 22, sy + 22), fill=INK)
points = [(sx, sy), (840, 380), (880, 340), (920, 310), (cx, cy)]
for i in range(len(points) - 1):
    draw.line([points[i], points[i + 1]], fill=INK, width=3)
for px, py in points[1:-1]:
    draw.ellipse((px - 5, py - 5, px + 5, py + 5), fill=ACCENT)

draw.text((780, 480), "Human Check", fill=(242, 238, 230), font=font_sub)

OUT.parent.mkdir(parents=True, exist_ok=True)
img.save(OUT, "PNG", optimize=True)
print(f"wrote {OUT} ({W}×{H})")
