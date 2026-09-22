// Port of engine/derive.py. Same rule as classify.js and schedule.js: mirror,
// do not improvise, and let tests/test_derive_parity.py be the arbiter.
//
// This one has to run in the browser because the list is typed on the tablet
// on a Sunday evening and practised immediately. A Python-only deriver would
// mean running a script before she could start, which is the kind of friction
// that gets a feature quietly abandoned.
//
// Read engine/derive.py for why schwa, soft-c-g and ou-spelling are absent:
// they are almost always present and almost never the lesson, and claiming
// them measured at 20-25% precision against the curated words.

const VOWELS = "aeiou";
const DOUBLES = ["bb", "cc", "dd", "ff", "gg", "ll", "mm", "nn",
                 "pp", "rr", "ss", "tt", "zz"];

const ASSIMILATED = [
  ["ac", "c"], ["af", "f"], ["ag", "g"], ["al", "l"], ["an", "n"],
  ["ap", "p"], ["ar", "r"], ["as", "s"], ["at", "t"],
  ["com", "m"], ["col", "l"], ["cor", "r"], ["il", "l"], ["im", "m"],
  ["ir", "r"], ["sup", "p"], ["suf", "f"], ["sug", "g"],
];

const SILENT = [
  [/^kn/, "kn"], [/^wr/, "wr"], [/^gn/, "gn"], [/^ps/, "ps"],
  [/^rh/, "rh"], [/^hon/, "ho"], [/^hour/, "hou"],
  [/mb$/, "mb"], [/mn$/, "mn"], [/gn$/, "gn"],
  [/stle/, "stl"], [/sten/, "ste"], [/ften/, "fte"],
  [/^sword/, "sw"], [/^answ/, "nsw"], [/dnes/, "dne"],
  [/bt$/, "bt"], [/scle$/, "scl"], [/eipt$/, "eipt"],
  [/^exh/, "xh"], [/pb/, "pb"],
];

const GREEK_CH = /ch(?=[^aeiou]|$)/;

const SH_SPELLINGS = ["tion", "sion", "cious", "tious", "cial", "tial",
                      "cient", "cience", "ciate", "tiate", "ssion", "cian"];

const SUFFIXES = [
  ["suffix-ance-ence", ["ance", "ence", "ancy", "ency"]],
  ["suffix-ary-ery",   ["ary", "ery", "ory"]],
  ["suffix-able-ible", ["able", "ible"]],
  ["suffix-ant-ent",   ["ant", "ent"]],
];

const FRENCH_ENDINGS = ["eur", "eau", "oir", "ette", "esque", "et", "que"];

// The -ce/-se noun-verb pairs. A closed set in English, and one of the few
// spelling rules that is genuinely regular: the NOUN takes c, the VERB takes s.
// 'Advice' is a noun and has ice in it. Note prophecy/prophesy end -cy/-sy, so
// the rule is about the consonant, not the last two letters.
//
// These matter more than an ordinary homophone because dictation alone cannot
// ask for one. 'The word is practice' does not tell a child which of the two
// words is wanted, so an item with no hint is not hard, it is impossible.
// weekly.js uses this table to supply the missing half of the prompt.
export const NOUN_VERB_PAIRS = new Map([
  ["advice", "noun"],    ["advise", "verb"],
  ["device", "noun"],    ["devise", "verb"],
  ["licence", "noun"],   ["license", "verb"],
  ["practice", "noun"],  ["practise", "verb"],
  ["prophecy", "noun"],  ["prophesy", "verb"],
]);

// One rule covers all ten. The generic 'homophone-trap' card says only that a
// word sounds the same as another, which for these is true and useless: this is
// one of the few English spelling rules that is completely regular, so say it.
export const PAIR_RULE =
  "The noun has a c, the verb has an s. " +
  "Advice is a thing, like ice. Advise is something you do.";

/** The disambiguating tag an item needs, or null. See NOUN_VERB_PAIRS. */
export function hintFor(word) {
  return NOUN_VERB_PAIRS.get(normalise(word)) || null;
}

const HOMOPHONES = new Set([
  "accept", "except", "affect", "effect", "aloud", "allowed", "altar", "alter",
  "ascent", "assent", "bough", "bow", "brake", "break", "cereal", "serial",
  "compliment", "complement", "desert", "dessert", "draft", "draught",
  "farther", "father", "guessed", "guest", "heard", "herd", "led", "lead",
  "licence", "license", "morning", "mourning", "past", "passed", "practice",
  "practise", "precede", "proceed", "principal", "principle", "profit",
  "prophet", "stationary", "stationery", "steal", "steel", "wary", "weary",
  "whose", "who's", "your", "you're", "their", "there", "they're",
  "advice", "advise", "device", "devise", "council", "counsel",
]);

