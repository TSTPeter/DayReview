"""
Probe construction, profile computation and the escalation ladder.
"""
import pathlib
import sys
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1] / "engine"))

import ladder  # noqa: E402
import probe  # noqa: E402
from classify import classify  # noqa: E402
from profile import (CONFIDENCE_FLOOR, compute, confidence_for,  # noqa: E402
                     narrate, needs_orthographic_choice)
from words import WORDS  # noqa: E402

BY_WORD = {w["word"]: w for w in WORDS}
STATUTORY = {w["word"] for w in WORDS}


def marks_for(pairs):
    """pairs of (entry, attempt_text)."""
    return [{"entry": e, "diagnosis": classify(a, e)} for e, a in pairs]


class TestProbe(unittest.TestCase):
    def setUp(self):
        self.items = probe.build(0)

    def test_probe_is_twenty_four_items(self):
        self.assertEqual(len(self.items), 24)

    def test_sixteen_on_list_and_eight_off_list(self):
        on, off = probe.split(self.items)
        self.assertEqual((len(on), len(off)), (16, 8))

    def test_off_list_words_are_genuinely_not_on_the_statutory_list(self):
        # The whole point of the transfer slice. If one crept onto the list it would
        # silently stop measuring transfer.
        for w in probe.OFF_LIST:
            with self.subTest(word=w["word"]):
                self.assertNotIn(w["word"], STATUTORY)

    def test_no_word_appears_twice_in_a_probe(self):
        seen = [i["word"] for i in self.items]
        self.assertEqual(len(seen), len(set(seen)))

    def test_no_pattern_is_represented_by_a_single_on_list_word(self):
        # docs/03: "One word is an anecdote."
        on, _ = probe.split(self.items)
        counts = {}
        for i in on:
            counts[i["probe_pattern"]] = counts.get(i["probe_pattern"], 0) + 1
        self.assertTrue(all(n >= 2 for n in counts.values()), counts)

    def test_each_off_list_word_covers_a_probe_pattern(self):
        _, off = probe.split(self.items)
        self.assertEqual({i["probe_pattern"] for i in off}, set(probe.PROBE_PATTERNS))

    def test_reruns_are_deterministic(self):
        self.assertEqual([i["word"] for i in probe.build(3)],
                         [i["word"] for i in probe.build(3)])

    def test_a_later_run_samples_different_on_list_words(self):
        # docs/03: "Re-run every half term with a different sample."
        first = {i["word"] for i in probe.split(probe.build(0))[0]}
        second = {i["word"] for i in probe.split(probe.build(1))[0]}
        self.assertNotEqual(first, second)

    def test_off_list_entries_are_classifiable(self):
        for w in probe.OFF_LIST:
            for bad in w["errors"]:
                with self.subTest(word=w["word"], attempt=bad):
                    d = classify(bad, w)
                    self.assertFalse(d["correct"])
                    self.assertTrue(d["patterns"])

    def test_off_list_entries_have_no_duplicate_errors(self):
        for w in probe.OFF_LIST:
            with self.subTest(word=w["word"]):
                self.assertEqual(len(w["errors"]), len(set(w["errors"])))

    def test_off_list_entries_carry_every_field_the_reveal_screen_needs(self):
        for w in probe.OFF_LIST:
            for field in ("syll", "lang", "root", "gloss", "morph", "why", "family"):
                with self.subTest(word=w["word"], field=field):
                    self.assertTrue(w[field])


class TestProfile(unittest.TestCase):
    def test_all_correct_gives_no_phonological_reliance(self):
        p = compute(marks_for([(BY_WORD["yacht"], "yacht")]))
        self.assertIsNone(p["phonological_reliance"])
        self.assertEqual(p["accuracy"], 1.0)

    def test_phonological_reliance_counts_errors_that_read_aloud_right(self):
        marks = marks_for([
            (BY_WORD["physical"], "fisical"),      # sounds right
            (BY_WORD["government"], "goverment"),  # does not
        ])
        self.assertEqual(compute(marks)["phonological_reliance"], 0.5)

    def test_orthographic_choice_counts_only_correct_spellings(self):
        marks = marks_for([
            (BY_WORD["ancient"], "ancient"),        # sh-spelling: a choice word
            (BY_WORD["accommodate"], "accommodate"),  # doubling: not a choice word
        ])
        self.assertEqual(compute(marks)["orthographic_choice_rate"], 0.5)

    def test_choice_classification_matches_the_documented_set(self):
        self.assertTrue(needs_orthographic_choice(BY_WORD["ancient"]))
        self.assertFalse(needs_orthographic_choice(BY_WORD["accommodate"]))

    def test_error_mix_sums_to_one(self):
        marks = marks_for([(BY_WORD[w], b) for w, b in
                           [("physical", "fisical"), ("government", "goverment"),
                            ("necessary", "neccessary"), ("achieve", "acheive")]])
        self.assertAlmostEqual(sum(compute(marks)["error_mix"].values()), 1.0, places=2)

    def test_transfer_separates_on_list_from_off_list(self):
        off = probe.OFF_LIST[0]
        marks = marks_for([(BY_WORD["yacht"], "yacht"), (off, off["errors"][0])])
        t = compute(marks)["transfer"]
        self.assertEqual(t["on_list"], 1.0)
        self.assertEqual(t["off_list"], 0.0)
        self.assertEqual(t["off_list_items"], 1)

    def test_confidence_is_low_below_the_documented_floor(self):
        self.assertEqual(confidence_for(CONFIDENCE_FLOOR - 1), "low")
        self.assertEqual(confidence_for(CONFIDENCE_FLOOR), "medium")

    def test_a_full_probe_is_not_low_confidence(self):
        items = probe.build(0)
        marks = marks_for([(i, i["word"]) for i in items])
        self.assertNotEqual(compute(marks)["confidence"], "low")

    def test_pattern_strength_is_a_proportion(self):
        marks = marks_for([(BY_WORD["accommodate"], "accomodate"),
                           (BY_WORD["aggressive"], "aggressive")])
        for p, v in compute(marks)["pattern_strength"].items():
            with self.subTest(pattern=p):
                self.assertGreaterEqual(v, 0.0)
                self.assertLessEqual(v, 1.0)

    def test_empty_input_does_not_explode(self):
        p = compute([])
        self.assertEqual(p["items"], 0)
        self.assertEqual(p["confidence"], "low")
        self.assertIsNone(p["accuracy"])

    def test_narrate_warns_when_confidence_is_low(self):
        lines = narrate(compute(marks_for([(BY_WORD["yacht"], "yatch")])))
        self.assertTrue(any("hint" in line for line in lines))

    def test_narrate_names_the_orthographic_diagnosis(self):
        marks = marks_for([(BY_WORD["physical"], "fisical")] * 3)
        self.assertTrue(any("orthographic" in line for line in narrate(compute(marks))))


