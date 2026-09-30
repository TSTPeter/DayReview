"""
The hidden-words blocks, held to the rules engine/wordblocks.py claims.

Every block that ships is checked here, from the exported file: it is filled
exactly by its words, its routes and tilings are complete (recomputed, not
trusted), no other word on the week's list hides in it, and nothing screened
reads in a straight line. tests/browser/run.mjs plays them.
"""
import json
import pathlib
import sys
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "engine"))

import term  # noqa: E402
import wordblocks as wb  # noqa: E402

SHIPPED = json.loads((ROOT / "web" / "data" / "games.json").read_text())
WEEKS = {w["id"]: w for w in term.weeks()}


def shipped_blocks():
    for week_id, content in SHIPPED["weeks"].items():
        for n, block in enumerate(content["blocks"]):
            yield week_id, n, block


class TestEveryShippedBlock(unittest.TestCase):
    def test_every_week_has_its_blocks(self):
        for week_id in WEEKS:
            with self.subTest(week=week_id):
                self.assertEqual(len(SHIPPED["weeks"][week_id]["blocks"]), wb.BLOCKS_PER_WEEK)

    def test_each_keeps_the_rules(self):
        for week_id, n, block in shipped_blocks():
            with self.subTest(week=week_id, block=n + 1):
                self.assertEqual(wb.check(block, WEEKS[week_id]["words"]), [])

    def test_four_or_five_of_the_weeks_own_words(self):
        for week_id, n, block in shipped_blocks():
            with self.subTest(week=week_id, block=n + 1):
                self.assertIn(len(block["words"]), (4, 5))
                self.assertLessEqual(set(block["words"]), set(WEEKS[week_id]["words"]))
                self.assertEqual(len(set(block["words"])), len(block["words"]))

    def test_the_week_covers_its_whole_list(self):
        for week_id, week in WEEKS.items():
            with self.subTest(week=week_id):
                hidden = {w for b in SHIPPED["weeks"][week_id]["blocks"] for w in b["words"]}
                self.assertEqual(hidden, set(week["words"]))

    def test_small_enough_to_tap(self):
        for week_id, n, block in shipped_blocks():
            with self.subTest(week=week_id, block=n + 1):
                self.assertLessEqual(block["rows"], block["cols"])
                self.assertLessEqual(block["cols"], 8)

    def test_the_routes_are_every_route(self):
        # The game accepts a traced route only if it is on this list, so a missing
        # route would turn a right answer away.
        for week_id, n, block in shipped_blocks():
            for w, rs in zip(block["words"], block["routes"]):
                with self.subTest(week=week_id, block=n + 1, word=w):
                    again = wb.routes(block["letters"], block["rows"], block["cols"], w)
                    self.assertEqual(sorted(map(tuple, again)), sorted(map(tuple, rs)))

    def test_the_tilings_are_every_tiling(self):
        for week_id, n, block in shipped_blocks():
            with self.subTest(week=week_id, block=n + 1):
                again = wb.tilings(block["routes"], block["rows"] * block["cols"])
                self.assertEqual(sorted(map(tuple, again)), sorted(map(tuple, block["tilings"])))

    def test_the_generators_own_layout_comes_first_and_never_crosses(self):
        for week_id, n, block in shipped_blocks():
            with self.subTest(week=week_id, block=n + 1):
                self.assertEqual(block["tilings"][0], [0] * len(block["words"]))
                cols = block["cols"]
                steps = set()
                for rs in block["routes"]:
                    r = rs[0]
                    for a, b in zip(r, r[1:]):
                        steps.add(frozenset({a, b}))
                for step in steps:
                    a, b = sorted(step)
                    (ya, xa), (yb, xb) = divmod(a, cols), divmod(b, cols)
                    if ya != yb and xa != xb:
                        other = frozenset({ya * cols + xb, yb * cols + xa})
                        self.assertNotIn(other, steps, "two diagonal steps cross")

    def test_the_file_is_what_the_generator_builds(self):
        # Deterministic: a step budget and checksummed seeds, never the clock.
        for week_id, week in list(WEEKS.items())[:2]:
            with self.subTest(week=week_id):
                self.assertEqual(wb.week_blocks(week_id, week["words"]),
                                 SHIPPED["weeks"][week_id]["blocks"])


class TestTheRulesBite(unittest.TestCase):
    """Each rule, broken on purpose, is caught."""

    def setUp(self):
        week = WEEKS["week-2026-09-28"]
        self.words = week["words"]
        self.block = json.loads(json.dumps(SHIPPED["weeks"][week["id"]]["blocks"][0]))

    def test_a_route_that_does_not_spell_its_word(self):
        self.block["routes"][0][0] = list(reversed(self.block["routes"][0][0]))
        self.assertTrue(any("does not spell" in p for p in wb.check(self.block, self.words)))

    def test_a_list_word_left_traceable(self):
        # Hide only four of the five: the fifth is on the list and still traceable.
        self.block["words"] = self.block["words"][:-1]
        self.block["routes"] = self.block["routes"][:-1]
        self.block["tilings"] = []
        problems = wb.check(self.block, self.words)
        self.assertTrue(any("can be traced, but is not hidden" in p for p in problems))

    def test_a_screened_word_in_a_straight_line(self):
        rude = wb.SCREENED[1]
        rows, cols = 3, 3
        for grid in (rude + "xxxxxx", "x" * 6 + rude[::-1],            # across, backwards
                     rude[0] + "xx" + rude[1] + "xx" + rude[2] + "xx",  # down
                     rude[0] + "xxx" + rude[1] + "xxx" + rude[2]):      # diagonal
            with self.subTest(grid=grid):
                self.assertEqual(wb.screened(grid, rows, cols), rude)
        self.assertIsNone(wb.screened("abcdefghi", rows, cols))

    def test_one_word_starting_another(self):
        self.assertTrue(any("is the start of" in p for p in wb.check(
            dict(self.block, words=["decen", "decency"]), [])))


if __name__ == "__main__":
    unittest.main()
