"""
This week's list from school: parsing, dates, and the session mix.
"""
import pathlib
import sys
import unittest
from datetime import date, timedelta

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1] / "engine"))

import weekly  # noqa: E402
from schedule import Scheduler  # noqa: E402
from words import WORDS  # noqa: E402

BY_WORD = {w["word"]: w for w in WORDS}
MON = date(2026, 9, 21)
FRI = date(2026, 9, 25)
LIST_WORDS = ("necessary rhythm conscience wednesday separate business "
              "definitely embarrass occurred tomorrow")


def build(today=MON, text=LIST_WORDS):
    lst = weekly.make_list(text, set_on=today)
    extra = [e for e in weekly.entries_for(lst["words"], BY_WORD)
             if e["word"] not in BY_WORD]
    return lst, Scheduler(WORDS + extra, today=today)


class TestParsing(unittest.TestCase):
    def test_numbered_list(self):
        self.assertEqual(weekly.parse("1. cat\n2. dog\n3) bird"), ["cat", "dog", "bird"])

    def test_comma_and_newline_mixed(self):
        self.assertEqual(weekly.parse("one, two;three\nfour"),
                         ["one", "two", "three", "four"])

    def test_case_and_punctuation_are_stripped(self):
        self.assertEqual(weekly.parse("Wednesday  DON'T"), ["wednesday", "dont"])

    def test_duplicates_are_dropped(self):
        self.assertEqual(weekly.parse("cat cat CAT"), ["cat"])

    def test_stray_numbering_and_initials_are_not_words(self):
        self.assertEqual(weekly.parse("1 a b 22 necessary"), ["necessary"])

    def test_empty_input(self):
        self.assertEqual(weekly.parse(""), [])
        self.assertEqual(weekly.parse(None), [])


class TestDates(unittest.TestCase):
    def test_next_friday_from_midweek(self):
        self.assertEqual(weekly.next_test_day(date(2026, 9, 21)), FRI)

    def test_friday_itself_counts_as_this_friday(self):
        self.assertEqual(weekly.next_test_day(FRI), FRI)

    def test_saturday_rolls_to_next_week(self):
        self.assertEqual(weekly.next_test_day(date(2026, 9, 26)), date(2026, 10, 2))

    def test_days_until(self):
        self.assertEqual(weekly.days_until(FRI.isoformat(), MON), 4)

    def test_active_through_test_day_then_not(self):
        lst, _ = build()
        self.assertTrue(weekly.is_active(lst, MON))
        self.assertTrue(weekly.is_active(lst, FRI))
        self.assertFalse(weekly.is_active(lst, FRI + timedelta(days=1)))

    def test_marking_done_deactivates_immediately(self):
        lst, _ = build()
        lst["done"] = True
        self.assertFalse(weekly.is_active(lst, MON))


class TestEntries(unittest.TestCase):
    def test_a_statutory_word_keeps_its_curated_entry(self):
        # 'necessary' is on the DfE list, so it must not be replaced by a
        # derived stub: she would lose the origin, morphemes and word family.
        e = {x["word"]: x for x in weekly.entries_for(["necessary"], BY_WORD)}["necessary"]
        self.assertTrue(e["why"])
        self.assertTrue(e["family"])
        self.assertNotIn("derived", e)
        self.assertTrue(e["weekly"])

    def test_a_new_word_gets_a_derived_entry(self):
        e = {x["word"]: x for x in weekly.entries_for(["tomorrow"], BY_WORD)}["tomorrow"]
        self.assertTrue(e["derived"])
        self.assertEqual(e["why"], "")
        self.assertTrue(e["patterns"])


