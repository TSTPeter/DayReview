// Reads [{word, attempt}, ...] as JSON on stdin, classifies each with the browser
// implementation, and writes the results as JSON on stdout. Driven by test_parity.py.
import { readFileSync } from "node:fs";
import { classify } from "../web/js/engine/classify.js";

const data = JSON.parse(readFileSync(new URL("../web/data/words.json", import.meta.url)));
const byWord = new Map();
for (const w of [...data.words, ...data.off_list]) byWord.set(w.word, w);

const cases = JSON.parse(readFileSync(0, "utf8"));
const out = cases.map(({ word, attempt }) => {
  const entry = byWord.get(word);
  if (!entry) return { error: `unknown word ${word}` };
  const d = classify(attempt, entry);
  // Compare only the fields the app and the dataset actually consume.
  return {
    correct: d.correct, type: d.type, detail: d.detail,
    patterns: d.patterns, sounds_right: d.sounds_right,
    trap: d.trap, mark_scheme: d.mark_scheme,
  };
});
process.stdout.write(JSON.stringify(out));
