"""
Deriving spelling patterns from a bare word.

The headline tests are MEASUREMENTS against the 103 hand-curated statutory
words, not assertions that the code does what it says. Curation is the only
ground truth available, so the deriver is scored against it and the scores are
pinned as floors. If a future rule change trades precision for recall, or the
other way, these fail and say by how much.
"""
import pathlib
import sys
import re
import unittest
from collections import defaultdict

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1] / "engine"))

import probe  # noqa: E402
import sentences  # noqa: E402
from derive import (NOUN_VERB_PAIRS, derive, hint_for,  # noqa: E402
                    make_entry, normalise, SPECIFICITY)
from words import PATTERNS, WORDS  # noqa: E402

# Patterns that are knowledge about a word rather than properties of its
# letters, so derivation cannot be scored on them. See engine/derive.py for
# why schwa in particular is in this list.
NOT_DERIVABLE = {"single-consonant", "base-change", "unique",
                 "schwa", "soft-c-g", "ou-spelling"}


def score():
    tp = fp = fn = 0
    for w in WORDS:
        curated = set(w["patterns"])
        got = set(derive(w["word"], limit=99)["patterns"]) - {"unique"}
        for p in got:
            if p in curated:
                tp += 1
            else:
                fp += 1
        fn += len(curated - NOT_DERIVABLE - got)
    return tp, fp, fn


class TestAgainstCuratedWords(unittest.TestCase):
    """Scored against the only ground truth there is."""

    def test_precision_floor(self):
        # 78% when written. A claim that is wrong sends her to the wrong rule
        # card and corrupts pattern strength, so this is the number that must
        # not slip.
        tp, fp, _ = score()
        precision = tp / (tp + fp)
        self.assertGreaterEqual(precision, 0.75, f"precision fell to {precision:.0%}")

    def test_recall_floor(self):
        # 77% when written.
        tp, _, fn = score()
        recall = tp / (tp + fn)
        self.assertGreaterEqual(recall, 0.72, f"recall fell to {recall:.0%}")

    def test_most_words_get_at_least_one_right_pattern(self):
        # 84% when written. A word with no correct pattern still gets marked
        # and diagnosed; it just teaches less.
        ok = 0
        for w in WORDS:
            derivable = set(w["patterns"]) - NOT_DERIVABLE
            got = set(derive(w["word"], limit=99)["patterns"])
            if not derivable or (derivable & got):
                ok += 1
        self.assertGreaterEqual(ok / len(WORDS), 0.80)

    def test_every_derived_pattern_is_a_real_pattern(self):
        # A pattern the rest of the engine does not know is worse than none:
        # the rule card would be blank and the scheduler would bucket on a key
        # nothing else uses.
        for w in WORDS:
            for p in derive(w["word"])["patterns"]:
                with self.subTest(word=w["word"], pattern=p):
                    self.assertIn(p, PATTERNS)


class TestRules(unittest.TestCase):
    def test_doubling(self):
        self.assertIn("double-consonant", derive("necessary")["patterns"])
        self.assertIn("ss", derive("necessary")["traps"])

    def test_assimilated_prefix_beats_plain_doubling(self):
        p = derive("accommodate")["patterns"]
        self.assertIn("assimilated-prefix", p)
        self.assertLess(p.index("assimilated-prefix"), p.index("double-consonant"))

    def test_one_one_one_doubling(self):
        self.assertIn("doubling-1-1-1", derive("occurred")["patterns"])

    def test_suffix_families(self):
        for word, pattern in [("existence", "suffix-ance-ence"),
                              ("dictionary", "suffix-ary-ery"),
                              ("available", "suffix-able-ible"),
                              ("relevant", "suffix-ant-ent")]:
            with self.subTest(word=word):
                self.assertIn(pattern, derive(word)["patterns"])

    def test_greek_markers(self):
        for word in ("physical", "rhythm", "psychology"):
            with self.subTest(word=word):
                self.assertIn("greek-marker", derive(word)["patterns"])

    def test_silent_letters(self):
        for word in ("knowledge", "wrestle", "column", "wednesday"):
            with self.subTest(word=word):
                self.assertIn("silent-letter", derive(word)["patterns"])

    def test_homophones_are_flagged(self):
        self.assertIn("homophone-trap", derive("stationery")["patterns"])
        self.assertNotIn("homophone-trap", derive("rhythm")["patterns"])

    def test_inflections_are_not_mistaken_for_the_i_before_e_rule(self):
        # 'carried' and 'happiest' are the plural and comparative rules wearing
        # the same letters.
        for word in ("carried", "happiest", "cities", "earlier"):
            with self.subTest(word=word):
                self.assertNotIn("ie-ei", derive(word)["patterns"])
        self.assertIn("ie-ei", derive("achieve")["patterns"])

    def test_schwa_is_never_claimed(self):
        # Documented limitation, asserted so it cannot creep back in without a
        # deliberate decision. See engine/derive.py.
        for w in WORDS:
            with self.subTest(word=w["word"]):
                self.assertNotIn("schwa", derive(w["word"], limit=99)["patterns"])

    def test_patterns_are_capped(self):
        for w in WORDS:
            with self.subTest(word=w["word"]):
                self.assertLessEqual(len(derive(w["word"])["patterns"]), 3)

    def test_patterns_come_back_ranked(self):
        rank = {p: i for i, p in enumerate(SPECIFICITY)}
        for w in WORDS:
            got = derive(w["word"])["patterns"]
            with self.subTest(word=w["word"]):
                self.assertEqual(got, sorted(got, key=lambda p: rank.get(p, 99)))

    def test_nothing_found_still_yields_a_pattern(self):
        self.assertEqual(derive("cat")["patterns"], ["unique"])

    def test_empty_input_is_safe(self):
        self.assertEqual(derive("")["patterns"], [])


