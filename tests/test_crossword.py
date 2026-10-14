"""
The mini crosswords, held to the rules engine/crossword.py claims.

Every puzzle that ships is checked here, from the exported file, and the checker itself is
held to catching what it should, so a puzzle that quietly breaks a rule cannot pass.
tests/browser/run.mjs plays them.
"""
import copy
import json
import pathlib
import sys
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "engine"))

import crossword as cw  # noqa: E402
import term  # noqa: E402

SHIPPED = json.loads((ROOT / "web" / "data" / "games.json").read_text())
WEEKS = term.weeks()


def shipped():
    for week in WEEKS:
        for n, puzzle in enumerate(SHIPPED["weeks"][week["id"]]["crosswords"]):
            yield week, n, puzzle


def term_so_far(week):
    """Every word set up to and including this week."""
    out = []
    for w in WEEKS:
        out += w["words"]
        if w["id"] == week["id"]:
            break
    return set(out)


class TestEveryShippedPuzzle(unittest.TestCase):
    def test_every_week_has_its_puzzles(self):
        for week in WEEKS:
            with self.subTest(week=week["id"]):
                self.assertEqual(len(SHIPPED["weeks"][week["id"]]["crosswords"]), cw.PUZZLES_PER_WEEK)

    def test_each_is_sound(self):
        for week, n, puzzle in shipped():
            with self.subTest(week=week["id"], puzzle=n + 1):
                self.assertEqual(cw.problems(puzzle), [])

    def test_every_answer_is_a_plain_word_set_by_that_week(self):
        for week, n, puzzle in shipped():
            so_far = term_so_far(week)
            for entry in puzzle["entries"]:
                with self.subTest(week=week["id"], puzzle=n + 1, word=entry["word"]):
                    self.assertIn(entry["word"], so_far)
                    self.assertTrue(entry["word"].isalpha(), "a hyphen cannot sit in a cell")

    def test_a_clue_is_the_words_meaning_and_never_gives_it_away(self):
        for week, n, puzzle in shipped():
            for entry in puzzle["entries"]:
                with self.subTest(week=week["id"], puzzle=n + 1, word=entry["word"]):
                    self.assertEqual(entry["clue"], SHIPPED["words"][entry["word"]]["meaning"])
                    self.assertNotIn(entry["word"], entry["clue"].lower())

    def test_no_word_is_an_answer_twice_in_a_puzzle(self):
        for week, n, puzzle in shipped():
            words = [e["word"] for e in puzzle["entries"]]
            with self.subTest(week=week["id"], puzzle=n + 1):
                self.assertEqual(len(words), len(set(words)))

    def test_this_weeks_words_all_get_a_puzzle_and_come_first(self):
        for week in WEEKS:
            now = [w for w in dict.fromkeys(week["words"]) if w.isalpha()]
            puzzles = SHIPPED["weeks"][week["id"]]["crosswords"]
            with self.subTest(week=week["id"]):
                appear = {e["word"] for p in puzzles for e in p["entries"]}
                self.assertEqual(set(now) - appear, set(), "a word of this week is in no puzzle")
                for p in puzzles:
                    here = sum(e["word"] in now for e in p["entries"])
                    self.assertGreaterEqual(here, min(2, len(now)))

    def test_older_words_fill_the_rest_so_a_puzzle_is_spaced_retrieval(self):
        # Where a week has few plain words of its own, the puzzles are mostly older ones.
        for week in WEEKS:
            now = {w for w in week["words"] if w.isalpha()}
            if len(now) >= 10:
                continue
            for n, puzzle in enumerate(SHIPPED["weeks"][week["id"]]["crosswords"]):
                with self.subTest(week=week["id"], puzzle=n + 1):
                    self.assertTrue(any(e["word"] not in now for e in puzzle["entries"]))

    def test_a_cell_stays_big_enough_for_a_phone(self):
        for week, n, puzzle in shipped():
            with self.subTest(week=week["id"], puzzle=n + 1):
                self.assertLessEqual(puzzle["cols"], cw.MAX_COLS)
                self.assertLessEqual(puzzle["rows"], cw.MAX_ROWS)

    def test_no_dash_the_site_would_refuse(self):
        text = (ROOT / "web" / "data" / "games.json").read_text()
        self.assertNotRegex(text, "[–—]")


