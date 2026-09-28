"""
The games' content, held to the rules it claims to follow.

Nothing here tests the games' interaction: tests/browser/run.mjs does that. This
tests that what the games SAY is well-formed: every piece joins back into its
word, no clue gives its answer away, every sort card has exactly one right bin,
and the authored entries carry what the reveal needs.
"""
import json
import pathlib
import re
import sys
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "engine"))

import games  # noqa: E402
import sentences  # noqa: E402
import term  # noqa: E402
from derive import NOUN_VERB_PAIRS, normalise  # noqa: E402
from words import WORDS  # noqa: E402

CURATED = {w["word"]: w for w in WORDS}
SHIPPED = json.loads((ROOT / "web" / "data" / "games.json").read_text())
TERM = json.loads((ROOT / "web" / "data" / "term.json").read_text())


class TestTheShippedFiles(unittest.TestCase):
    def test_games_json_is_current(self):
        import probe
        curated = {w["word"]: w for w in list(WORDS) + list(probe.OFF_LIST)}
        built = games.build(term.weeks(), curated, sentences.SENTENCES, list(NOUN_VERB_PAIRS))
        self.assertEqual(SHIPPED, json.loads(json.dumps(built)),
                         "web/data/games.json is stale. Run: python3 engine/export.py")

    def test_no_dash_the_site_would_refuse(self):
        # tools/deploy_to_site.py refuses em and en dashes in anything it copies.
        for name in ("games.json", "term.json"):
            text = (ROOT / "web" / "data" / name).read_text()
            with self.subTest(file=name):
                self.assertNotRegex(text, "[\u2013\u2014]")


class TestEveryWord(unittest.TestCase):
    def test_every_term_word_has_content(self):
        self.assertEqual(sorted(SHIPPED["words"]), sorted(term.words()))

    def test_the_pieces_join_back_into_the_word(self):
        for w, c in SHIPPED["words"].items():
            with self.subTest(word=w):
                self.assertEqual("".join(p["text"] for p in c["parts"]), w)

    def test_a_hyphen_is_a_piece_of_its_own(self):
        for w, c in SHIPPED["words"].items():
            hyphens = [p for p in c["parts"] if p["kind"] == "hyphen"]
            with self.subTest(word=w):
                self.assertEqual(len(hyphens), w.count("-"))
                self.assertTrue(all(p["text"] == "-" for p in hyphens))

    def test_a_decoy_is_a_real_alternative_not_the_answer(self):
        for w, c in SHIPPED["words"].items():
            for d in c["decoys"]:
                with self.subTest(word=w, decoy=d["text"]):
                    self.assertNotEqual(d["text"], c["parts"][-1]["text"])
                    self.assertNotIn(d["text"], [p["text"] for p in c["parts"]])

    def test_the_ant_and_ent_words_offer_the_other_ending(self):
        self.assertEqual([d["text"] for d in SHIPPED["words"]["observant"]["decoys"]], ["ent"])
        self.assertEqual([d["text"] for d in SHIPPED["words"]["innocence"]["decoys"]], ["ance"])

    def test_no_meaning_gives_its_word_away(self):
        # The meaning is the clue in the jigsaw and the game show. If it contains
        # the word, or a long piece of it, it has handed over the spelling.
        for w, c in SHIPPED["words"].items():
            text = c["meaning"].lower()
            with self.subTest(word=w):
                self.assertTrue(c["meaning"].strip())
                self.assertNotIn(normalise(w), normalise(text))
                for p in c["parts"]:
                    if len(p["text"]) >= 5:
                        self.assertNotRegex(text, rf"\b{re.escape(p['text'])}")

    def test_no_two_words_share_a_meaning(self):
        # The game-show clue is the meaning: two words with one meaning make a clue
        # with two right answers, one of which would be marked wrong.
        meanings = [c["meaning"] for c in SHIPPED["words"].values()]
        self.assertEqual(len(set(meanings)), len(meanings))

    def test_every_word_has_an_origin_and_a_why(self):
        for w, c in SHIPPED["words"].items():
            with self.subTest(word=w):
                self.assertTrue(c["why"])
                self.assertTrue(c["origin"]["lang"] and c["origin"]["gloss"])


