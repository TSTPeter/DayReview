// Port of engine/weekly.py. See that file for why the schedule splits the way
// it does: massed practice before Friday's test, spaced practice after it,
// because the school test and docs/00's success criteria want opposite things
// and both are legitimate.
//
// Dates are handled as ISO strings in UTC throughout, matching schedule.js.
// A local-time Date would shift the test day across a timezone or a DST
// boundary, and "which day is the test" is not a question to get wrong.

import { derive, hintFor, makeEntry, normalise } from "./derive.js";

export const FRIDAY = 5;            // JS getUTCDay(): Sunday is 0
export const WEEKLY_SHARE = 2 / 3;
export const AFTERGLOW_DAYS = 21;
export const AFTERGLOW_SHARE = 1 / 3;

const DAY = 86400000;
const parseISO = (iso) => Date.parse(`${iso}T00:00:00Z`);
const toISO = (ms) => new Date(ms).toISOString().slice(0, 10);
export const today = () => new Date().toISOString().slice(0, 10);

// A line that ends in a colon is a heading, not spellings. Without this, a
// real list pasted verbatim --
//     Noun/verb pairs (N = noun, V = verb):
//     advice (N) / advise (V)
// -- put 'noun', 'verb' and 'pairs' on the practice queue, and she would have
// been asked to spell 'pairs'.
const HEADING = /:\s*$/;

// A parenthesised or bracketed tag after a word: '(N)', '(noun)', '[verb]'.
// Schools write the list this way precisely because the word alone is
// ambiguous, so the tag is information, not decoration.
const TAG = /[\(\[]\s*([A-Za-z][A-Za-z ]{0,14}?)\s*[\)\]]/;
const TAG_ALL = new RegExp(TAG.source, "g");
const TAG_MEANING = new Map([
  ["n", "noun"], ["noun", "noun"], ["v", "verb"], ["verb", "verb"],
  ["adj", "adjective"], ["adjective", "adjective"],
  ["adv", "adverb"], ["adverb", "adverb"],
]);

// Python's str.splitlines(), near enough: the boundaries a pasted list can
// actually contain. Parity with weekly.py depends on splitting the same way.
const LINES = /\r\n|[\n\r\u000b\u000c\u001c-\u001e\u0085\u2028\u2029]/;

/**
 * Pull words, and any disambiguating tag, out of whatever the adult pastes.
 * Returns [{word, hint}]. Forgiving on purpose: a school list arrives retyped
 * in a hurry, numbered, comma-separated, or one per row. Headings are skipped;
 * anything else that is not a word is dropped rather than queried.
 */
export function parseEntries(text) {
  if (!text) return [];
  const out = [];
  const seen = new Set();
  for (const line of String(text).split(LINES)) {
    if (HEADING.test(line)) continue;
    // Split the line into segments so a tag attaches to the word before it:
    // 'advice (N) / advise (V)' is two items, not one with two tags.
    for (const segment of line.split(/[/,;]|\s{2,}/)) {
      const tag = TAG.exec(segment);
      const hint = tag ? TAG_MEANING.get(tag[1].trim().toLowerCase()) : null;
      for (const token of segment.replace(TAG_ALL, " ").split(/[^A-Za-z'’-]+/)) {
        const w = token.toLowerCase().replace(/[^a-z]/g, "");
        // Numbering and stray initials are noise; real Y5/6 words are 3+.
        if (w.length < 3 || seen.has(w)) continue;
        seen.add(w);
        out.push({ word: w, hint: hint || hintFor(w) });
      }
    }
  }
  return out;
}

/** Just the words. See parseEntries for the tags. */
export function parse(text) {
  return parseEntries(text).map((e) => e.word);
}

export function nextTestDay(fromISO, weekday = FRIDAY) {
  const d = fromISO || today();
  const ahead = (weekday - new Date(parseISO(d)).getUTCDay() + 7) % 7;
  return toISO(parseISO(d) + ahead * DAY);
}

export function makeList(text, setOn, testOn, listId) {
  const set = setOn || today();
  const entries = parseEntries(text);
  const hints = {};
  for (const e of entries) if (e.hint) hints[e.word] = e.hint;
  return {
    id: listId || `week-${set}`,
    words: entries.map((e) => e.word),
    // word -> 'noun' / 'verb' / ..., for words dictation alone cannot ask for.
    // Only the ones that need it are stored.
    hints,
    set_on: set,
    test_on: testOn || nextTestDay(set),
    done: false,
  };
}

/** The tag to speak and show for a word, from the list first, then the table. */
export function hintOf(list, word) {
  const w = normalise(word);
  return (list && list.hints && list.hints[w]) || hintFor(w);
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
