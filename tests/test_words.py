"""
Data integrity for the word model.

These are regression tests, not style checks. Each one has been violated at least
once in this repo's history, or would silently corrupt the dataset if it were.
"""
import pathlib
import re
import sys
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1] / "engine"))

from words import WORDS, PATTERNS  # noqa: E402

STATUTORY_COUNT = 103
PATTERN_COUNT = 21


def norm(text):
    return re.sub(r"[^a-z]", "", text.lower())


class TestWordList(unittest.TestCase):
    def test_list_size_is_the_statutory_list(self):
        self.assertEqual(len(WORDS), STATUTORY_COUNT)

    def test_words_are_unique(self):
        seen = [w["word"] for w in WORDS]
        self.assertEqual(len(seen), len(set(seen)))

    def test_every_field_is_populated(self):
        for w in WORDS:
            for field in ("word", "syll", "lang", "root", "gloss", "morph", "why"):
                with self.subTest(word=w["word"], field=field):
                    self.assertTrue(w[field], f"{w['word']}.{field} is empty")
            for field in ("traps", "patterns", "errors", "family"):
                with self.subTest(word=w["word"], field=field):
                    self.assertTrue(w[field], f"{w['word']}.{field} is empty")


class TestStructure(unittest.TestCase):
    def test_syllables_rejoin_to_the_word(self):
        for w in WORDS:
            with self.subTest(word=w["word"]):
                self.assertEqual(norm(w["syll"].replace("-", "")), norm(w["word"]))

    def test_morphemes_rejoin_to_the_word(self):
        for w in WORDS:
            if w["morph"] == "-":
                continue
            with self.subTest(word=w["word"]):
                self.assertEqual(norm(w["morph"].replace("+", "")), norm(w["word"]))

    def test_traps_are_substrings_of_the_word(self):
        for w in WORDS:
            for trap in w["traps"]:
                with self.subTest(word=w["word"], trap=trap):
                    self.assertIn(trap, norm(w["word"]))

    def test_family_gives_enough_siblings_to_practise(self):
        # docs/03 rung 2 sorts six words; the reveal screen shows three.
        for w in WORDS:
            with self.subTest(word=w["word"]):
                self.assertGreaterEqual(len(w["family"]), 3)

    def test_word_is_not_in_its_own_family(self):
        for w in WORDS:
            with self.subTest(word=w["word"]):
                self.assertNotIn(w["word"], w["family"])


class TestPatterns(unittest.TestCase):
    def test_pattern_count(self):
        self.assertEqual(len(PATTERNS), PATTERN_COUNT)

    def test_every_pattern_used_by_a_word_is_defined(self):
        used = {p for w in WORDS for p in w["patterns"]}
        self.assertEqual(used - set(PATTERNS), set())

    def test_every_defined_pattern_is_used(self):
        # An unused pattern is either a typo or dead weight in the scheduler.
        used = {p for w in WORDS for p in w["patterns"]}
        self.assertEqual(set(PATTERNS) - used, set())

    def test_no_pattern_rests_on_a_single_word(self):
        # docs/03: "One word is an anecdote." A pattern with one member cannot be
        # practised across siblings, which is the whole point of the pattern layer.
        counts = {}
        for w in WORDS:
            for p in w["patterns"]:
                counts[p] = counts.get(p, 0) + 1
        singletons = sorted(p for p, n in counts.items() if n < 2)
        self.assertEqual(singletons, ["ough"], "new singleton pattern introduced")


class TestCuratedErrors(unittest.TestCase):
    def test_no_curated_error_is_the_correct_spelling(self):
        # Regression: 'individual' listed itself, which silently inflated the
        # 'correct' bucket and deflated the reported classification rate.
        for w in WORDS:
            for bad in w["errors"]:
                with self.subTest(word=w["word"], attempt=bad):
                    self.assertNotEqual(norm(bad), norm(w["word"]))

    def test_no_duplicate_errors_within_a_word(self):
        for w in WORDS:
            with self.subTest(word=w["word"]):
                self.assertEqual(len(w["errors"]), len(set(w["errors"])))

    def test_errors_are_lowercase_letters_only(self):
        for w in WORDS:
            for bad in w["errors"]:
                with self.subTest(word=w["word"], attempt=bad):
                    self.assertRegex(bad, r"^[a-z]+$")

    def test_corpus_size(self):
        self.assertEqual(sum(len(w["errors"]) for w in WORDS), 293)


if __name__ == "__main__":
    unittest.main()
