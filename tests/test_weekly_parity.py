"""
The browser must derive the same patterns and pick the same words as Python.

Weekly lists are typed on the tablet, so derivation and session composition
both run in the browser. If the two implementations disagree, a word gets a
different rule in the dataset from the one it was taught with, and two
children on two devices practise different things from the same list.

Skips cleanly when node is unavailable.
"""
import json
import pathlib
import shutil
import subprocess
import sys
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "engine"))

from datetime import date, timedelta  # noqa: E402

import probe  # noqa: E402
import weekly as py_weekly  # noqa: E402
from derive import derive as py_derive  # noqa: E402
from schedule import Scheduler  # noqa: E402
from words import WORDS  # noqa: E402

RUNNER = ROOT / "tests" / "weekly_parity_runner.mjs"
NODE = shutil.which("node")
# Every word we have curated ANYWHERE, statutory list and off-list transfer
# set alike. If a school list happens to contain 'separate', it should get the
# curated entry with its origin and word family, not a derived stub. The app
# builds this lookup the same way; an earlier version of this test did not,
# and the parity check caught the difference.
BY_WORD = {w["word"]: w for w in list(WORDS) + list(probe.OFF_LIST)}

SET_ON = "2026-09-21"
LIST_TEXT = ("necessary rhythm conscience wednesday separate business "
             "definitely embarrass occurred tomorrow")
HARD = ["necessary", "rhythm", "conscience", "wednesday"]
OFFSETS = [0, 1, 2, 3, 4, 5, 8, 12, 20, 26]
SIZE = 12

# Every curated word, every off-list word, plus school words of the kind a
# Year 6 list actually contains — including the awkward ones.
SCHOOL_WORDS = [
    "tomorrow", "business", "definitely", "separate", "wednesday", "column",
    "knowledge", "rhythm", "psychology", "chemistry", "receipt", "subtle",
    "castle", "listen", "often", "answer", "sword", "honest", "hour",
    "stationery", "stationary", "practice", "practise", "principal",
    "principle", "complement", "compliment", "desert", "dessert",
    "beautiful", "carried", "happiest", "cities", "earlier", "occurred",
    "beginning", "preferred", "forgotten", "possession", "irregular",
    "delicious", "useful", "although", "thought", "enough", "cough",
    "unique", "antique", "chauffeur", "silhouette", "picturesque",
    "cat", "dog", "a", "", "Don't", "  SPACED  ",
]


@unittest.skipIf(NODE is None, "node not installed")
class TestWeeklyParity(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.words = [w["word"] for w in WORDS] + SCHOOL_WORDS
        payload = {"words": cls.words, "listText": LIST_TEXT, "setOn": SET_ON,
                   "offsets": OFFSETS, "hard": HARD, "size": SIZE}
        proc = subprocess.run([NODE, str(RUNNER)], input=json.dumps(payload),
                              capture_output=True, text=True)
        if proc.returncode != 0:
            raise AssertionError(f"node runner failed:\n{proc.stderr}")
        cls.js = json.loads(proc.stdout)

    def test_derive_agrees_on_every_word(self):
        self.maxDiff = None
        for w in self.words:
            with self.subTest(word=w):
                self.assertEqual(self.js["derived"][w], py_derive(w, limit=99),
                                 f"derive diverged on {w!r}")

    def test_the_list_is_parsed_and_dated_identically(self):
        py = py_weekly.make_list(LIST_TEXT, set_on=date.fromisoformat(SET_ON))
        self.assertEqual(self.js["list"]["words"], py["words"])
        self.assertEqual(self.js["list"]["test_on"], py["test_on"])
        self.assertEqual(self.js["list"]["id"], py["id"])

    def test_every_session_queue_matches(self):
        py_list = py_weekly.make_list(LIST_TEXT, set_on=date.fromisoformat(SET_ON))
        extra = [e for e in py_weekly.entries_for(py_list["words"], BY_WORD)
                 if e["word"] not in BY_WORD]
        s = Scheduler(WORDS + extra, today=date.fromisoformat(SET_ON))
        self.maxDiff = None
        for i, offset in enumerate(OFFSETS):
            day = date.fromisoformat(SET_ON) + timedelta(days=offset)
            s.advance_to(day)
            queue = py_weekly.compose(s, py_list, size=SIZE, today=day)
            for w in queue:
                s.record(w, w not in HARD)
            with self.subTest(day=day.isoformat()):
                self.assertEqual(self.js["log"][i]["day"], day.isoformat())
                self.assertEqual(self.js["log"][i]["queue"], queue,
                                 f"session diverged on {day}")

    def test_coverage_counts_match(self):
        py_list = py_weekly.make_list(LIST_TEXT, set_on=date.fromisoformat(SET_ON))
        extra = [e for e in py_weekly.entries_for(py_list["words"], BY_WORD)
                 if e["word"] not in BY_WORD]
        s = Scheduler(WORDS + extra, today=date.fromisoformat(SET_ON))
        for i, offset in enumerate(OFFSETS):
            day = date.fromisoformat(SET_ON) + timedelta(days=offset)
            s.advance_to(day)
            for w in py_weekly.compose(s, py_list, size=SIZE, today=day):
                s.record(w, w not in HARD)
            cov = py_weekly.coverage(py_list, s)
            with self.subTest(day=day.isoformat()):
                for key in ("words", "practised", "untouched", "secure"):
                    self.assertEqual(self.js["log"][i]["coverage"][key], cov[key],
                                     f"{key} diverged on {day}")


if __name__ == "__main__":
    unittest.main()
