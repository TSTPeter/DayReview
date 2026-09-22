"""
Render every dictation line to an MP3 in one ElevenLabs voice.

    python3 tools/render_audio.py --dry-run          # what would render, spends nothing
    ELEVENLABS_API_KEY=... python3 tools/render_audio.py
    ELEVENLABS_API_KEY=... python3 tools/render_audio.py --only prophecy prophesy

On Windows PowerShell:

    $env:ELEVENLABS_API_KEY="..."; py tools\\render_audio.py

Writes web/audio/<hash>.mp3 and web/data/audio.json, then deletes any clip the
new manifest no longer uses. Re-running is cheap: a clip is only rendered when
its text, voice, model or settings changed, so editing one sentence re-renders
one sentence.

WHY PRE-RENDERED, NOT LIVE. docs/05 already chose this ("generate once per word
and per sentence, store, serve"), for three reasons that still hold:

  1. No key in the browser. A live call from the page would ship the API key to
     anyone with the URL.
  2. Offline. docs/05 decision 6: home broadband and school networks both fail.
     A file the service worker has cached plays on a plane.
  3. It can be CHECKED. docs/05 decision 3 says listen to every word by hand.
     Device speech differs between an iPad, a Chromebook and a laptop, so no
     amount of listening on one device says what she hears on another. A
     rendered clip is the same file everywhere: listen once and it is known.

The third is the real argument. Voice quality is not: Wood et al. (2018, 22
studies) found voice type is not a significant moderator of text-to-speech
effectiveness. The gain here is consistency and checkability of pronunciation,
not a nicer voice.

THE CONTRACT WITH THE BROWSER. web/js/audio.js looks a clip up by the EXACT
text it is about to say. So the manifest is keyed by that text, and a line whose
text is not in it (a school word nobody rendered, a sentence edited since the
last render) falls back to the device's own voice for the whole item. Nothing
stale can ever play: edited text has a different key.
"""
import argparse
import hashlib
import json
import os
import pathlib
import sys
import time
import urllib.error
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "engine"))

import derive  # noqa: E402
import sentences  # noqa: E402

AUDIO_DIR = ROOT / "web" / "audio"
MANIFEST = ROOT / "web" / "data" / "audio.json"

# Stephen B, the voice Peter chose. Note there are two voices of that name in
# the workspace: this one is an instant clone ("A test track for PMI
# podcasts"); co3Fa2DchGAVyZ7WbMAQ is a professional clone labelled
# en-british. Swap with --voice to compare; every clip re-renders because the
# voice is part of each clip's hash.
VOICE_ID = "7a3RHgjBsCMZwVMrTWfz"
VOICE_NAME = "Stephen B"

# Eleven v3, Peter's choice. Its gain for this app is contextual reading: the
# line "The word is prophesy, the verb." gives it the part of speech, which is
# exactly what separates -see from -sigh. ElevenLabs' own caveat, quoted from
# https://elevenlabs.io/docs/overview/capabilities/text-to-speech/best-practices:
#   "Professional Voice Clones (PVCs) are currently not fully optimized for
#    Eleven v3, resulting in potentially lower clone quality"
# which is a reason to keep the instant clone above rather than switch to the
# professional Stephen B. v3 also has no SSML break or phoneme tags, so a
# mispronunciation is fixed by respelling in SPOKEN_OVERRIDES below.
MODEL_ID = "eleven_v3"

# 64 kbps at 44.1 kHz. The pairs this app exists to teach turn on fricatives
# (advice / advise, practice / practise), which live in the high frequencies a
# lower sample rate throws away. About 8 KB a second of speech.
OUTPUT_FORMAT = "mp3_44100_64"

# v3 exposes stability as three presets, and the same page describes them:
#   Creative  "More emotional and expressive, but prone to hallucinations."
#   Natural   "Closest to the original voice recording, balanced and neutral."
#   Robust    "Highly stable ... consistent, similar to v2."
# Robust. A hallucinated word is the worst thing a spelling test can say, and
# the KS2 administrator is told not to overemphasise the target word anyway.
# The docs give no numbers for the presets; 1.0 is Robust whether the API reads
# stability as a continuous 0-1 scale or as the three stops 0.0 / 0.5 / 1.0.
# If it sounds flat, try 0.5 (Natural). Never 0.0.
#
# Only settings v3 documents are sent. style and speaker boost are v2 controls.
VOICE_SETTINGS = {
    "stability": 1.0,
    "similarity_boost": 0.8,
}

# Same seed every run, so a re-render of unchanged text is as close to the
# previous take as the API allows.
SEED = 7

# Text actually SENT to the voice, where it must differ from the text the app
# looks the clip up by. The key stays the real line; only the audio changes.
# This is where to fix a word Peter hears mispronounced, e.g.
#     "The word is prophesy, the verb.": "The word is profess-eye, the verb.",
# Empty until someone has listened. See docs/13.
SPOKEN_OVERRIDES = {}

API = "https://api.elevenlabs.io/v1"


def utterances():
    """Every line the app can dictate from a clip: [(key_text, word)]."""
    out = []
    for word, sentence in sorted(sentences.SENTENCES.items()):
        out.append((sentences.naming_line(word, derive.hint_for(word)), word))
        out.append((sentence, word))
    seen, unique = set(), []
    for text, word in out:
        if text not in seen:
            seen.add(text)
            unique.append((text, word))
    return unique


