// What is shown after a miss, and the experiment that decides it.
// experiments/2026-10-support-types.md is the pre-registration; read it first.
//
// Every miss keeps the baseline: her attempt marked, the error named, the rule, and
// how the word is built. Each word is in ONE arm for the whole experiment, and the
// arm adds one thing: where it comes from, a story of it in use, saying it aloud the
// way it is spelt, or all three. Assignment is random, balanced within each pattern
// group, made from a seed this device mints once, and it never looks at her answers.
//
// Until the content has been reviewed (supports.json `reviewed`, engine/supports.py
// REVIEWED), the experiment is off: no arm is assigned, nothing is logged, and a miss
// gets the pre-experiment default of where it comes from plus saying it aloud.

export const ARMS = ["etymology", "story", "say", "blend"];
const SHOWS = { etymology: ["etymology"], story: ["story"], say: ["say"],
                blend: ["etymology", "story", "say"] };
const DEFAULT = ["etymology", "say"];          // before the experiment starts
const OUTCOME_AFTER_MS = 20 * 3600000;         // the registration's "a day or more"
const WEEK_MS = 7 * 86400000;
export const ENOUGH = 10;                      // outcomes per arm before it says anything

let data = { reviewed: false, words: {} };
let store = null;
let arms = {};

const tag = (name, props = {}, kids = []) => {
  const n = document.createElement(name);
  Object.assign(n, props);
  for (const k of [].concat(kids)) if (k) n.append(k);
  return n;
};

