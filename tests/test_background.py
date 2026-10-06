"""The growing background (web/js/scene.js), and the numbers docs/11 quotes for it.

Peter asked on 1 October 2026 for a very mild step back on a miss, and on 6 October for
the first animal to come with her second right answer. The rules live in JavaScript, so
they are read from the file here, and the browser suite then proves the page obeys them.
"""
import importlib.util
import pathlib
import re
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
_spec = importlib.util.spec_from_file_location("simulate_background", ROOT / "tools" / "simulate_background.py")
sim = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(sim)

SCENE = (ROOT / "web" / "js" / "scene.js").read_text(encoding="utf-8")
ART = (ROOT / "web" / "js" / "rewards.js").read_text(encoding="utf-8")


class TestTheRules(unittest.TestCase):
    def setUp(self):
        self.rules = sim.scene_rules()

    def test_a_miss_takes_back_one_layer(self):
        self.assertEqual(self.rules["step_back"], 1)

    def test_the_first_animal_comes_with_the_second_right_answer(self):
        self.assertEqual(self.rules["first_animal"], 2)

    def test_there_are_more_layers_than_the_first_build_had(self):
        self.assertGreater(self.rules["max"], 14)

    def test_no_animal_can_be_drawn_twice_in_a_sitting(self):
        stickers = re.search(r"const STICKERS = \[(.*?)\];", SCENE, re.S).group(1)
        names = re.findall(r'"(\w+)"', stickers)
        wanted = sum(int(n) for n in re.findall(r'kind: "animal", count: (\d)', SCENE))
        self.assertLessEqual(wanted, len(names))
        self.assertEqual(len(names), len(set(names)))

    def test_every_animal_has_art(self):
        stickers = re.search(r"const STICKERS = \[(.*?)\];", SCENE, re.S).group(1)
        for name in re.findall(r'"(\w+)"', stickers):
            self.assertTrue(re.search(rf"^  {name}: S\(", ART, re.M), f"{name} has no art in rewards.js")


class TestTheNumbersInTheDocs(unittest.TestCase):
    def test_at_six_in_ten_the_new_rule_shows_an_animal_far_more_often(self):
        rows, _ = sim.table(rates=(0.6,))
        _, before, after = rows[0]
        self.assertLess(before["animal"], 0.15)
        self.assertGreater(before["plain"], 0.5)
        self.assertGreater(after["animal"], 0.7)

    def test_the_table_is_the_same_every_run(self):
        self.assertEqual(sim.table()[0], sim.table()[0])


if __name__ == "__main__":
    unittest.main()
