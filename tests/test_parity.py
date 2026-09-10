"""
Python and JavaScript must classify identically.

docs/05 decision 1 says the front end never reimplements the engine, because two
implementations drift and the dataset becomes uninterpretable. Running with no server
forces a browser-side classifier, so the rule is broken deliberately and this test is
the price. It runs both implementations over:

  * every curated misspelling on the statutory list and the off-list transfer words
  * every correctly-spelled word
  * the mark-scheme edge cases
  * several thousand deterministic mutations

and fails on the first disagreement. If this test is red, the dataset collected in the
browser cannot be pooled with anything scored in Python, so treat it as a build blocker
rather than a warning.

Skips cleanly when node is unavailable, so the suite still runs on a bare box.
"""
import json
import pathlib
import random
import shutil
import subprocess
import sys
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "engine"))

import probe  # noqa: E402
from classify import classify  # noqa: E402
from words import WORDS  # noqa: E402

RUNNER = ROOT / "tests" / "parity_runner.mjs"
ENTRIES = {w["word"]: w for w in list(WORDS) + list(probe.OFF_LIST)}
NODE = shutil.which("node")

COMPARED = ("correct", "type", "detail", "patterns", "sounds_right", "trap", "mark_scheme")
ALPHABET = "abcdefghijklmnopqrstuvwxyz"


def js_classify(cases):
    proc = subprocess.run(
        [NODE, str(RUNNER)], input=json.dumps(cases), capture_output=True, text=True)
    if proc.returncode != 0:
        raise AssertionError(f"node runner failed:\n{proc.stderr}")
    return json.loads(proc.stdout)


def py_classify(cases):
    out = []
    for c in cases:
        d = classify(c["attempt"], ENTRIES[c["word"]])
        out.append({k: d[k] for k in COMPARED})
    return out


def mutations(seed=20260909, per_word=25):
    """Deterministic mutations: the shapes a real misspelling actually takes."""
    rng = random.Random(seed)
    cases = []
    for entry in ENTRIES.values():
        w = entry["word"]
        for _ in range(per_word):
            i = rng.randrange(len(w))
            kind = rng.choice(["delete", "insert", "substitute", "swap", "double", "undouble"])
            if kind == "delete":
                bad = w[:i] + w[i + 1:]
            elif kind == "insert":
                bad = w[:i] + rng.choice(ALPHABET) + w[i:]
            elif kind == "substitute":
                bad = w[:i] + rng.choice(ALPHABET) + w[i + 1:]
            elif kind == "swap" and i < len(w) - 1:
                bad = w[:i] + w[i + 1] + w[i] + w[i + 2:]
            elif kind == "double":
                bad = w[:i] + w[i] + w[i:]
            else:
                bad = w[:i] + w[i + 1:] if i and w[i] == w[i - 1] else w
            if bad and bad != w:
                cases.append({"word": w, "attempt": bad})
    return cases


@unittest.skipIf(NODE is None, "node not installed")
class TestParity(unittest.TestCase):
    def assertParity(self, cases, label):
        self.maxDiff = None
        expected, actual = py_classify(cases), js_classify(cases)
        self.assertEqual(len(expected), len(actual))
        for case, py, js in zip(cases, expected, actual):
            if py != js:
                self.fail(
                    f"{label}: '{case['attempt']}' -> '{case['word']}' diverged\n"
                    f"  python: {json.dumps(py, sort_keys=True)}\n"
                    f"  js    : {json.dumps(js, sort_keys=True)}")

    def test_curated_corpus_agrees(self):
        cases = [{"word": w["word"], "attempt": bad}
                 for w in ENTRIES.values() for bad in w["errors"]]
        self.assertGreaterEqual(len(cases), 293)
        self.assertParity(cases, "curated")

    def test_correct_spellings_agree(self):
        self.assertParity([{"word": w, "attempt": w} for w in ENTRIES], "correct")

    def test_mark_scheme_cases_agree(self):
        cases = []
        for w in list(ENTRIES)[:20]:
            mid = len(w) // 2
            cases += [
                {"word": w, "attempt": w.upper()},
                {"word": w, "attempt": w.capitalize()},
                {"word": w, "attempt": f"  {w}  "},
                {"word": w, "attempt": w[:mid] + "-" + w[mid:]},
                {"word": w, "attempt": w[:mid] + "'" + w[mid:]},
                {"word": w, "attempt": w[:mid] + " " + w[mid:]},
                {"word": w, "attempt": ""},
            ]
        self.assertParity(cases, "mark scheme")

    def test_generated_mutations_agree(self):
        cases = mutations()
        self.assertGreater(len(cases), 2000, "mutation set unexpectedly small")
        self.assertParity(cases, "mutation")

    def test_empty_and_junk_input_agrees(self):
        cases = [{"word": "yacht", "attempt": a}
                 for a in ["", "   ", "!!!", "123", "y a c h t", "YACHT!", "yacht."]]
        self.assertParity(cases, "junk")


if __name__ == "__main__":
    unittest.main()
