"""
Emit the word model for the front end.

The browser gets DATA, not logic. Everything the six screens need to render a reveal
is in this file: syllables, morphemes, origin, the one-line why, the sibling words.
What the browser must not get is a second opinion about classification, which is why
web/js/engine/classify.js is a mechanical port guarded by tests/test_parity.py.

    python3 engine/export.py

Writes web/data/words.json. Run it after any change to words.py or probe.py.
"""

import json
import pathlib

import probe
import sentences
from words import PATTERNS, WORDS

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / "web" / "data" / "words.json"
OUT_SENTENCES = ROOT / "web" / "data" / "sentences.json"


def build():
    return {
        "generated_by": "engine/export.py",
        "list": "dfe-y5y6-statutory",
        "patterns": PATTERNS,
        "probe_patterns": probe.PROBE_PATTERNS,
        "words": [{**w, "on_list": True} for w in WORDS],
        "off_list": probe.OFF_LIST,
    }


def build_sentences():
    return {"generated_by": "engine/sentences.py",
            "review_note": "Read these before a child does. See engine/sentences.py.",
            "sentences": sentences.SENTENCES,
            "pronunciation_watchlist": sentences.PRONUNCIATION_WATCHLIST}


if __name__ == "__main__":
    OUT.parent.mkdir(parents=True, exist_ok=True)
    payload = build()
    OUT.write_text(json.dumps(payload, indent=1) + "\n")
    print(f"wrote {OUT.relative_to(ROOT)}  "
          f"{len(payload['words'])} words, {len(payload['off_list'])} off-list, "
          f"{len(payload['patterns'])} patterns")

    spoken = build_sentences()
    OUT_SENTENCES.write_text(json.dumps(spoken, indent=1) + "\n")
    print(f"wrote {OUT_SENTENCES.relative_to(ROOT)}  "
          f"{len(spoken['sentences'])} sentences, "
          f"{len(spoken['pronunciation_watchlist'])} on the pronunciation watchlist")

    gaps = sentences.missing([w["word"] for w in payload["words"]]
                             + [w["word"] for w in payload["off_list"]])
    if gaps:
        raise SystemExit(f"MISSING SENTENCES: {gaps}")
