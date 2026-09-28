"""
The term's lists, and which one is live on a given day.

The sheet from school is the source of truth. These tests hold engine/term.py to
it, and hold the week switch in weekly.py and weekly.js to each other.
"""
import json
import pathlib
import re
import shutil
import subprocess
import sys
import unittest
from datetime import date, timedelta

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "engine"))

import term  # noqa: E402
import weekly  # noqa: E402
from words import WORDS  # noqa: E402

NODE = shutil.which("node")
STATUTORY = {w["word"] for w in WORDS}


class TestTheSheet(unittest.TestCase):
    def setUp(self):
        self.weeks = term.weeks()

    def test_six_weeks_of_fifteen(self):
        self.assertEqual(len(self.weeks), 6)
        for w in self.weeks:
            with self.subTest(week=w["id"]):
                self.assertEqual(len(w["words"]), 15)
                self.assertEqual(len(w["pattern"]), 10)
                self.assertEqual(len(w["statutory"]), 5)

    def test_taught_on_monday_tested_on_friday(self):
        for w in self.weeks:
            with self.subTest(week=w["id"]):
                set_on = date.fromisoformat(w["set_on"])
                self.assertEqual(set_on.weekday(), 0)
                self.assertEqual(date.fromisoformat(w["test_on"]), set_on + timedelta(days=4))

    def test_the_bold_words_are_statutory(self):
        for w in self.weeks:
            for word in w["statutory"]:
                with self.subTest(word=word):
                    self.assertIn(word, STATUTORY)

    def test_hyphens_survive(self):
        hyphened = [w for week in self.weeks for w in week["words"] if "-" in w]
        self.assertEqual(len(hyphened), 20)
        self.assertIn("co-operate", hyphened)
        self.assertIn("short-tempered", hyphened)

    def test_the_noun_verb_week_carries_its_word_classes(self):
        pairs = self.weeks[1]
        self.assertEqual(pairs["hints"]["advice"], "noun")
        self.assertEqual(pairs["hints"]["prophesy"], "verb")

    def test_every_week_has_a_theme_the_site_will_serve(self):
        # tools/deploy_to_site.py refuses em and en dashes in anything it copies.
        for w in self.weeks:
            with self.subTest(week=w["id"]):
                self.assertTrue(w["theme"])
                self.assertNotRegex(w["theme"], "[\u2013\u2014]")

    def test_the_exported_file_is_current(self):
        shipped = json.loads((ROOT / "web" / "data" / "term.json").read_text())
        self.assertEqual(shipped["weeks"], self.weeks,
                         "web/data/term.json is stale. Run: python3 engine/export.py")


class TestWhichWeek(unittest.TestCase):
    def setUp(self):
        self.weeks = term.weeks()

    def pick(self, iso):
        w = weekly.scheduled_week(self.weeks, date.fromisoformat(iso))
        return w["id"] if w else None

    def test_before_the_term_there_is_none(self):
        self.assertIsNone(self.pick("2026-09-06"))

    def test_a_week_starts_on_its_monday(self):
        self.assertEqual(self.pick("2026-09-28"), "week-2026-09-28")
        self.assertEqual(self.pick("2026-10-04"), "week-2026-09-28")

    def test_the_gap_week_keeps_the_last_list(self):
        self.assertEqual(self.pick("2026-09-16"), "week-2026-09-07")

    def test_after_the_last_list_it_stays(self):
        self.assertEqual(self.pick("2026-11-30"), "week-2026-10-19")

    def test_an_older_saved_list_gives_way(self):
        # The list pasted by hand on 22 September, a week later.
        saved = weekly.make_list("advice\nadvise", date(2026, 9, 22))
        scheduled = weekly.scheduled_week(self.weeks, date(2026, 9, 28))
        self.assertIs(weekly.choose_week(saved, scheduled), scheduled)

    def test_this_weeks_edit_wins(self):
        edited = weekly.make_list("observant\nhesitant", date(2026, 9, 30))
        scheduled = weekly.scheduled_week(self.weeks, date(2026, 9, 30))
        self.assertIs(weekly.choose_week(edited, scheduled), edited)

    def test_nothing_saved_or_nothing_scheduled(self):
        scheduled = self.weeks[0]
        self.assertIs(weekly.choose_week(None, scheduled), scheduled)
        self.assertIsNone(weekly.choose_week(None, None))


@unittest.skipIf(NODE is None, "node not installed")
class TestWhichWeekParity(unittest.TestCase):
    def test_the_browser_picks_the_same_week_every_day(self):
        weeks = term.weeks()
        start = date(2026, 9, 1)
        days = [(start + timedelta(days=i)).isoformat() for i in range(75)]
        saved = [None, weekly.make_list("advice", date(2026, 9, 22)),
                 weekly.make_list("observant", date(2026, 9, 30))]
        script = (
            'import * as weekly from "./web/js/engine/weekly.js";'
            'import { readFileSync } from "node:fs";'
            'const { weeks, days, saved } = JSON.parse(readFileSync(0, "utf8"));'
            'const out = days.map((d) => { const s = weekly.scheduledWeek(weeks, d);'
            ' return [s ? s.id : null, ...saved.map((x) => {'
            ' const c = weekly.chooseWeek(x, s); return c ? c.id : null; })]; });'
            'process.stdout.write(JSON.stringify(out));')
        proc = subprocess.run([NODE, "--input-type=module", "-e", script], cwd=ROOT,
                              input=json.dumps({"weeks": weeks, "days": days, "saved": saved}),
                              capture_output=True, text=True)
        self.assertEqual(proc.returncode, 0, proc.stderr)
        js = json.loads(proc.stdout)
        for day, row in zip(days, js):
            s = weekly.scheduled_week(weeks, date.fromisoformat(day))
            py = [s["id"] if s else None]
            for x in saved:
                c = weekly.choose_week(x, s)
                py.append(c["id"] if c else None)
            with self.subTest(day=day):
                self.assertEqual(row, py)


if __name__ == "__main__":
    unittest.main()
