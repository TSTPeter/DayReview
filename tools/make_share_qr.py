"""
Draw the QR code behind "Share the game": the app's public address, nothing else.

    pip install segno     (a development tool only; the app has no dependencies)
    python3 tools/make_share_qr.py

The code is the same for everyone and carries no name, no id and no link back to
her: scanning it opens the game, fresh, on someone else's tablet. That is the whole
of sharing, as Peter chose on 1 October 2026 (docs/16-dpia.md). Writes
web/img/share-qr.svg, in the app's ink colour, so it works offline.
"""
import pathlib

import segno

ROOT = pathlib.Path(__file__).resolve().parents[1]
URL = "https://www.tsttalent.com/Spelling"
OUT = ROOT / "web" / "img" / "share-qr.svg"

if __name__ == "__main__":
    qr = segno.make(URL, error="m", micro=False)
    qr.save(str(OUT), kind="svg", scale=8, border=2, dark="#23201c", light="#fffdf7",
            xmldecl=False, svgns=True, title="A QR code for the spelling game")
    print(f"wrote {OUT.relative_to(ROOT)}  version {qr.version}, {qr.error} error correction, for {URL}")
