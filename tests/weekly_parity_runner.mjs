// Runs the browser implementations of derive() and the weekly session
// composer, and prints the results as JSON for test_weekly_parity.py to
// compare against the Python ones.
import { readFileSync } from "node:fs";
import { derive } from "../web/js/engine/derive.js";
import * as weekly from "../web/js/engine/weekly.js";
import { Scheduler } from "../web/js/engine/schedule.js";

const data = JSON.parse(readFileSync(new URL("../web/data/words.json", import.meta.url)));
const byWord = new Map([...data.words, ...data.off_list].map((w) => [w.word, w]));

const input = JSON.parse(readFileSync(0, "utf8"));

// --- derive over every word we are asked about ---------------------------
const derived = {};
for (const w of input.words) derived[w] = derive(w, 99);

// --- a full week replayed through the composer ---------------------------
const list = weekly.makeList(input.listText, input.setOn);

// The tagged list is parsed separately: headings must be skipped and '(N)'/'(V)'
// must land on the right word on BOTH sides, or one device dictates an item the
// other cannot ask.
const tagged = weekly.makeList(input.taggedText, input.setOn);
const hints = Object.fromEntries(
  input.words.map((w) => [w, weekly.hintOf(tagged, w)]));
const extra = weekly.entriesFor(list.words, byWord).filter((e) => !byWord.has(e.word));
const scheduler = new Scheduler([...data.words, ...extra], input.setOn);

const log = [];
const addDays = (iso, n) =>
  new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);

for (const offset of input.offsets) {
  const day = addDays(input.setOn, offset);
  scheduler.advanceTo(day);
  const queue = weekly.compose(scheduler, list, input.size, day);
  for (const w of queue) scheduler.record(w, !input.hard.includes(w));
  log.push({ day, queue, coverage: weekly.coverage(list, scheduler) });
}

process.stdout.write(JSON.stringify({ derived, list, tagged, hints, log }));