class TestTheGenerator(unittest.TestCase):
    def meanings(self):
        return {w: SHIPPED["words"][w]["meaning"] for w in SHIPPED["words"]}

    def test_it_is_deterministic(self):
        week = WEEKS[1]
        earlier = [w for w in WEEKS[0]["words"]]
        a = cw.week_puzzles(week["id"], week["words"], earlier, self.meanings())
        b = cw.week_puzzles(week["id"], week["words"], earlier, self.meanings())
        self.assertEqual(a, b)

    def test_it_matches_what_ships(self):
        week = WEEKS[0]
        self.assertEqual(cw.week_puzzles(week["id"], week["words"], [], self.meanings()),
                         SHIPPED["weeks"][week["id"]]["crosswords"])

    def test_a_word_cannot_sit_beside_another_or_on_top_of_one(self):
        g = cw.Grid()
        g.put("cat", 0, 0, cw.ACROSS, 0)
        self.assertEqual(g.fits("cot", 0, 0, cw.DOWN), 1)            # crosses at the c
        self.assertIsNone(g.fits("act", 0, 1, cw.ACROSS))            # runs on from the c: "cact"
        self.assertIsNone(g.fits("tab", 1, 0, cw.ACROSS))            # sits under it, spelling pairs
        self.assertIsNone(g.fits("cap", 0, 0, cw.ACROSS))            # on top of it
        self.assertIsNone(g.fits("dog", 5, 5, cw.ACROSS))           # crosses nothing

    def test_a_word_only_crosses_where_the_letters_agree(self):
        g = cw.Grid()
        g.put("cat", 0, 0, cw.ACROSS, 0)
        self.assertIsNone(g.fits("dog", 0, 0, cw.DOWN))
        self.assertIsNone(g.fits("cot", 0, 1, cw.DOWN))              # a under the c would need a c


class TestTheCheckerCatchesWhatItShould(unittest.TestCase):
    def good(self):
        return copy.deepcopy(SHIPPED["weeks"][WEEKS[0]["id"]]["crosswords"][0])

    def test_a_stray_letter_beside_an_answer(self):
        p = self.good()
        grid = [list(row) for row in p["grid"]]
        for r in range(p["rows"]):
            for c in range(p["cols"] - 1):
                if grid[r][c] == "." and grid[r][c + 1] != "." and (r, c) != (0, 0):
                    grid[r][c] = "q"
                    p["grid"] = ["".join(row) for row in grid]
                    self.assertTrue(any("not the answers" in x or "belongs to no answer" in x
                                        for x in cw.problems(p)))
                    return
        self.fail("no place to put a stray letter")

    def test_a_missing_answer(self):
        p = self.good()
        p["entries"].pop()
        self.assertNotEqual(cw.problems(p), [])

    def test_a_wrong_number(self):
        p = self.good()
        p["entries"][-1]["n"] += 5
        self.assertTrue(any("number" in x for x in cw.problems(p)))

    def test_a_grid_that_is_too_wide(self):
        p = self.good()
        p["cols"] += 3
        p["grid"] = [row + "..." for row in p["grid"]]
        self.assertTrue(any("too big" in x for x in cw.problems(p)))

    def test_two_pieces(self):
        p = self.good()
        grid = [list(row) for row in p["grid"]]
        # Cut the grid in two by blanking a letter that joins the first answer to the rest.
        first = p["entries"][0]
        dr, dc = (0, 1) if first["dir"] == cw.ACROSS else (1, 0)
        r, c = first["row"] + dr, first["col"] + dc
        grid[r][c] = "."
        p["grid"] = ["".join(row) for row in grid]
        self.assertNotEqual(cw.problems(p), [])


if __name__ == "__main__":
    unittest.main()
