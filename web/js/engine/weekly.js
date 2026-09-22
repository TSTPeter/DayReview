// Port of engine/weekly.py. See that file for why the schedule splits the way
// it does: massed practice before Friday's test, spaced practice after it,
// because the school test and docs/00's success criteria want opposite things
// and both are legitimate.
//
// Dates are handled as ISO strings in UTC throughout, matching schedule.js.
// A local-time Date would shift the test day across a timezone or a DST
// boundary, and "which day is the test" is not a question to get wrong.

import { derive, makeEntry, normalise } from "./derive.js";

export const FRIDAY = 5;            // JS getUTCDay(): Sunday is 0
export const WEEKLY_SHARE = 2 / 3;
export const AFTERGLOW_DAYS = 21;
export const AFTERGLOW_SHARE = 1 / 3;

const DAY = 86400000;
const parseISO = (iso) => Date.parse(`${iso}T00:00:00Z`);
const toISO = (ms) => new Date(ms).toISOString().slice(0, 10);
export const today = () => new Date().toISOString().slice(0, 10);

/** Forgiving on purpose: a school list arrives retyped in a hurry. */
export function parse(text) {
  if (!text) return [];
  const out = [];
  const seen = new Set();
  for (const token of String(text).split(/[^A-Za-z'’-]+/)) {
    const w = token.toLowerCase().replace(/[^a-z]/g, "");
    if (w.length < 3 || seen.has(w)) continue;   // numbering and initials are noise
    seen.add(w);
    out.push(w);
  }
  return out;
}

export function nextTestDay(fromISO, weekday = FRIDAY) {
  const d = fromISO || today();
  const ahead = (weekday - new Date(parseISO(d)).getUTCDay() + 7) % 7;
  return toISO(parseISO(d) + ahead * DAY);
}

export function makeList(text, setOn, testOn, listId) {
  const set = setOn || today();
  return {
    id: listId || `week-${set}`,
    words: parse(text),
    set_on: set,
    test_on: testOn || nextTestDay(set),
    done: false,
  };
}

/**
 * A statutory word keeps its CURATED entry and is merely prioritised; only a
 * genuinely new word gets a derived stub, with what cannot be inferred left
 * empty rather than invented.
 */
export function entriesFor(words, byWord) {
  return words.map((w) => {
    const existing = byWord.get(w);
    return existing ? { ...existing, weekly: true } : makeEntry(w);
  });
}

export function daysUntil(testOn, todayISO) {
  return Math.round((parseISO(testOn) - parseISO(todayISO || today())) / DAY);
}

export function isActive(list, todayISO) {
  if (!list || list.done) return false;
  return daysUntil(list.test_on, todayISO) >= 0;
}

/** Least-seen first, then most-wrong, then list order. */
export function priorityOrder(words, scheduler) {
  return [...words].sort((a, b) => {
    const sa = scheduler.state[a] || { seen: 0, wrong: 0 };
    const sb = scheduler.state[b] || { seen: 0, wrong: 0 };
    return sa.seen - sb.seen || sb.wrong - sa.wrong
        || words.indexOf(a) - words.indexOf(b);
  });
}

function fill(scheduler, picked, size) {
  for (const w of scheduler.session(size * 2)) {
    if (!picked.includes(w)) picked.push(w);
    if (picked.length >= size) break;
  }
  return scheduler.interleave(picked.slice(0, size));
}

/**
 * After the test, keep the week's words on their Leitner schedule for real.
 * Without this they are ten words among a hundred and Scheduler.session()
 * breaks ties alphabetically, so the 1-2-4-8-16 day intervals never land.
 * Only words that are DUE are boosted: this does not re-drill, it lets the
 * interval arrive on the day it says.
 */
function afterglow(scheduler, list, size, todayISO) {
  if (!list) return scheduler.session(size);
  const since = -daysUntil(list.test_on, todayISO);
  if (since < 0 || since > AFTERGLOW_DAYS) return scheduler.session(size);

  const due = new Set(scheduler.due());
  const owed = list.words.filter((w) => due.has(w) && scheduler.state[w]);
  if (!owed.length) return scheduler.session(size);

  const reserve = Math.min(owed.length, Math.max(1, Math.ceil(size * AFTERGLOW_SHARE)));
  return fill(scheduler, priorityOrder(owed, scheduler).slice(0, reserve), size);
}

export function compose(scheduler, list, size = 10, todayISO) {
  const day = todayISO || today();
  if (!isActive(list, day)) return afterglow(scheduler, list, size, day);

  const known = list.words.filter((w) => scheduler.state[w]);
  if (!known.length) return scheduler.session(size);

  const reserve = Math.min(known.length, Math.max(1, Math.ceil(size * WEEKLY_SHARE)));
  return fill(scheduler, priorityOrder(known, scheduler).slice(0, reserve), size);
}

/** Progress for the grown-up view. Counts, never a score for her. */
export function coverage(list, scheduler) {
  const words = list ? list.words : [];
  const st = (w) => scheduler.state[w] || {};
  const practised = words.filter((w) => (st(w).seen || 0) > 0).length;
  return {
    words: words.length,
    practised,
    untouched: words.length - practised,
    secure: words.filter((w) => (st(w).box || 1) >= 3).length,
    days_left: list ? daysUntil(list.test_on) : null,
  };
}

export { normalise, derive };
