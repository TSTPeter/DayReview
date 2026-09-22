"""
Generate the app icons.

    python3 tools/make_icons.py

Writes PNGs into web/icons/ plus web/apple-touch-icon.png. Committed rather than
generated at deploy time, because the site that serves this app is a plain
static host with no build step.

The mark is the same cut-paper idea as the app itself: a cream sheet, torn and
tilted, sitting on a teal table. No gradients and no glow - it has to read at
48px on a home screen, which is the only size that matters.
"""
import pathlib

from PIL import Image, ImageDraw, ImageFont

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / "web"

TEAL = (47, 125, 114)     # --cut-teal
PAPER = (255, 253, 247)   # --paper-1
INK = (35, 32, 28)        # --ink
FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"

# Every icon is drawn at 4x and downsampled: the tilted sheet has long diagonal
# edges, which alias badly at icon sizes otherwise.
SS = 4


def draw(size):
    n = size * SS
    img = Image.new("RGB", (n, n), TEAL)

    # The sheet, drawn on its own layer so it can be rotated with a clean edge.
    # Kept inside the central 78% so a maskable icon survives a circular crop.
    pad = int(n * 0.16)
    sheet = Image.new("RGBA", (n, n), (0, 0, 0, 0))
    sd = ImageDraw.Draw(sheet)
    sd.rounded_rectangle([pad, pad, n - pad, n - pad],
                         radius=int(n * 0.045), fill=PAPER + (255,))

    d = ImageDraw.Draw(sheet)
    text = "Sp"
    font = ImageFont.truetype(FONT, int(n * 0.36))
    box = d.textbbox((0, 0), text, font=font)
    d.text(((n - (box[2] - box[0])) / 2 - box[0],
            (n - (box[3] - box[1])) / 2 - box[1]), text, font=font, fill=INK)

    sheet = sheet.rotate(-4, resample=Image.BICUBIC, center=(n / 2, n / 2))
    img.paste(sheet, (0, 0), sheet)
    return img.resize((size, size), Image.LANCZOS)


if __name__ == "__main__":
    (OUT / "icons").mkdir(parents=True, exist_ok=True)
    for size in (192, 512):
        draw(size).save(OUT / "icons" / f"icon-{size}.png")
        print(f"wrote web/icons/icon-{size}.png")
    # iOS ignores the manifest and wants this one, opaque and unrounded: it
    # applies its own mask. Without it a home-screen tile is a blank square.
    draw(180).save(OUT / "apple-touch-icon.png")
    print("wrote web/apple-touch-icon.png")