class TestMakeEntry(unittest.TestCase):
    def setUp(self):
        self.e = make_entry("Wednesday")

    def test_word_is_normalised(self):
        self.assertEqual(self.e["word"], "wednesday")

    def test_marked_as_derived_and_off_list(self):
        self.assertTrue(self.e["derived"])
        self.assertFalse(self.e["on_list"])

    def test_curated_fields_are_empty_not_invented(self):
        # A guessed etymology told to a child is worse than a missing one.
        for field in ("lang", "root", "gloss", "why", "syll"):
            with self.subTest(field=field):
                self.assertEqual(self.e[field], "")
        self.assertEqual(self.e["family"], [])
        self.assertEqual(self.e["morph"], "-")

    def test_carries_what_the_classifier_needs(self):
        self.assertTrue(self.e["patterns"])
        self.assertIsInstance(self.e["traps"], list)

    def test_the_classifier_accepts_a_derived_entry(self):
        from classify import classify
        d = classify("wensday", self.e)
        self.assertFalse(d["correct"])
        self.assertTrue(d["type"])

    def test_normalise_strips_punctuation_and_case(self):
        self.assertEqual(normalise("  Don't!  "), "dont")


class TestNounVerbPairs(unittest.TestCase):
    """
    The -ce/-se pairs are the one case where a correct word model is not enough
    to ask the question. 'The word is licence' and 'The word is license' are the
    same sound, so the prompt has to carry the word class as well, and the
    sentence has to rule the partner out on grammar rather than on likelihood.
    """

    PARTNER = {"advice": "advise", "advise": "advice",
               "device": "devise", "devise": "device",
               "licence": "license", "license": "licence",
               "practice": "practise", "practise": "practice",
               "prophecy": "prophesy", "prophesy": "prophecy"}

    def test_the_table_is_closed_and_paired(self):
        self.assertEqual(set(NOUN_VERB_PAIRS), set(self.PARTNER))
        for word, partner in self.PARTNER.items():
            self.assertNotEqual(NOUN_VERB_PAIRS[word], NOUN_VERB_PAIRS[partner],
                                f"{word} and {partner} cannot both be the same class")

    def test_the_noun_takes_c_and_the_verb_takes_s(self):
        # The rule the app teaches, asserted against the words themselves. If
        # this ever fails, derive.PAIR_RULE is telling a child something false.
        # 'prophecy'/'prophesy' end -cy/-sy rather than -ce/-se, so the test is
        # on the consonant, which is the part the rule is actually about.
        for word, kind in NOUN_VERB_PAIRS.items():
            with self.subTest(word=word):
                self.assertEqual(word[-2], "c" if kind == "noun" else "s")

    def test_hint_for_is_case_and_punctuation_proof(self):
        self.assertEqual(hint_for("  Practise!  "), "verb")
        self.assertIsNone(hint_for("rhythm"))
        self.assertIsNone(hint_for(""))

    def test_they_are_flagged_as_a_homophone_trap(self):
        for word in NOUN_VERB_PAIRS:
            with self.subTest(word=word):
                self.assertIn("homophone-trap", derive(word)["patterns"])

    def test_every_pair_word_has_a_sentence(self):
        missing = sentences.missing(list(NOUN_VERB_PAIRS))
        self.assertEqual(missing, [], "a pair word with no sentence is undictatable")

    def test_the_sentence_contains_the_word(self):
        # The cloze fallback blanks the target out of its sentence. A sentence
        # that does not contain the word leaves a gap with no gap in it.
        for word in NOUN_VERB_PAIRS:
            with self.subTest(word=word):
                self.assertRegex(sentences.SENTENCES[word], rf"\b{word}\b")

    def test_the_sentence_never_contains_the_partner(self):
        for word, partner in self.PARTNER.items():
            with self.subTest(word=word):
                self.assertNotRegex(sentences.SENTENCES[word], rf"\b{partner}\b")

    def test_the_grammar_rules_the_partner_out(self):
        # A determiner or adjective in front of the noun, an auxiliary or
        # 'to' in front of the verb. Checked here because 'unlikely' is not
        # good enough: swapping the pair member in must be UNGRAMMATICAL.
        before = {}
        for word in NOUN_VERB_PAIRS:
            m = re.search(rf"(\w+)\s+{word}\b", sentences.SENTENCES[word])
            before[word] = m.group(1).lower() if m else ""
        nouny = {"some", "the", "his", "her", "my", "their", "old", "small",
                 "good", "new", "netball", "football"}
        verby = {"would", "should", "could", "will", "can", "must", "to", "may"}
        for word, kind in NOUN_VERB_PAIRS.items():
            with self.subTest(word=word, kind=kind):
                self.assertIn(before[word], nouny if kind == "noun" else verby,
                              f"{word!r} is preceded by {before[word]!r}, which does "
                              f"not force it to be the {kind}")


class TestEveryWordCanBeDictated(unittest.TestCase):
    """engine/export.py refuses to build without these; assert it here too."""

    def test_no_curated_word_is_missing_a_sentence(self):
        words = [w["word"] for w in WORDS] + [w["word"] for w in probe.OFF_LIST]
        self.assertEqual(sentences.missing(words), [])


if __name__ == "__main__":
    unittest.main()