def clip_name(spoken_text, voice_id):
    """Content address. Anything that changes the audio changes the name."""
    ident = json.dumps([voice_id, MODEL_ID, OUTPUT_FORMAT, VOICE_SETTINGS, SEED,
                        spoken_text], sort_keys=True)
    return hashlib.sha256(ident.encode("utf-8")).hexdigest()[:16] + ".mp3"


def request(method, url, key, body=None, accept="application/json"):
    data = json.dumps(body).encode("utf-8") if body is not None else None
    req = urllib.request.Request(url, data=data, method=method, headers={
        "xi-api-key": key, "Content-Type": "application/json", "Accept": accept})
    return urllib.request.urlopen(req, timeout=60)


def describe(err):
    try:
        detail = json.loads(err.read().decode("utf-8")).get("detail")
    except Exception:  # noqa: BLE001 - best effort, the status code is enough
        detail = None
    return f"HTTP {err.code}: {detail}" if detail else f"HTTP {err.code}"


def check_voice(key, voice_id):
    try:
        with request("GET", f"{API}/voices/{voice_id}", key) as r:
            v = json.loads(r.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        sys.exit(f"Cannot use voice {voice_id}: {describe(e)}. Check the key and the id.")
    labels = v.get("labels") or {}
    print(f"voice: {v.get('name')} ({v.get('category')}), "
          f"accent: {labels.get('accent', 'not labelled')}")


def render(key, voice_id, text):
    body = {"text": text, "model_id": MODEL_ID,
            "voice_settings": VOICE_SETTINGS, "seed": SEED}
    url = f"{API}/text-to-speech/{voice_id}?output_format={OUTPUT_FORMAT}"
    for attempt in range(4):
        try:
            with request("POST", url, key, body, accept="audio/mpeg") as r:
                audio = r.read()
            if len(audio) < 1000:
                raise RuntimeError(f"suspiciously small response ({len(audio)} bytes)")
            return audio
        except urllib.error.HTTPError as e:
            # 429 is the plan's concurrency or rate limit; 5xx is theirs.
            if e.code in (429, 500, 502, 503, 504) and attempt < 3:
                time.sleep(2 ** attempt * 2)
                continue
            raise RuntimeError(describe(e)) from None
        except (urllib.error.URLError, TimeoutError, OSError) as e:
            # A dropped connection mid-run should cost one line, not the run.
            if attempt < 3:
                time.sleep(2 ** attempt * 2)
                continue
            raise RuntimeError(f"network: {e}") from None
    raise RuntimeError("gave up after retries")


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[1])
    ap.add_argument("--dry-run", action="store_true", help="count, render nothing")
    ap.add_argument("--voice", default=VOICE_ID, help="ElevenLabs voice id")
    ap.add_argument("--only", nargs="+", metavar="WORD",
                    help="force re-render of these words' lines")
    ap.add_argument("--keep-orphans", action="store_true",
                    help="do not delete clips the manifest no longer uses")
    args = ap.parse_args(argv)

    lines = utterances()
    plan = []
    for text, word in lines:
        spoken = SPOKEN_OVERRIDES.get(text, text)
        name = clip_name(spoken, args.voice)
        forced = bool(args.only) and word in args.only
        if forced or not (AUDIO_DIR / name).exists():
            plan.append((text, spoken, name))

    chars = sum(len(s) for _, s, _ in plan)
    print(f"{len(lines)} lines in the dictation set; "
          f"{len(plan)} to render ({chars} characters)")
    if args.dry_run:
        for text, _, _ in plan[:10]:
            print(f"  would render: {text}")
        if len(plan) > 10:
            print(f"  ... and {len(plan) - 10} more")
        return

    key = os.environ.get("ELEVENLABS_API_KEY")
    if plan and not key:
        sys.exit("Set ELEVENLABS_API_KEY first. Never commit it, and never paste it "
                 "into a file under web/: everything there is served to browsers.")

    AUDIO_DIR.mkdir(parents=True, exist_ok=True)
    if plan:
        check_voice(key, args.voice)
    failed = []
    for i, (text, spoken, name) in enumerate(plan, 1):
        try:
            (AUDIO_DIR / name).write_bytes(render(key, args.voice, spoken))
            print(f"  [{i}/{len(plan)}] {text}")
        except RuntimeError as e:
            failed.append((text, str(e)))
            print(f"  [{i}/{len(plan)}] FAILED {text}: {e}")

    # The manifest lists only clips that exist, so a failed render degrades to
    # the device voice for that item instead of pointing at a missing file.
    clips = {}
    for text, _ in lines:
        name = clip_name(SPOKEN_OVERRIDES.get(text, text), args.voice)
        if (AUDIO_DIR / name).exists():
            clips[text] = f"audio/{name}"
    MANIFEST.write_text(json.dumps({
        "generated_by": "tools/render_audio.py",
        "voice_id": args.voice,
        "voice_name": VOICE_NAME if args.voice == VOICE_ID else args.voice,
        "model_id": MODEL_ID,
        "output_format": OUTPUT_FORMAT,
        "clips": clips,
    }, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")

    if not args.keep_orphans:
        used = {pathlib.Path(v).name for v in clips.values()}
        for f in AUDIO_DIR.glob("*.mp3"):
            if f.name not in used:
                f.unlink()

    size = sum(f.stat().st_size for f in AUDIO_DIR.glob("*.mp3"))
    print(f"wrote {MANIFEST.relative_to(ROOT)}: {len(clips)}/{len(lines)} lines "
          f"have a clip, {size / 1e6:.1f} MB")
    if failed:
        sys.exit(f"{len(failed)} line(s) failed; they will use the device voice. "
                 "Re-run to retry just those.")


if __name__ == "__main__":
    main()