class TestSessionMix(unittest.TestCase):
    def setUp(self):
        self.lst, self.s = build()
        self.wk = set(self.lst["words"])

    def share(self, day, size=12):
        q = weekly.compose(self.s, self.lst, size=size, today=day)
        return sum(1 for w in q if w in self.wk), q

    def test_about_two_thirds_are_this_weeks_words(self):
        n, q = self.share(MON)
        self.assertEqual(len(q), 12)
        self.assertEqual(n, 8)

    def test_the_rest_are_statutory_words(self):
        n, q = self.share(MON)
        self.assertEqual(len(q) - n, 4)

    def test_no_duplicates_in_a_session(self):
        _, q = self.share(MON)
        self.assertEqual(len(q), len(set(q)))

    def test_the_mix_holds_on_test_day(self):
        self.assertEqual(self.share(FRI)[0], 8)

    def test_unseen_words_come_first(self):
        # Getting every word covered before Friday depends on this.
        order = weekly.priority_order(self.lst["words"], self.s)
        self.s.record(order[0], True)
        self.assertNotEqual(weekly.priority_order(self.lst["words"], self.s)[0], order[0])

    def test_a_short_list_does_not_starve_the_session(self):
        lst, s = build(text="cat dog")
        q = weekly.compose(s, lst, size=12, today=MON)
        self.assertEqual(len(q), 12)

    def test_no_list_falls_back_to_the_ordinary_queue(self):
        _, s = build()
        self.assertEqual(len(weekly.compose(s, None, size=10, today=MON)), 10)

    def test_a_list_of_unknown_words_does_not_crash(self):
        lst, s = build()
        lst["words"] = ["notinthescheduleratall"]
        self.assertEqual(len(weekly.compose(s, lst, size=10, today=MON)), 10)


class TestAfterTheTest(unittest.TestCase):
    """The half of the feature that serves docs/00's actual success criteria."""

    def setUp(self):
        self.lst, self.s = build()
        self.wk = set(self.lst["words"])
        self.hard = set(self.lst["words"][:4])
        for d in range(5):
            day = MON + timedelta(days=d)
            self.s.advance_to(day)
            for w in weekly.compose(self.s, self.lst, size=12, today=day):
                self.s.record(w, w not in self.hard)

    def appearances(self, days):
        out = {}
        for d in days:
            day = FRI + timedelta(days=d)
            self.s.advance_to(day)
            q = weekly.compose(self.s, self.lst, size=12, today=day)
            out[d] = [w for w in q if w in self.wk]
        return out

    def test_the_words_she_missed_come_back_the_next_day(self):
        self.assertTrue(self.appearances([1])[1])

    def test_the_words_she_knew_wait_for_their_interval(self):
        # Box 5 is 16 days. They should NOT be redrilled on day 1.
        known = set(self.lst["words"]) - self.hard
        self.assertFalse(set(self.appearances([1])[1]) & known)

    def test_they_do_return_at_the_long_interval(self):
        seen = set()
        for d in range(1, 21):
            seen |= set(self.appearances([d])[d])
            for w in weekly.compose(self.s, self.lst, size=12,
                                    today=FRI + timedelta(days=d)):
                self.s.record(w, True)
        self.assertEqual(seen, self.wk, f"never came back: {self.wk - seen}")

    def test_the_boost_expires(self):
        far = FRI + timedelta(days=weekly.AFTERGLOW_DAYS + 5)
        self.s.advance_to(far)
        plain = self.s.session(size=12)
        self.assertEqual(weekly.compose(self.s, self.lst, size=12, today=far), plain)


class TestCoverage(unittest.TestCase):
    def test_counts_are_honest(self):
        lst, s = build()
        c = weekly.coverage(lst, s)
        self.assertEqual(c["words"], 10)
        self.assertEqual(c["practised"], 0)
        self.assertEqual(c["untouched"], 10)
        s.record(lst["words"][0], True)
        self.assertEqual(weekly.coverage(lst, s)["practised"], 1)

    def test_days_left_is_reported(self):
        lst, s = build()
        self.assertIsNotNone(weekly.coverage(lst, s)["days_left"])


if __name__ == "__main__":
    unittest.main()
