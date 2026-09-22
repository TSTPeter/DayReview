"""
This week's spelling list from school.

THE TENSION THIS MODULE RESOLVES.

Every week the school sends home ten or twenty words and tests them on Friday.
That is a deadline, and a deadline wants massed practice. Everything else in
this app is built on the opposite: spacing beat massing by about 10.6
percentage points across 254 studies, and it is the largest effect the product
rests on.

Both are right, for different horizons, so the schedule serves both:

  BEFORE THE TEST   roughly two thirds of each session is this week's words,
                    one third is statutory words that are due. She gets the
                    list covered without a week-long hole in the spaced review
                    of everything learned before it.

  AFTER THE TEST    the week's words do not disappear. They fold into the
                    Leitner boxes and come back at 1, 2, 4, 8 and 16 days.

That second half is the point. A weekly list that vanishes on Friday can teach
a child to pass Friday, which is not what anyone actually wants: docs/00's
first success criterion is spelling the word correctly in a dictated test A
WEEK OR MORE AFTER practice, and its second is spelling it in her own writing,
which is the KS2 teacher-assessment standard. Folding the list back in is the
only part of this feature that serves either.

IMPLEMENTED AS A COMPOSER, NOT A CHANGE TO THE SCHEDULER. Scheduler is ported
to JavaScript and held to a golden-file replay by two parity tests. Rewriting
its selection would mean regenerating that golden file and re-proving the port.
Composing on top of it leaves both untouched.
"""

import math
import re
from datetime import date, timedelta

import derive

FRIDAY = 4                 # date.weekday(): Monday is 0
WEEKLY_SHARE = 2 / 3       # of each session, before the test
AFTERGLOW_DAYS = 21        # how long a finished list keeps a claim on sessions
AFTERGLOW_SHARE = 1 / 3    # of each session, after the test, for DUE words only


def parse(text):
    """
    Pull words out of whatever the adult pastes.

    Deliberately forgiving: a school list arrives as a photo retyped in a
    hurry, a numbered list, a comma-separated line, or one word per row.
    Anything that is not a word is dropped rather than queried.
    """
    if not text:
        return []
    out, seen = [], set()
    for token in re.split(r"[^A-Za-z'’-]+", text):
        w = re.sub(r"[^a-z]", "", token.lower())
        # Numbering and stray single letters are noise; real Y5/6 words are 3+.
        if len(w) < 3 or w in seen:
            continue
        seen.add(w)
        out.append(w)
    return out


def next_test_day(from_day=None, weekday=FRIDAY):
    """The next Friday on or after `from_day`."""
    d = from_day or date.today()
    ahead = (weekday - d.weekday()) % 7
    return d + timedelta(days=ahead)


def make_list(text, set_on=None, test_on=None, list_id=None):
    set_on = set_on or date.today()
    words = parse(text)
    return {
        "id": list_id or f"week-{set_on.isoformat()}",
        "words": words,
        "set_on": set_on.isoformat(),
        "test_on": (test_on or next_test_day(set_on)).isoformat(),
        "done": False,
    }


def entries_for(words, by_word):
    """
    An engine entry per word on the list.

    A word already on the statutory list keeps its CURATED entry — full
    origin, morphemes, word family — and is simply prioritised this week. Only
    genuinely new words get a derived one, with the fields that cannot be
    inferred left empty rather than invented. See engine/derive.py.
    """
    out = []
    for w in words:
        existing = by_word.get(w)
        out.append(dict(existing, weekly=True) if existing
                   else derive.make_entry(w))
    return out


def days_until(test_on, today=None):
    today = today or date.today()
    if isinstance(test_on, str):
        test_on = date.fromisoformat(test_on)
    return (test_on - today).days


def is_active(weekly_list, today=None):
    """Before or on test day, and not marked done."""
    if not weekly_list or weekly_list.get("done"):
        return False
    return days_until(weekly_list["test_on"], today) >= 0


def priority_order(words, scheduler):
    """
    Which of this week's words to practise first.

    Least-seen first, then most-wrong, then list order. Front-loading the ones
    she has not met yet is what gets every word covered before Friday; putting
    the ones she keeps missing next is what makes the remaining sessions count.
    """
    def key(w):
        st = scheduler.state.get(w, {"seen": 0, "wrong": 0})
        return (st["seen"], -st["wrong"], words.index(w))
    return sorted(words, key=key)


def compose(scheduler, weekly_list, size=10, today=None):
    """
    The session queue.

    Before the test: weekly words take WEEKLY_SHARE of the slots, the rest
    comes from the ordinary due queue. After it: the ordinary queue alone,
    which by then contains this week's words on their own Leitner schedule.
    """
    today = today or date.today()

    if not is_active(weekly_list, today):
        return _afterglow(scheduler, weekly_list, size, today)

    known = [w for w in weekly_list["words"] if w in scheduler.state]
    if not known:
        return scheduler.session(size=size)

    reserve = min(len(known), max(1, math.ceil(size * WEEKLY_SHARE)))
    picked = priority_order(known, scheduler)[:reserve]

    # Fill the remainder from the ordinary due queue, skipping anything already
    # picked. Ask for extra because some of what comes back will be duplicates.
    if len(picked) < size:
        for w in scheduler.session(size=size * 2):
            if w not in picked:
                picked.append(w)
            if len(picked) >= size:
                break

    return scheduler._interleave(picked[:size])


def _afterglow(scheduler, weekly_list, size, today):
    """
    After the test: keep the week's words on their Leitner schedule, for real.

    Folding them "into the rotation" sounds like it happens by itself, and it
    does not. Once the test passes they are 10 words among 100-odd, and
    Scheduler.session() breaks ties alphabetically, so 'tomorrow' waits behind
    'accommodate' and the 1-2-4-8-16 day intervals never fire on schedule. The
    spacing that is the whole reason for folding them in would be delivered by
    accident of the alphabet or not at all.

    So for three weeks after the test, words from that list that are DUE get
    first call on a third of the session. Due is the operative word: this does
    not re-drill them, it lets the Leitner interval actually land on the day it
    says. After three weeks they are ordinary words with real box positions,
    and the boost is gone.
    """
    if not weekly_list:
        return scheduler.session(size=size)
    since = -days_until(weekly_list["test_on"], today)
    if since < 0 or since > AFTERGLOW_DAYS:
        return scheduler.session(size=size)

    due = set(scheduler.due())
    owed = [w for w in weekly_list["words"] if w in due and w in scheduler.state]
    if not owed:
        return scheduler.session(size=size)

    reserve = min(len(owed), max(1, math.ceil(size * AFTERGLOW_SHARE)))
    picked = priority_order(owed, scheduler)[:reserve]
    for w in scheduler.session(size=size * 2):
        if w not in picked:
            picked.append(w)
        if len(picked) >= size:
            break
    return scheduler._interleave(picked[:size])


def coverage(weekly_list, scheduler):
    """
    How the week is going, for the grown-up view. Counts only, no score for
    her: this is a progress report for an adult, not a target for a child.
    """
    words = weekly_list["words"] if weekly_list else []
    seen = sum(1 for w in words if scheduler.state.get(w, {}).get("seen", 0) > 0)
    secure = sum(1 for w in words if scheduler.state.get(w, {}).get("box", 1) >= 3)
    return {
        "words": len(words),
        "practised": seen,
        "untouched": len(words) - seen,
        "secure": secure,
        "days_left": days_until(weekly_list["test_on"]) if weekly_list else None,
    }
