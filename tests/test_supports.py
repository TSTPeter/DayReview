"""
The supports shown after a miss, held to what engine/supports.py says about them.

The word-for-word check against the books needs the network, so it lives in
tools/find_quotes.py verify. This checks everything that can be checked offline.
"""
import json
import pathlib
import re
import sys
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "engine"))
sys.path.insert(0, str(ROOT / "tools"))

import games  # noqa: E402
import supports  # noqa: E402
from words import WORDS  # noqa: E402

SHIPPED = json.loads((ROOT / "web" / "data" / "supports.json").read_text())
CURATED = {w["word"] for w in WORDS}
OFF_LIST = set(SHIPPED["excluded"])


def once(word, text):
    pat = re.compile(r"(?<![A-Za-z-])" + re.escape(word) + r"(?![A-Za-z-])", re.I)
    return len(pat.findall(text)) == 1


class TestContent(unittest.TestCase):
    def test_every_experiment_word_has_all_three(self):
        expected = (CURATED | set(games.ENTRIES)) - OFF_LIST
        self.assertEqual(set(SHIPPED["words"]), expected)
        self.assertEqual(len(expected), 155)
        for word, s in SHIPPED["words"].items():
            with self.subTest(word=word):
                self.assertTrue(s["etymology"] and s["etymology"]["text"])
                self.assertTrue(s["story"] and s["story"]["text"])
                self.assertTrue(s["say"]["chunks"])

    def test_off_list_words_stay_untaught(self):
        # They measure transfer (docs/04): a support would teach them.
        self.assertTrue(OFF_LIST)
        self.assertFalse(OFF_LIST & set(SHIPPED["words"]))

    def test_each_story_uses_its_word_exactly_once(self):
        for word, (ebook, text) in supports.QUOTES.items():
            with self.subTest(word=word):
                self.assertTrue(once(word, text), text)
                self.assertIn(ebook, supports.BOOKS)
        for word, text in supports.WRITTEN.items():
            with self.subTest(word=word):
                self.assertTrue(once(word, text), text)

    def test_quotation_or_written_never_both(self):
        self.assertFalse(set(supports.QUOTES) & set(supports.WRITTEN))

    def test_a_cut_is_marked_and_only_at_the_end(self):
        for word, (_, text) in supports.QUOTES.items():
            with self.subTest(word=word):
                self.assertNotIn("...", text[:-3])

    def test_nothing_the_site_would_refuse(self):
        # ProductionSite bans em and en dashes in every served file.
        raw = (ROOT / "web" / "data" / "supports.json").read_text(encoding="utf-8")
        self.assertIsNone(re.search("[\u2013\u2014]", raw))

    def test_a_written_use_says_it_was_written(self):
        for word, s in SHIPPED["words"].items():
            with self.subTest(word=word):
                if s["story"]["kind"] == "written":
                    self.assertEqual(s["story"]["source"], "Written for you")
                else:
                    self.assertRegex(s["story"]["source"], r", \d{4}$")

    def test_say_pieces_join_back_into_the_word(self):
        for word, s in SHIPPED["words"].items():
            with self.subTest(word=word):
                joined = "".join("-" if c == "hyphen" else c for c in s["say"]["chunks"])
                self.assertEqual(joined, word)
                for i in s["say"]["stress"]:
                    self.assertLess(i, len(s["say"]["chunks"]))

    def test_a_hyphen_is_the_piece_to_lean_on(self):
        for word, s in SHIPPED["words"].items():
            if "-" in word:
                with self.subTest(word=word):
                    chunks = s["say"]["chunks"]
                    self.assertEqual(s["say"]["stress"], [chunks.index("hyphen")])


class TestTheGate(unittest.TestCase):
    def test_the_file_is_current(self):
        content = json.loads((ROOT / "web" / "data" / "games.json").read_text())
        built = supports.build(
            [w for w in WORDS],
            games.term_entries(),
            {w: c["parts"] for w, c in content["words"].items()},
            OFF_LIST)
        self.assertEqual(built, SHIPPED, "web/data/supports.json is stale. Run: python3 engine/export.py")

    def test_the_review_flag_is_exported(self):
        self.assertIs(SHIPPED["reviewed"], supports.REVIEWED)
        self.assertEqual(SHIPPED["arms"], ["etymology", "story", "say", "blend"])

    def test_the_review_sheet_is_current(self):
        import support_sheet
        sheet = (ROOT / "experiments" / "2026-10-support-types-content.md").read_text()
        self.assertEqual(sheet, support_sheet.sheet(), "Run: python3 tools/support_sheet.py")


if __name__ == "__main__":
    unittest.main()