class TestLadder(unittest.TestCase):
    def tearDown(self):
        ladder.ENABLED = False

    def test_ladder_is_off_by_default(self):
        # docs/08 M5. The fixed sequence is the product; adaptivity is the experiment.
        self.assertFalse(ladder.ENABLED)

    def test_no_method_is_shown_while_the_flag_is_off(self):
        self.assertIsNone(ladder.rung_for("doubling", 1))
        self.assertIsNone(ladder.method_shown("doubling", 1))

    def test_every_error_type_the_classifier_emits_has_a_ladder(self):
        ladder.ENABLED = True
        emitted = {classify(b, w)["type"] for w in WORDS for b in w["errors"]}
        for t in emitted:
            with self.subTest(error_type=t):
                self.assertTrue(ladder.ladder_for(t), f"no ladder for {t}")

    def test_a_mark_scheme_zero_never_escalates(self):
        ladder.ENABLED = True
        self.assertEqual(ladder.ladder_for("mark-scheme"), [])
        self.assertIsNone(ladder.rung_for("mark-scheme", 1))

    def test_two_failures_move_up_one_rung(self):
        r, f = ladder.next_rung("doubling", 1, 0)
        self.assertEqual((r, f), (1, 1))
        r, f = ladder.next_rung("doubling", r, f)
        self.assertEqual((r, f), (2, 0))

    def test_escalation_stops_at_the_top_rung(self):
        r, f = 3, 0
        for _ in range(6):
            r, f = ladder.next_rung("doubling", r, f)
        self.assertEqual(r, 3)

    def test_rung_three_is_whole_word_study_for_the_hard_cases(self):
        ladder.ENABLED = True
        for t in ("silent-letter", "transposition", "omission", "addition"):
            with self.subTest(error_type=t):
                self.assertEqual(ladder.rung_for(t, 3)["method"], "whole-word-study")

    def test_rung_is_clamped_to_the_available_range(self):
        ladder.ENABLED = True
        self.assertEqual(ladder.rung_for("doubling", 99)["rung"], 3)
        self.assertEqual(ladder.rung_for("doubling", 0)["rung"], 1)


if __name__ == "__main__":
    unittest.main()


class TestExportedProbes(unittest.TestCase):
    """The browser reads precomputed probes instead of re-deriving the selection rule."""

    def setUp(self):
        import json
        root = pathlib.Path(__file__).resolve().parents[1]
        self.data = json.loads((root / "web" / "data" / "words.json").read_text())

    def test_export_ships_a_probe_for_every_half_term(self):
        self.assertEqual(sorted(self.data["probes"]), [str(i) for i in range(6)])

    def test_every_exported_probe_is_twenty_four_words(self):
        for run, words in self.data["probes"].items():
            with self.subTest(run=run):
                self.assertEqual(len(words), 24)
                self.assertEqual(len(set(words)), 24)

    def test_exported_probes_match_the_engine(self):
        # If these drift, the child practises a different probe in the browser than the
        # profile code assumes, and two probes stop being comparable.
        for run in range(6):
            with self.subTest(run=run):
                self.assertEqual(self.data["probes"][str(run)],
                                 [i["word"] for i in probe.build(run)])

    def test_every_probe_word_is_resolvable_by_the_browser(self):
        known = {w["word"] for w in self.data["words"]} | {w["word"] for w in self.data["off_list"]}
        for run, words in self.data["probes"].items():
            for w in words:
                with self.subTest(run=run, word=w):
                    self.assertIn(w, known)

    def test_consecutive_runs_sample_differently(self):
        self.assertNotEqual(self.data["probes"]["0"], self.data["probes"]["1"])