export const SPECIFICITY = [
  "homophone-trap", "ough", "assimilated-prefix", "doubling-1-1-1",
  "greek-marker", "silent-letter", "sh-spelling", "french-ending",
  "suffix-ance-ence", "suffix-ant-ent", "suffix-able-ible", "suffix-ary-ery",
  "keep-e", "ie-ei", "ou-spelling", "double-consonant", "unique",
];
const RANK = new Map(SPECIFICITY.map((p, i) => [p, i]));
export const MAX_PATTERNS = 3;

export function normalise(text) {
  return (text || "").toLowerCase().replace(/[^a-z]/g, "");
}

function syllableGroups(word) {
  const out = [];
  const rx = /[aeiouy]+/g;
  let m;
  while ((m = rx.exec(word)) !== null) out.push([m.index, m.index + m[0].length]);
  return out;
}

export function derive(word, limit = MAX_PATTERNS) {
  const w = normalise(word);
  const patterns = [];
  const traps = [];
  const add = (pattern, trap) => {
    if (!patterns.includes(pattern)) patterns.push(pattern);
    if (trap && !traps.includes(trap)) traps.push(trap);
  };

  if (!w) return { patterns: [], traps: [] };

  for (const d of DOUBLES) if (w.includes(d)) add("double-consonant", d);

  for (const [prefix, letter] of ASSIMILATED) {
    if (w.startsWith(prefix) && w.slice(prefix.length, prefix.length + 1) === letter) {
      add("assimilated-prefix", prefix.slice(-1) + letter);
      break;
    }
  }

  const one = w.match(/([bcdfghjklmnpqrstvwxz])\1(ed|ing|er|est|en)$/);
  if (one) add("doubling-1-1-1", one[1] + one[1]);

  outer:
  for (const [pattern, endings] of SUFFIXES) {
    for (const e of endings) {
      if (w.endsWith(e) && w.length > e.length + 2) { add(pattern, e); break outer; }
    }
  }

  if (w.endsWith("ely") && w.length > 5) add("keep-e", "ely");

  for (const e of FRENCH_ENDINGS) {
    if (w.endsWith(e) && w.length > e.length + 2) { add("french-ending", e); break; }
  }

  for (const s of SH_SPELLINGS) if (w.includes(s)) { add("sh-spelling", s); break; }

  if (w.includes("ough")) add("ough", "ough");

  // Not the inflections '-ies', '-ied', '-ier', '-iest': those are the plural
  // and comparative rules wearing the same letters.
  const ie = w.match(/ie|ei/);
  if (ie && !/i(es|ed|er|est)$/.test(w)) add("ie-ei", ie[0]);

  const greek = [];
  if (w.includes("ph")) greek.push("ph");
  if (w.startsWith("rh") || w.includes("rhy")) greek.push("rh");
  if (w.startsWith("ps")) greek.push("ps");
  if (/[^aeiou]y[^aeiou]/.test(w)) greek.push("y");
  if (GREEK_CH.test(w) && greek.length) greek.push("ch");
  for (const g of greek) add("greek-marker", g);

  for (const [rx, trap] of SILENT) {
    if (rx.test(w)) { add("silent-letter", trap); break; }
  }

  if (HOMOPHONES.has(w) || NOUN_VERB_PAIRS.has(w)) add("homophone-trap", w);

  if (!patterns.length) add("unique");

  patterns.sort((a, b) =>
    (RANK.has(a) ? RANK.get(a) : SPECIFICITY.length) -
    (RANK.has(b) ? RANK.get(b) : SPECIFICITY.length));
  return { patterns: patterns.slice(0, limit), traps };
}

/** An entry the rest of the engine accepts. Curated fields stay EMPTY. */
export function makeEntry(word, source = "weekly") {
  const w = normalise(word);
  const d = derive(w);
  return {
    word: w,
    syll: "", lang: "", root: "", gloss: "",
    morph: "-", why: "", family: [], errors: [],
    traps: d.traps, patterns: d.patterns,
    on_list: false, derived: true, source,
  };
}

// syllableGroups is retained for parity with the Python module, which keeps it
// for the schwa rule that module documents but deliberately does not apply.
export { syllableGroups };
