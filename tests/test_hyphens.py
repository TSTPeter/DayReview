"""
Hyphenated words, end to end.

Two weeks of the autumn 2026 school list are about nothing but hyphens:

    w/c 12/10   co-operate, co-ordinate, co-own, co-author, re-enter, ...
    w/c 19/10   man-eating, little-used, rock-bottom, wide-eyed, ...

Until these tests existed the app removed every hyphen it saw. The list parser
turned 'co-operate' into 'cooperate', and the marker removed the hyphen from her
answer too, so leaving it out was marked correct: on those two weeks the app
would have taught and accepted exactly the wrong spelling.
"""
import pathlib
import sys
import unittest
from datetime import date

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1] / "engine"))

import weekly  # noqa: E402
from classify import HEADLINES, classify  # noqa: E402
from derive import SCHOOL_PATTERNS, derive, make_entry, normalise, word_form  # noqa: E402


class TestWordForm(unittest.TestCase):
    def test_an_internal_hyphen_is_kept(self):
        self.assertEqual(word_form("co-operate"), "co-operate")
        self.assertEqual(word_form("Man-Eating"), "man-eating")

    def test_normalise_still_strips_it_for_the_aligner(self):
        self.assertEqual(normalise("co-operate"), "cooperate")

    def test_pasted_hyphens_become_plain_ones(self):
        self.assertEqual(word_form("co\u2010ordinate"), "co-ordinate")
        self.assertEqual(word_form("re\u2011elect"), "re-elect")

    def test_edges_and_doubles_are_tidied(self):
        self.assertEqual(word_form("-advice"), "advice")
        self.assertEqual(word_form("re--enter"), "re-enter")
        self.assertEqual(word_form("--"), "")

    def test_a_word_without_a_hyphen_is_unchanged(self):
        for w in ("necessary", "Rhythm", "don't"):
            self.assertEqual(word_form(w), normalise(w))


class TestDerivedHyphenPatterns(unittest.TestCase):
    def test_a_vowel_prefix_before_a_vowel(self):
        for w in ("co-operate", "co-ordinate", "co-own", "co-author", "re-enter",
                  "re-educate", "re-examine", "re-evaluate", "re-energise", "re-elect"):
            with self.subTest(word=w):
                self.assertEqual(derive(w)["patterns"][0], "hyphen-prefix")

    def test_two_words_made_into_one_describing_word(self):
        for w in ("man-eating", "little-used", "rock-bottom", "wide-eyed", "pig-headed",
                  "tight-fisted", "cold-hearted", "stone-faced", "green-eyed",
                  "short-tempered"):
            with self.subTest(word=w):
                self.assertEqual(derive(w)["patterns"][0], "hyphen-compound")

    def test_the_trap_is_the_pair_of_letters_at_the_join(self):
        self.assertIn("oo", derive("co-operate")["traps"])
        self.assertIn("ee", derive("re-enter")["traps"])

    def test_each_part_keeps_its_own_patterns(self):
        # 'little' has a double t whether or not it is joined to 'used'.
        self.assertIn("double-consonant", derive("little-used")["patterns"])

    def test_every_hyphen_pattern_has_a_rule_card(self):
        for w in ("co-operate", "man-eating"):
            for p in derive(w)["patterns"]:
                if p.startswith("hyphen"):
                    self.assertIn(p, SCHOOL_PATTERNS)

    def test_the_entry_is_stored_with_its_hyphen(self):
        self.assertEqual(make_entry("co-operate")["word"], "co-operate")


class TestParsing(unittest.TestCase):
    def test_the_real_lists_keep_their_hyphens(self):
        text = ("co-operate, co-ordinate, co-own, co-author, re-enter\n"
                "man-eating / little-used / rock-bottom")
        self.assertEqual(weekly.parse(text),
                         ["co-operate", "co-ordinate", "co-own", "co-author", "re-enter",
                          "man-eating", "little-used", "rock-bottom"])

    def test_a_bullet_is_not_a_hyphen(self):
        self.assertEqual(weekly.parse("- advice\n-  device"), ["advice", "device"])

    def test_an_en_dash_still_separates(self):
        self.assertEqual(weekly.parse("advice \u2013 device"), ["advice", "device"])

    def test_the_list_round_trips(self):
        lst = weekly.make_list("co-operate\nre-enter", date(2026, 10, 12))
        self.assertEqual(lst["words"], ["co-operate", "re-enter"])
        self.assertIsNone(weekly.hint_of(lst, "co-operate"))


class TestMarking(unittest.TestCase):
    def setUp(self):
        self.co = make_entry("co-operate")
        self.shark = make_entry("man-eating")

    def test_the_right_spelling_is_right(self):
        for a in ("co-operate", "Co-operate", "  co-operate ", "co\u2011operate"):
            with self.subTest(attempt=a):
                self.assertTrue(classify(a, self.co)["correct"])

    def test_leaving_the_hyphen_out_is_wrong_and_says_why(self):
        d = classify("cooperate", self.co)
        self.assertFalse(d["correct"])
        self.assertEqual(d["type"], "hyphen")
        self.assertIn("between co and operate", d["detail"])
        self.assertEqual(d["patterns"], ["hyphen-prefix"])
        self.assertIn("hyphen", HEADLINES)

    def test_a_hyphen_in_the_wrong_place(self):
        d = classify("coop-erate", self.co)
        self.assertEqual(d["type"], "hyphen")
        self.assertIn("wrong place", d["detail"])

    def test_a_space_is_not_a_hyphen(self):
        d = classify("man eating", self.shark)
        self.assertEqual(d["type"], "hyphen")
        self.assertIn("space", d["detail"])
        self.assertEqual(d["patterns"], ["hyphen-compound"])

    def test_the_vowel_lost_at_the_join_is_named(self):
        # What happens without the hyphen: the two vowels merge.
        for a in ("coperate", "co-perate"):
            with self.subTest(attempt=a):
                d = classify(a, self.co)
                self.assertEqual(d["type"], "omission")
                self.assertIn("where co meets operate", d["detail"])
                self.assertEqual(d["patterns"], ["hyphen-prefix"])
        self.assertIn("where re meets enter", classify("renter", make_entry("re-enter"))["detail"])

    def test_a_stray_hyphen_in_an_ordinary_word_still_scores_zero(self):
        d = classify("observ-ant", make_entry("observant"))
        self.assertFalse(d["correct"])
        self.assertEqual(d["type"], "mark-scheme")


if __name__ == "__main__":
    unittest.main()
