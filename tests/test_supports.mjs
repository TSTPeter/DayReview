/*
 * The support experiment, held to its registration (experiments/2026-10-support-types.md).
 *
 * The assignment, the outcome rules and the posterior decide the experiment's answer,
 * so they are checked here as plain functions: the assignment over the real word list,
 * the outcomes over attempt logs built to sit either side of every boundary the
 * registration draws.
 *
 *   node tests/test_supports.mjs
 */
import { readFileSync } from "node:fs";
import { ARMS, ENOUGH, assign, outcomes, chanceBest, tallies } from "../web/js/supports.js";

let failures = 0;
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "  ok  " : "FAIL  "}${name}${detail ? "  : " + detail : ""}`);
  if (!ok) failures += 1;
};
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const data = JSON.parse(read("web/data/supports.json"));
const words = JSON.parse(read("web/data/words.json"));
const term = JSON.parse(read("web/data/term.json"));
const registration = read("experiments/2026-10-support-types.md").replace(/\s+/g, " ");

// The same lookup app.js hands to supports.init: the curated entry first.
const curated = new Map([...words.words, ...words.off_list].map((e) => [e.word, e]));
const authored = new Map((term.entries || []).map((e) => [e.word, e]));
const entryFor = (w) => curated.get(w) || authored.get(w) || null;
const list = Object.keys(data.words).map((word) => ({ word, pattern: (entryFor(word) || {}).patterns?.[0] }));

console.log("\n: assignment");
check("every word in the experiment has an entry to group it by",
      list.every((w) => entryFor(w.word)), list.filter((w) => !entryFor(w.word)).map((w) => w.word).join(", "));
const a = assign(list, 20261001);
check("every word gets exactly one arm, one of the four",
      Object.keys(a).length === list.length && Object.values(a).every((x) => ARMS.includes(x)));
const groups = new Map();
for (const w of list) {
  const key = w.pattern || "none";
  if (!groups.has(key)) groups.set(key, Object.fromEntries(ARMS.map((x) => [x, 0])));
  groups.get(key)[a[w.word]] += 1;
}
const uneven = [...groups].filter(([, c]) => Math.max(...Object.values(c)) - Math.min(...Object.values(c)) > 1);
check("each pattern group splits as evenly as its size allows",
      uneven.length === 0, uneven.map(([k, c]) => `${k} ${JSON.stringify(c)}`).join("; "));
const totals = Object.fromEntries(ARMS.map((x) => [x, Object.values(a).filter((y) => y === x).length]));
check("the four arms come out near a quarter each",
      Object.values(totals).every((n) => n >= 30 && n <= 48), JSON.stringify(totals));
check("one seed always gives one assignment",
      JSON.stringify(assign(list, 20261001)) === JSON.stringify(a));
check("the order the words arrive in makes no difference",
      JSON.stringify(assign([...list].reverse(), 20261001)) === JSON.stringify(a));
check("another seed gives another assignment",
      JSON.stringify(assign(list, 7)) !== JSON.stringify(a));
const seen = new Map(list.map((w) => [w.word, new Set()]));
for (let s = 1; s <= 400; s++) for (const [w, arm] of Object.entries(assign(list, s))) seen.get(w).add(arm);
const stuck = [...seen].filter(([, arms]) => arms.size < ARMS.length).map(([w]) => w);
check("over many seeds, every word can land in every arm", stuck.length === 0, stuck.join(", "));

console.log("\n: outcomes");
const T0 = Date.parse("2026-10-05T16:00:00Z");
const at = (hours) => new Date(T0 + hours * 3600000).toISOString();
const row = (word, hours, mode, correct) => ({ word, created_at: at(hours), prompt_mode: mode, correct });
const log = [
  { at: at(0), word: "accommodate", arm: "etymology", where: "sort", said: null },
  { at: at(25), word: "accommodate", arm: "etymology", where: "dictation", said: null },
  { at: at(1), word: "category", arm: "story", where: "dictation", said: null },
];
const attempts = [
  row("accommodate", -1, "audio_sentence", false),     // before the first showing
  row("accommodate", 19, "audio_sentence", true),      // too soon: under 20 hours
  row("accommodate", 21, "text_cloze", true),          // a cloze is not a dictation
  row("accommodate", 22, "audio_sentence", false),     // the primary outcome
  row("accommodate", 2, "dictation_paper", false),     // too soon for paper as well
  row("accommodate", 30, "dictation_paper", true),     // the paper outcome
  row("accommodate", 7 * 24 - 1, "audio_sentence", true),
  row("accommodate", 7 * 24 + 1, "audio_sentence", true),   // the week outcome
];
const per = outcomes([...attempts].reverse(), log);
const e = per.etymology;
check("the primary outcome is the first dictation 20 hours or more after the first showing",
      e.words === 1 && e.n === 1 && e.k === 0, JSON.stringify(e));
check("on paper, the same 20 hours apply", e.paper_n === 1 && e.paper_k === 1, JSON.stringify(e));
check("the week outcome is the first dictation 7 days or more after", e.week_n === 1 && e.week_k === 1,
      JSON.stringify(e));
check("a word shown but not yet checked counts as shown, not as an outcome",
      per.story.words === 1 && per.story.n === 0, JSON.stringify(per.story));
check("arms with nothing shown stay empty", per.say.words === 0 && per.blend.words === 0);
const t = tallies(per);
check("the tallies Firebase may carry are three counts per arm and nothing else",
      JSON.stringify(Object.keys(t)) === JSON.stringify(ARMS)
      && ARMS.every((x) => JSON.stringify(Object.keys(t[x])) === '["words","outcomes","correct"]')
      && t.etymology.outcomes === 1 && t.etymology.correct === 0, JSON.stringify(t));

console.log("\n: the chance each arm is best");
const blank = Object.fromEntries(ARMS.map((x) => [x, { n: 0, k: 0 }]));
const even = chanceBest(blank);
check("with no data every arm is equally likely to be best",
      ARMS.every((x) => Math.abs(even[x] - 0.25) < 0.04), JSON.stringify(even));
const clear = chanceBest({ ...blank, etymology: { n: 20, k: 18 }, story: { n: 20, k: 6 },
                           say: { n: 20, k: 6 }, blend: { n: 20, k: 6 } });
check("a clearly better arm comes out above the 0.9 the stop rule needs", clear.etymology > 0.99,
      JSON.stringify(clear));
const close = chanceBest({ etymology: { n: 10, k: 6 }, story: { n: 10, k: 5 },
                           say: { n: 10, k: 5 }, blend: { n: 10, k: 5 } });
check("ten words an arm and one more right is nowhere near 0.9", close.etymology < 0.6,
      JSON.stringify(close));
check("the chances add up to one",
      Math.abs(ARMS.reduce((s, x) => s + clear[x], 0) - 1) < 1e-9);
check("one seed always gives the same chances",
      JSON.stringify(chanceBest(blank, 4000, 3)) === JSON.stringify(chanceBest(blank, 4000, 3)));

console.log("\n: the code says what the registration says");
check("too few to tell until every arm has 10 outcomes",
      ENOUGH === 10 && registration.includes(`at least ${ENOUGH} outcomes`));
check("the outcome waits at least 20 hours", registration.includes("at least 20 hours after the first showing"));
check("the arms are the registration's four, in its words",
      ARMS.every((x) => registration.includes(`\`${x}\``)));
check("the shipped content names the same arms", JSON.stringify(data.arms) === JSON.stringify(ARMS),
      JSON.stringify(data.arms));

console.log(`\n${failures ? `${failures} CHECK(S) FAILED` : "all checks passed"}\n`);
process.exit(failures ? 1 : 0);