class TestAuthoredEntries(unittest.TestCase):
    def test_exactly_the_uncurated_words_are_authored(self):
        uncurated = {w for w in term.words() if w not in CURATED}
        self.assertEqual({e["word"] for e in TERM["entries"]}, uncurated)

    def test_morphemes_rejoin_to_the_letters(self):
        for e in TERM["entries"]:
            with self.subTest(word=e["word"]):
                self.assertEqual(e["morph"].replace("+", ""), normalise(e["word"]))

    def test_every_field_the_reveal_shows_is_there(self):
        for e in TERM["entries"]:
            with self.subTest(word=e["word"]):
                for field in ("lang", "root", "gloss", "why", "morph"):
                    self.assertTrue(e[field], field)
                self.assertTrue(e["family"])
                self.assertNotIn(e["word"], e["family"])
                self.assertTrue(e["patterns"], "patterns come from derive")
                self.assertTrue(e["derived"] and e["authored"])
                self.assertFalse(e["on_list"])

    def test_nothing_authored_duplicates_a_curated_word(self):
        self.assertFalse(set(games.ENTRIES) & set(CURATED))
        self.assertFalse(set(games.MEANINGS) - set(CURATED))


class TestRootMatch(unittest.TestCase):
    def test_every_week_has_enough_pairs_for_a_round(self):
        for week in term.weeks():
            with self.subTest(week=week["id"]):
                self.assertGreaterEqual(len(SHIPPED["weeks"][week["id"]]["roots"]), 5)

    def test_every_pair_teaches_words_on_its_own_list(self):
        for week in term.weeks():
            for pair in SHIPPED["weeks"][week["id"]]["roots"]:
                with self.subTest(week=week["id"], part=pair["part"]):
                    self.assertTrue(set(pair["words"]) <= set(week["words"]))

    def test_no_two_parts_or_meanings_can_be_confused(self):
        # A round with two identical meanings has two right answers and marks one wrong.
        for week in term.weeks():
            roots = SHIPPED["weeks"][week["id"]]["roots"]
            with self.subTest(week=week["id"]):
                self.assertEqual(len({r["part"] for r in roots}), len(roots))
                self.assertEqual(len({r["means"] for r in roots}), len(roots))


class TestPatternSort(unittest.TestCase):
    SEP = {"a": "a", "e": "e", "c": "c", "s": "s", "hyphen": "-", "none": "", "space": " "}

    def decks(self):
        return {k: v["sort"] for k, v in SHIPPED["weeks"].items() if v["sort"]}

    def test_every_week_with_a_binary_rule_has_a_deck(self):
        self.assertEqual(sorted(self.decks()), ["week-2026-09-21", "week-2026-09-28",
                                                "week-2026-10-05", "week-2026-10-12",
                                                "week-2026-10-19"])

    def test_each_card_completes_to_exactly_what_it_says(self):
        for week, deck in self.decks().items():
            keys = {b["key"] for b in deck["bins"]}
            for card in deck["cards"]:
                with self.subTest(week=week, card=card["full"]):
                    self.assertIn(card["answer"], keys)
                    self.assertEqual(card["show"][0] + self.SEP[card["answer"]] + card["show"][1],
                                     card["full"])
                    self.assertTrue(card["explain"])

    def test_both_bins_are_used(self):
        # A deck where every card goes in one bin has nothing to decide.
        for week, deck in self.decks().items():
            with self.subTest(week=week):
                self.assertEqual({c["answer"] for c in deck["cards"]},
                                 {b["key"] for b in deck["bins"]})

    def test_a_card_that_teaches_a_word_names_a_real_list_word(self):
        words = set(term.words())
        for deck in self.decks().values():
            for card in deck["cards"]:
                if card["word"]:
                    self.assertIn(card["word"], words)

    def test_the_noun_verb_cards_blank_the_c_or_the_s(self):
        deck = self.decks()["week-2026-09-21"]
        self.assertEqual(len(deck["cards"]), 10)
        for card in deck["cards"]:
            self.assertEqual(card["answer"], "c" if NOUN_VERB_PAIRS[card["word"]] == "noun" else "s")


if __name__ == "__main__":
    unittest.main()
