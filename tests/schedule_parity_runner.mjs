// Replays the same fixed run as tests/test_schedule.py through the browser scheduler.
import { readFileSync } from "node:fs";
import { Scheduler, addDays } from "../web/js/engine/schedule.js";
import { classify } from "../web/js/engine/classify.js";

const data = JSON.parse(readFileSync(new URL("../web/data/words.json", import.meta.url)));
const words = data.words;
const byWord = new Map(words.map((w) => [w.word, w]));

const START = "2026-09-08";
const s = new Scheduler(words, START);
const log = [];
for (const offset of [0, 2, 6]) {
  const day = addDays(START, offset);
  s.advanceTo(day);
  const queue = s.session(8);
  const marks = [];
  queue.forEach((word, i) => {
    const attempt = i < 3 ? byWord.get(word).errors[0] : word;
    const d = classify(attempt, byWord.get(word));
    s.record(word, d.correct, d.patterns);
    marks.push({ word, attempt, correct: d.correct, type: d.type, patterns: d.patterns });
  });
  log.push({ day, queue, marks, report: s.report() });
}
process.stdout.write(JSON.stringify(log));
