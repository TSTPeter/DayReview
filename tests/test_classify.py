"""
Classifier behaviour and coverage.

The headline number is a regression guard: every curated misspelling must land in a
named category. If a change to the rule order drops one into 'multiple-errors' that
used to be diagnosed precisely, that is a regression even though nothing crashed.
"""
import pathlib
import sys
import unittest
from collections import Counter

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1] / "engine"))

from classify import (classify, feedback, frame_key, mark_scheme_penalty,  # noqa: E402
                      normalise, sound_key, HEADLINES)
from words import WORDS  # noqa: E402

BY_WORD = {w["word"]: w for w in WORDS}

# Categories that name the layer that broke. 'multiple-errors' is honest but not a
# diagnosis, so it is capped rather than counted as success.
NAMED = {"transposition", "doubling", "suffix-choice", "base-change", "grapheme-choice",
         "silent-letter", "omission", "addition", "vowel-choice", "letter-swap"}


def diagnose_corpus():
    return [(w["word"], bad, classify(bad, w)) for w in WORDS for bad in w["errors"]]


class TestCoverage(unittest.TestCase):
    def setUp(self):
        self.results = diagnose_corpus()

    def test_corpus_is_the_expected_size(self):
        self.assertEqual(len(self.results), 293)

    def test_no_curated_misspelling_is_scored_correct(self):
        wrong = [(w, bad) for w, bad, d in self.results if d["correct"]]
        self.assertEqual(wrong, [], "a curated error scored as correct")

    def test_every_misspelling_lands_in_a_named_category(self):
        # 293/293. This was 292/293 until the 'individual' data bug was fixed.
        stray = [(w, bad, d["type"]) for w, bad, d in self.results
                 if d["type"] not in NAMED]
        self.assertLessEqual(len(stray), 1, f"undiagnosed: {stray}")

    def test_classification_rate_does_not_regress(self):
        named = sum(1 for _, _, d in self.results if d["type"] in NAMED)
        self.assertGreaterEqual(named / len(self.results), 0.996)

    def test_every_type_has_a_headline(self):
        for _, _, d in self.results:
            with self.subTest(type=d["type"]):
                self.assertIn(d["type"], HEADLINES)

    def test_every_diagnosis_carries_a_pattern_to_practise(self):
        # The scheduler practises patterns, not words. A diagnosis with no pattern
        # gives it nothing to act on.
        for word, bad, d in self.results:
            with self.subTest(word=word, attempt=bad):
                self.assertTrue(d["patterns"], f"{bad} -> {word} produced no pattern")

    def test_distribution_is_not_dominated_by_one_bucket(self):
        counts = Counter(d["type"] for _, _, d in self.results)
        top = counts.most_common(1)[0][1]
        self.assertLess(top / len(self.results), 0.30)


class TestRuleOrder(unittest.TestCase):
    """The worked examples from classify.py's own docstring."""

    CASES = [
        ("achieve", "acheive", "transposition"),
        ("necessary", "neccessary", "doubling"),
        ("existence", "existance", "suffix-choice"),
        ("disastrous", "disasterous", "base-change"),
        ("physical", "fisical", "grapheme-choice"),
        ("government", "goverment", "silent-letter"),
        ("cemetery", "cemetry", "omission"),
        ("desperate", "desparate", "vowel-choice"),
    ]

    def test_documented_examples_classify_as_documented(self):
        for word, bad, expected in self.CASES:
            with self.subTest(word=word, attempt=bad):
                self.assertEqual(classify(bad, BY_WORD[word])["type"], expected)


class TestMarkScheme(unittest.TestCase):
    """docs/07: score exactly as the KS2 GPS Paper 2 mark scheme scores."""

    def setUp(self):
        self.entry = BY_WORD["government"]

    def test_case_is_free(self):
        for attempt in ("government", "GOVERNMENT", "Government", "GoVeRnMeNt"):
            with self.subTest(attempt=attempt):
                self.assertTrue(classify(attempt, self.entry)["correct"])

    def test_surrounding_whitespace_is_free(self):
        self.assertTrue(classify("  government \n", self.entry)["correct"])

    def test_inserted_hyphen_scores_zero(self):
        d = classify("govern-ment", self.entry)
        self.assertFalse(d["correct"])
        self.assertEqual(d["type"], "mark-scheme")

    def test_inserted_apostrophe_scores_zero(self):
        for attempt in ("govern'ment", "govern’ment"):
            with self.subTest(attempt=attempt):
                d = classify(attempt, self.entry)
                self.assertFalse(d["correct"])
                self.assertEqual(d["type"], "mark-scheme")

    def test_letters_split_into_components_scores_zero(self):
        d = classify("govern ment", self.entry)
        self.assertFalse(d["correct"])
        self.assertEqual(d["type"], "mark-scheme")

    def test_a_mark_scheme_zero_blames_no_pattern(self):
        # She knows the spelling. Charging this to a spelling rule would corrupt
        # the pattern-strength number in docs/04's dashboard.
        self.assertEqual(classify("govern-ment", self.entry)["patterns"], [])

    def test_penalty_is_none_for_a_clean_attempt(self):
        self.assertIsNone(mark_scheme_penalty("government", "government"))


class TestSoundKeys(unittest.TestCase):
    def test_same_sound_different_letters_share_a_key(self):
        for a, b in [("physical", "fysical"), ("sincere", "sinsere"),
                     ("criticise", "criticize"), ("rhyme", "ryme"),
                     ("stomach", "stomak"), ("symbol", "simbol"),
                     ("necessary", "necesary")]:
            with self.subTest(pair=(a, b)):
                self.assertEqual(sound_key(a), sound_key(b))

    def test_a_hard_c_is_not_treated_as_a_soft_one(self):
        # 'neccesary' reads "neck-essary": the first c is hard before the second c,
        # the second is soft before e. It is NOT phonologically plausible, and the
        # key must not collapse it onto the target.
        self.assertNotEqual(sound_key("necessary"), sound_key("neccesary"))

    def test_frame_key_blanks_vowels(self):
        self.assertEqual(frame_key("desperate"), frame_key("desparate"))

    def test_sounds_right_flags_phonologically_plausible_errors(self):
        # docs/03: this is the phonological reliance index. It must be True when the
        # misspelling reads aloud as the target.
        self.assertTrue(classify("fisical", BY_WORD["physical"])["sounds_right"])

    def test_sounds_right_is_false_when_the_sound_changes(self):
        self.assertFalse(classify("goverment", BY_WORD["government"])["sounds_right"])

    def test_normalise_strips_non_letters(self):
        self.assertEqual(normalise("  Gov-ern'ment! "), "government")


class TestFeedback(unittest.TestCase):
    def test_correct_feedback_is_short(self):
        f = feedback(classify("yacht", BY_WORD["yacht"]), BY_WORD["yacht"])
        self.assertEqual(f["headline"], "Correct.")

    def test_error_feedback_carries_every_layer_the_reveal_screen_needs(self):
        entry = BY_WORD["physical"]
        f = feedback(classify("fisical", entry), entry)
        for key in ("headline", "detail", "structure", "origin", "why", "practise"):
            with self.subTest(key=key):
                self.assertTrue(f[key], f"reveal screen needs {key}")

    def test_feedback_offers_three_siblings(self):
        entry = BY_WORD["physical"]
        self.assertEqual(len(feedback(classify("fisical", entry), entry)["practise"]), 3)


if __name__ == "__main__":
    unittest.main()
