"""
Scheduler behaviour and a golden-file replay.

docs/05 asks for "golden-file test on the scheduler: fixed seed, fixed dates, asserted
queue". The scheduler takes no seed because it makes no random choices, so determinism
is the property under test as much as the queue itself.

Regenerate deliberately, never casually:
    python3 tests/test_schedule.py --regenerate
A diff in the golden file is a change in what a child practises. Read it.
"""
import json
import pathlib
import sys
import unittest
from datetime import date, timedelta

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1] / "engine"))

from classify import classify  # noqa: E402
from schedule import BOX_DAYS, PATTERN_TRIGGER, Scheduler  # noqa: E402
from words import WORDS  # noqa: E402

GOLDEN = pathlib.Path(__file__).resolve().parent / "golden" / "session.json"
BY_WORD = {w["word"]: w for w in WORDS}
START = date(2026, 9, 8)


def replay():
    """A fixed three-session run. She misses the first three words of each session."""
    s = Scheduler(WORDS, today=START)
    log = []
    for day_offset in (0, 2, 6):
        s.advance_to(START + timedelta(days=day_offset))
        queue = s.session(size=8)
        marks = []
        for i, word in enumerate(queue):
            attempt = BY_WORD[word]["errors"][0] if i < 3 else word
            d = classify(attempt, BY_WORD[word])
            s.record(word, d["correct"], d["patterns"])
            marks.append({"word": word, "attempt": attempt, "correct": d["correct"],
                          "type": d["type"], "patterns": d["patterns"]})
        log.append({"day": (START + timedelta(days=day_offset)).isoformat(),
                    "queue": queue, "marks": marks, "report": s.report()})
    return log


class TestGoldenSession(unittest.TestCase):
    def test_replay_matches_the_golden_file(self):
        self.assertTrue(GOLDEN.exists(), "golden file missing; run with --regenerate")
        expected = json.loads(GOLDEN.read_text())
        # Round-trip the live run too: JSON turns the integer box keys into strings,
        # so comparing a fresh replay against a parsed file would always differ.
        actual = json.loads(json.dumps(replay()))
        self.maxDiff = None
        self.assertEqual(actual, expected,
                         "scheduler output changed; if intended, --regenerate and read the diff")

    def test_replay_is_deterministic(self):
        self.assertEqual(replay(), replay())


class TestLeitner(unittest.TestCase):
    def setUp(self):
        self.s = Scheduler(WORDS, today=START)

    def test_box_intervals_match_the_documented_spacing(self):
        # docs/09 is explicit that 1/2/4/8/16 is convention consistent with Cepeda,
        # not derived from it. This test pins the convention so a change is deliberate.
        self.assertEqual(BOX_DAYS, {1: 1, 2: 2, 3: 4, 4: 8, 5: 16})

    def test_correct_promotes_one_box(self):
        self.s.record("yacht", True)
        self.assertEqual(self.s.state["yacht"]["box"], 2)

    def test_wrong_resets_to_box_one(self):
        for _ in range(3):
            self.s.record("yacht", True)
        self.assertEqual(self.s.state["yacht"]["box"], 4)
        self.s.record("yacht", False)
        self.assertEqual(self.s.state["yacht"]["box"], 1)

    def test_box_five_is_the_ceiling(self):
        for _ in range(10):
            self.s.record("yacht", True)
        self.assertEqual(self.s.state["yacht"]["box"], 5)

    def test_due_date_follows_the_box(self):
        self.s.record("yacht", True)
        self.assertEqual(self.s.state["yacht"]["due"], START + timedelta(days=BOX_DAYS[2]))

    def test_everything_starts_due(self):
        self.assertEqual(len(self.s.due()), len(WORDS))


class TestPatternLayer(unittest.TestCase):
    """The part most spelling apps skip: a failing rule, not a failing word."""

    def setUp(self):
        self.s = Scheduler(WORDS, today=START)

    def test_a_pattern_becomes_weak_only_after_repeated_failure(self):
        self.s.record("accommodate", False, ["double-consonant"])
        self.assertNotIn("double-consonant", self.s.weak_patterns())
        self.s.record("aggressive", False, ["double-consonant"])
        self.assertIn("double-consonant", self.s.weak_patterns())

    def test_trigger_threshold_is_two(self):
        self.assertEqual(PATTERN_TRIGGER, 2)

    def test_weak_patterns_pull_in_sibling_words(self):
        for w in ("accommodate", "aggressive"):
            self.s.record(w, False, ["double-consonant"])
        queue = self.s.session(size=9)
        siblings = self.s.patterns["double-consonant"]["members"]
        self.assertTrue(set(queue) & set(siblings))

    def test_correct_answers_do_not_make_a_pattern_weak(self):
        for w in ("accommodate", "aggressive"):
            self.s.record(w, True, ["double-consonant"])
        self.assertEqual(self.s.weak_patterns(), [])


class TestInterleaving(unittest.TestCase):
    """docs/01 Tier 2: interleaved beat blocked at eight weeks."""

    def test_neighbouring_words_avoid_sharing_a_pattern(self):
        s = Scheduler(WORDS, today=START)
        queue = s.session(size=10)
        clashes = [(a, b) for a, b in zip(queue, queue[1:])
                   if set(BY_WORD[a]["patterns"]) & set(BY_WORD[b]["patterns"])]
        # Greedy, so not guaranteed perfect; it must still do most of the job.
        self.assertLessEqual(len(clashes), 1, f"blocked practice crept in: {clashes}")

    def test_session_respects_the_requested_size(self):
        s = Scheduler(WORDS, today=START)
        for size in (5, 8, 10, 20):
            with self.subTest(size=size):
                self.assertEqual(len(s.session(size=size)), size)

    def test_session_never_repeats_a_word(self):
        s = Scheduler(WORDS, today=START)
        queue = s.session(size=20)
        self.assertEqual(len(queue), len(set(queue)))


if __name__ == "__main__":
    if "--regenerate" in sys.argv:
        GOLDEN.parent.mkdir(parents=True, exist_ok=True)
        GOLDEN.write_text(json.dumps(replay(), indent=1) + "\n")
        print(f"wrote {GOLDEN}")
    else:
        unittest.main()