// mulberry32: small, fast and deterministic, so one seed always gives one assignment.
function prng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled(xs, rand) {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Balanced random assignment within pattern groups. Pure, so the test suite can hold
 * it to "every group splits as evenly as its size allows".
 *   words: [{ word, pattern }]   seed: uint32
 */
export function assign(words, seed) {
  const rand = prng(seed);
  const groups = new Map();
  for (const w of [...words].sort((a, b) => a.word.localeCompare(b.word))) {
    const key = w.pattern || "none";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(w.word);
  }
  const out = {};
  for (const key of [...groups.keys()].sort()) {
    const order = shuffled(ARMS, rand);
    shuffled(groups.get(key), rand).forEach((word, i) => { out[word] = order[i % ARMS.length]; });
  }
  return out;
}

/** Load the content and, once it is reviewed, this device's assignment. */
export async function init(supportsJson, storeModule, entryFor) {
  data = supportsJson && supportsJson.words ? supportsJson : { reviewed: false, words: {} };
  store = storeModule;
  arms = {};
  if (!live()) return;
  let seed = await store.getKV("experiment_seed", null);
  if (seed === null) {
    seed = self.crypto && self.crypto.getRandomValues
      ? self.crypto.getRandomValues(new Uint32Array(1))[0]
      : Math.floor(Math.random() * 4294967296);
    await store.setKV("experiment_seed", seed);
  }
  arms = await store.getKV("support_arms", {});
  // Words new since the last visit (a new term's lists) are assigned among themselves.
  // An existing assignment is never changed: the registration fixes it for good.
  const fresh = Object.keys(data.words).filter((w) => !arms[w]);
  if (fresh.length) {
    const made = assign(fresh.map((word) => {
      const e = entryFor(word);
      return { word, pattern: e && e.patterns && e.patterns[0] };
    }), seed ^ fresh.length);
    arms = { ...made, ...arms };
    await store.setKV("support_arms", arms);
  }
}

export const live = () => !!data.reviewed;
export const inExperiment = (word) => live() && !!arms[word];
export const armOf = (word) => (live() ? arms[word] || null : null);
export const has = (word) => !!data.words[word];

/** What a miss on this word shows, beyond the baseline. */
export function showsFor(word) {
  if (!has(word)) return [];
  const arm = armOf(word);
  return arm ? SHOWS[arm] : DEFAULT;
}

/** Record that a support was shown. Nothing is logged before the experiment starts. */
export async function logShown(word, where, said = null) {
  const arm = armOf(word);
  if (!arm || !store) return;
  const log = await store.getKV("support_log", []);
  log.push({ at: new Date().toISOString(), word, arm, where, said });
  await store.setKV("support_log", log);
}

/** The support card for a miss: the arm's pieces, each with its own heading. */
export function render(word, options = {}) {
  const s = data.words[word];
  if (!s) return null;
  const shows = options.shows || showsFor(word);
  const host = tag("div", { className: "support" });
  host.dataset.shows = shows.join(" ");
  if (shows.includes("etymology") && s.etymology) {
    host.append(tag("div", { className: "support-part" }, [
      tag("span", { className: "tab", textContent: "Where it comes from" }),
      tag("p", { textContent: s.etymology.text }),
      s.etymology.family.length
        ? tag("p", { className: "small muted", textContent: `Same family: ${s.etymology.family.join(", ")}` })
        : null,
    ]));
  }
  if (shows.includes("story") && s.story) {
    const quote = s.story.kind === "quote";
    host.append(tag("div", { className: "support-part" }, [
      tag("span", { className: "tab", textContent: quote ? "In a book" : "In use" }),
      tag("p", { className: quote ? "support-quote" : "", textContent: s.story.text }),
      tag("p", { className: "small muted", textContent: s.story.source }),
    ]));
  }
  if (shows.includes("say") && s.say) {
    const line = tag("p", { className: "support-say" });
    s.say.chunks.forEach((c, i) => {
      if (i) line.append(document.createTextNode(" · "));
      line.append(tag(s.say.stress.includes(i) ? "b" : "span",
        { textContent: s.say.stress.includes(i) ? c.toUpperCase() : c }));
    });
    host.append(tag("div", { className: "support-part" }, [
      tag("span", { className: "tab", textContent: "Say it the way it is spelt" }),
      line,
      tag("p", { className: "small muted", textContent: "Out loud, then once more." }),
    ]));
  }
  return host.children.length ? host : null;
}

/**
 * The registration's outcomes, from the attempt log and the exposure log.
 * Primary: the first typed dictation at least 20 hours after the first showing.
 * Secondary: the same on paper, and the first typed dictation 7 or more days after.
 * A cloze is not a dictation (the app falls back to one only when it cannot speak),
 * and the two prompt modes are never pooled, so a cloze attempt is not an outcome.
 */
export function outcomes(attempts, log) {
  const first = new Map();
  for (const e of log) {
    const t = Date.parse(e.at);
    if (!first.has(e.word) || t < first.get(e.word).t) first.set(e.word, { t, arm: e.arm });
  }
  const per = Object.fromEntries(ARMS.map((a) => [a, { words: 0, n: 0, k: 0, paper_n: 0,
    paper_k: 0, week_n: 0, week_k: 0 }]));
  const byWord = new Map();
  for (const a of [...attempts].sort((x, y) => Date.parse(x.created_at) - Date.parse(y.created_at))) {
    if (!byWord.has(a.word)) byWord.set(a.word, []);
    byWord.get(a.word).push(a);
  }
  for (const [word, { t, arm }] of first) {
    const p = per[arm];
    if (!p) continue;
    p.words += 1;
    const later = byWord.get(word) || [];
    const after = (mode, ms) => later.find((a) => a.prompt_mode === mode
      && Date.parse(a.created_at) >= t + ms);
    const primary = after("audio_sentence", OUTCOME_AFTER_MS);
    if (primary) { p.n += 1; p.k += primary.correct ? 1 : 0; }
    const paper = after("dictation_paper", OUTCOME_AFTER_MS);
    if (paper) { p.paper_n += 1; p.paper_k += paper.correct ? 1 : 0; }
    const week = after("audio_sentence", WEEK_MS);
    if (week) { p.week_n += 1; p.week_k += week.correct ? 1 : 0; }
  }
  return per;
}

// Gamma(shape >= 1) by Marsaglia and Tsang; Beta from two of them.
function gamma(shape, rand) {
  const d = shape - 1 / 3, c = 1 / Math.sqrt(9 * d);
  for (;;) {
    let x, v;
    do {
      const u1 = rand() || 1e-12, u2 = rand();
      x = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      v = 1 + c * x;
    } while (v <= 0);
    v = v * v * v;
    const u = rand();
    if (u < 1 - 0.0331 * x ** 4 || Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
  }
}

/** Beta(1 + k, 1 + n - k) per arm, and the chance each is best, by simulation. */
export function chanceBest(per, draws = 4000, seed = 1) {
  const rand = prng(seed);
  const wins = Object.fromEntries(ARMS.map((a) => [a, 0]));
  for (let i = 0; i < draws; i++) {
    let best = null, top = -1;
    for (const a of ARMS) {
      const { n, k } = per[a];
      const x = gamma(1 + k, rand), y = gamma(1 + n - k, rand);
      const v = x / (x + y);
      if (v > top) { top = v; best = a; }
    }
    wins[best] += 1;
  }
  return Object.fromEntries(ARMS.map((a) => [a, wins[a] / draws]));
}

/** The aggregate tallies Firebase may carry: counts per arm, nothing else. */
export function tallies(per) {
  return Object.fromEntries(ARMS.map((a) => [a, { words: per[a].words, outcomes: per[a].n,
                                                  correct: per[a].k }]));
}
