// Port of engine/classify.py. See docs/05-architecture.md decision 1.
//
// docs/05 says the front end never reimplements the engine, because "two
// implementations drift and the dataset becomes uninterpretable". Running with no
// server means the classifier has to execute in the browser, so this file breaks
// that rule and pays for it with tests/test_parity.py, which runs BOTH
// implementations over every curated misspelling plus several thousand generated
// mutations and fails on the first disagreement. Drift is caught by CI, not by hope.
//
// Keep this a mechanical port. If a rule changes, change classify.py first, then
// mirror it here, then run the parity test.

// --- a faithful subset of Python's difflib.SequenceMatcher -----------------
//
// Only the no-junk path is ported. difflib's autojunk heuristic needs len(b) >= 200
// and the longest word here is 13 characters, so bjunk is always empty and the two
// junk-extension loops in find_longest_match are dead code. Everything else,
// including the tie-breaking (earliest in a, then earliest in b), is reproduced
// exactly, because the opcode boundaries decide which rule fires.

function findLongestMatch(a, b, b2j, alo, ahi, blo, bhi) {
  let besti = alo, bestj = blo, bestsize = 0;
  let j2len = new Map();
  for (let i = alo; i < ahi; i++) {
    const newj2len = new Map();
    const js = b2j.get(a[i]) || [];
    for (const j of js) {
      if (j < blo) continue;
      if (j >= bhi) break;
      const k = (j2len.get(j - 1) || 0) + 1;
      newj2len.set(j, k);
      if (k > bestsize) { besti = i - k + 1; bestj = j - k + 1; bestsize = k; }
    }
    j2len = newj2len;
  }
  while (besti > alo && bestj > blo && a[besti - 1] === b[bestj - 1]) {
    besti--; bestj--; bestsize++;
  }
  while (besti + bestsize < ahi && bestj + bestsize < bhi &&
         a[besti + bestsize] === b[bestj + bestsize]) {
    bestsize++;
  }
  return [besti, bestj, bestsize];
}

function matchingBlocks(a, b) {
  const la = a.length, lb = b.length;
  const b2j = new Map();
  for (let j = 0; j < lb; j++) {
    if (!b2j.has(b[j])) b2j.set(b[j], []);
    b2j.get(b[j]).push(j);
  }
  const queue = [[0, la, 0, lb]];
  const blocks = [];
  while (queue.length) {
    const [alo, ahi, blo, bhi] = queue.pop();
    const [i, j, k] = findLongestMatch(a, b, b2j, alo, ahi, blo, bhi);
    if (k) {
      blocks.push([i, j, k]);
      if (alo < i && blo < j) queue.push([alo, i, blo, j]);
      if (i + k < ahi && j + k < bhi) queue.push([i + k, ahi, j + k, bhi]);
    }
  }
  // Python sorts tuples lexicographically.
  blocks.sort((x, y) => x[0] - y[0] || x[1] - y[1] || x[2] - y[2]);
  let i1 = 0, j1 = 0, k1 = 0;
  const merged = [];
  for (const [i2, j2, k2] of blocks) {
    if (i1 + k1 === i2 && j1 + k1 === j2) {
      k1 += k2;
    } else {
      if (k1) merged.push([i1, j1, k1]);
      i1 = i2; j1 = j2; k1 = k2;
    }
  }
  if (k1) merged.push([i1, j1, k1]);
  merged.push([la, lb, 0]);
  return merged;
}

export function getOpcodes(a, b) {
  let i = 0, j = 0;
  const out = [];
  for (const [ai, bj, size] of matchingBlocks(a, b)) {
    let tag = "";
    if (i < ai && j < bj) tag = "replace";
    else if (i < ai) tag = "delete";
    else if (j < bj) tag = "insert";
    if (tag) out.push([tag, i, ai, j, bj]);
    i = ai + size; j = bj + size;
    if (size) out.push(["equal", ai, i, bj, j]);
  }
  return out;
}

// --- the classifier --------------------------------------------------------

const VOWELS = new Set("aeiou");

const SUFFIX_PAIRS = [
  ["ant", "ent"], ["ance", "ence"], ["ancy", "ency"],
  ["ary", "ery"], ["ary", "ory"], ["ery", "ory"],
  ["able", "ible"], ["ise", "ize"], ["tion", "sion"], ["al", "le"],
  ["ous", "us"], ["ly", "ley"], ["er", "or"], ["our", "or"],
];

const SOUND_CLASSES = [
  ["f", ["ph", "ff", "f"]],
  ["k", ["ck", "ch", "qu", "c", "k"]],
  ["s", ["sc", "ss", "c", "s"]],
  ["S", ["sh", "ci", "ti", "ss", "ch"]],
  ["j", ["dge", "ge", "j", "g"]],
  ["z", ["ze", "se", "z", "s"]],
  ["E", ["ee", "ea", "ie", "ei", "e"]],
  ["I", ["y", "i"]],
  ["A", ["eigh", "ai", "ay", "ei", "a"]],
  ["O", ["ough", "ow", "oa", "ou", "o"]],
  ["R", ["our", "er", "ur", "ir", "or", "ar"]],
];

const SPLITTERS = { "'": "an apostrophe", "’": "an apostrophe",
                    "-": "a hyphen", "‐": "a hyphen", "‑": "a hyphen" };

export function normalise(text) {
  return (text || "").toLowerCase().replace(/[^a-z]/g, "");
}

export function markSchemePenalty(raw, word) {
  raw = (raw || "").trim();
  for (const [ch, name] of Object.entries(SPLITTERS)) {
    if (raw.includes(ch) && !word.includes(ch)) {
      return `the letters are right, but ${name} inside a word scores zero`;
    }
  }
  if (/\s/.test(raw)) {
    return "the letters are right, but they are split into separate parts, which scores zero";
  }
  return null;
}

// Python's str.replace swaps EVERY occurrence; JS's swaps only the first.
function replaceAll(s, find, repl) { return s.split(find).join(repl); }

export function soundKey(word) {
  let w = normalise(word);
  w = w.replace(/sci(?=[aeou])/g, "S");
  w = w.replace(/[cst]i(?=[aeou])/g, "S");
  w = w.replace(/c(?=[eiy])/g, "s");
  w = w.replace(/g(?=[eiy])/g, "j");
  w = replaceAll(w, "x", "ks");
  for (const [canon, spellings] of SOUND_CLASSES) {
    // Python: sorted(spellings, key=len, reverse=True). Stable, so equal lengths
    // keep their declared order. Array.prototype.sort is stable in modern engines.
    const ordered = spellings.slice().sort((p, q) => q.length - p.length);
    for (const sp of ordered) w = replaceAll(w, sp, canon);
  }
  w = w.replace(/(.)\1+/g, "$1");
  w = w.replace(/([bcdfghjklmnpqrstvwxyz])e$/, "$1");
  return replaceAll(w, "h", "");
}

export function frameKey(word) {
  return soundKey(word).replace(/[aeiouAEIO]/g, "@");
}

function edits(target, attempt) {
  const out = [];
  for (const [tag, i1, i2, j1, j2] of getOpcodes(target, attempt)) {
    if (tag !== "equal") {
      out.push({ tag, target: target.slice(i1, i2), attempt: attempt.slice(j1, j2),
                 at: i1, end: i2, j: j1, jend: j2 });
    }
  }
  return out;
}

function trapAt(entry, start, end) {
  const target = normalise(entry.word);
  for (const trap of entry.traps) {
    let i = target.indexOf(trap);
    while (i !== -1) {
      if (start <= i + trap.length && end >= i) return trap;
      i = target.indexOf(trap, i + 1);
    }
  }
  return null;
}

function isTransposition(target, attempt) {
  if (target.length !== attempt.length) return null;
  const diff = [];
  for (let i = 0; i < target.length; i++) if (target[i] !== attempt[i]) diff.push(i);
  if (diff.length === 2 && diff[1] - diff[0] === 1) {
    const [i, j] = diff;
    if (target[i] === attempt[j] && target[j] === attempt[i]) return target.slice(i, j + 1);
  }
  return null;
}

function vowelsOnlySwap(target, attempt) {
  if (target.length !== attempt.length) return false;
  const diff = [];
  for (let i = 0; i < target.length; i++) {
    if (target[i] !== attempt[i]) diff.push([target[i], attempt[i]]);
  }
  return diff.length > 0 && diff.every(([t, a]) => VOWELS.has(t) && VOWELS.has(a));
}

function doubling(edit, target, attempt) {
  const t = edit.target, a = edit.attempt, i = edit.at;
  if (edit.tag === "delete" && t.length === 1 && !VOWELS.has(t)) {
    const nb = new Set([i ? target[i - 1] : "", i + 1 < target.length ? target[i + 1] : ""]);
    if (nb.has(t)) return ["missed the double", t + t];
  }
  if (edit.tag === "insert" && a.length === 1 && !VOWELS.has(a)) {
    const j = attempt.indexOf(a, Math.max(0, i - 1));
    const nb = new Set([j > 0 ? attempt[j - 1] : "",
                        j + 1 < attempt.length ? attempt[j + 1] : ""]);
    if (nb.has(a)) return ["doubled a letter that stays single", a + a];
  }
  if (edit.tag === "replace" && t.length === 2 && t[0] === t[1] && a === t[0]) {
    return ["missed the double", t];
  }
  if (edit.tag === "replace" && a.length === 2 && a[0] === a[1] && t === a[0]) {
    return ["doubled a letter that stays single", a];
  }
  return null;
}

function sameSoundSwap(edit, target, attempt) {
  for (const pad of [0, 1, 2]) {
    const ts = target.slice(Math.max(0, edit.at - pad), edit.end + pad);
    const as_ = attempt.slice(Math.max(0, edit.j - pad), edit.jend + pad);
    if (!ts || !as_ || ts === as_) continue;
    if (soundKey(ts) === soundKey(as_)) {
      return [target.slice(edit.at, edit.end) || ts, attempt.slice(edit.j, edit.jend) || as_];
    }
  }
  return null;
}

function suffixSwap(target, attempt) {
  for (const [a, b] of SUFFIX_PAIRS) {
    for (const [x, y] of [[a, b], [b, a]]) {
      if (target.endsWith(x) && attempt.endsWith(y) &&
          target.slice(0, -x.length) === attempt.slice(0, -y.length)) {
        return [x, y];
      }
    }
  }
  return null;
}

export function classify(rawAttempt, entry) {
  const target = normalise(entry.word);
  const raw = (rawAttempt || "").trim();
  const attempt = normalise(raw);
  const lettersRight = target === attempt;
  const penalty = lettersRight ? markSchemePenalty(raw, entry.word) : null;

  const r = { word: entry.word, attempt, raw, correct: lettersRight && penalty === null,
              type: null, detail: "", edits: [], patterns: [],
              sounds_right: lettersRight, trap: null, mark_scheme: penalty };

  if (r.correct) { r.type = "correct"; return r; }
  if (lettersRight) { r.type = "mark-scheme"; r.detail = penalty; r.patterns = []; return r; }

  r.edits = edits(target, attempt);
  r.sounds_right = soundKey(target) === soundKey(attempt);
  const single = r.edits.length === 1 ? r.edits[0] : null;
  r.trap = trapAt(entry, r.edits[0].at, r.edits[r.edits.length - 1].end);
  const pats = entry.patterns;

  const out = (kind, detail, patterns) => {
    r.type = kind; r.detail = detail; r.patterns = patterns; return r;
  };

  // 2. transposition
  const trans = isTransposition(target, attempt);
  if (trans) return out("transposition", `letters swapped around '${trans}'`, ["sequencing"]);
  if ([...target].sort().join("") === [...attempt].sort().join("")) {
    if (vowelsOnlySwap(target, attempt)) {
      const swaps = [...target].map((c, i) => [c, attempt[i]])
        .filter(([t, a]) => t !== a).map(([t, a]) => `'${a}' for '${t}'`).join(", ");
      return out("vowel-choice", `right consonants, wrong vowel: ${swaps}`,
                 pats.filter((p) => p === "schwa").length ? pats.filter((p) => p === "schwa") : ["schwa"]);
    }
    return out("transposition", "every letter is right, the order is not", ["sequencing"]);
  }

  // 3. doubling
  for (const e of r.edits) {
    const d = doubling(e, target, attempt);
    if (d) {
      const [kind, letters] = d;
      const p = pats.filter((x) => x.includes("doubl"));
      return out("doubling", `${kind}: '${letters}'`, p.length ? p : ["double-consonant"]);
    }
  }

  // 4. suffix choice
  const swap = suffixSwap(target, attempt);
  if (swap) {
    const [right, wrong] = swap;
    const p = pats.filter((x) => x.startsWith("suffix"));
    return out("suffix-choice", `wrote -${wrong}, needs -${right}`,
               p.length ? p : ["suffix-choice"]);
  }

  // 5. base change
  if (pats.includes("base-change") && single &&
      (single.tag === "insert" || single.tag === "delete")) {
    return out("base-change", "kept the base word whole instead of changing it", ["base-change"]);
  }

  // 6. same sound, different letters
  for (const e of r.edits) {
    const sw = sameSoundSwap(e, target, attempt);
    if (sw) {
      const [t, a] = sw;
      const keep = ["greek-marker", "sh-spelling", "soft-c-g", "ie-ei", "ou-spelling"];
      const p = pats.filter((x) => keep.includes(x));
      return out("grapheme-choice", `wrote '${a}' where English wants '${t}'`,
                 p.length ? p : ["grapheme-choice"]);
    }
  }

  // 7. silent letter dropped
  const dropped = r.edits.filter((e) => e.tag === "delete");
  if (dropped.length && pats.includes("silent-letter")) {
    const letters = dropped.map((e) => e.target).join("");
    const where = r.trap ? ` from the '${r.trap}'` : "";
    return out("silent-letter", `dropped the silent '${letters}'${where}`, ["silent-letter"]);
  }

  // 8. plain omission or addition
  if (single && (single.tag === "delete" || single.tag === "insert")) {
    const letters = single.target || single.attempt;
    const verb = single.tag === "delete" ? "left out" : "added an extra";
    const where = r.trap ? `, inside the '${r.trap}'` : "";
    const kind = single.tag === "delete" ? "omission" : "addition";
    const p = pats.filter((x) => x === "schwa" || x === "silent-letter");
    return out(kind, `${verb} '${letters}'${where}`, p.length ? p : ["letter-level"]);
  }

  // 9. vowel choice under a schwa
  if (frameKey(target) === frameKey(attempt)) {
    const wrong = r.edits.map((e) => `'${e.attempt || "-"}' for '${e.target || "-"}'`).join(", ");
    return out("vowel-choice", `right consonants, wrong vowel: ${wrong}`, ["schwa"]);
  }

  // 10. a straight letter swap we cannot pin to a rule
  if (r.edits.every((e) => e.tag === "replace")) {
    const wrong = r.edits
      .map((e) => `'${e.attempt}' where the word needs '${e.target}'`).join(", ");
    const where = r.trap ? ` (inside the '${r.trap}')` : "";
    const keep = ["schwa", "greek-marker", "sh-spelling", "soft-c-g", "ie-ei"];
    const p = pats.filter((x) => keep.includes(x));
    return out("letter-swap", wrong + where, p.length ? p : ["grapheme-choice"]);
  }

  // 11. more than one thing went wrong
  return out("multiple-errors",
             r.edits.map((e) => `${e.tag} '${e.target}'->'${e.attempt}'`).join("; "),
             pats.slice(0, 1));
}

export const HEADLINES = {
  "mark-scheme": "Every letter is right. The test would still mark this wrong.",
  "transposition": "The letters are all right, the order slipped.",
  "doubling": "This is a doubling decision, not a sound.",
  "suffix-choice": "The ending is the decision point.",
  "base-change": "The base word changes when the ending goes on.",
  "grapheme-choice": "You spelled the sound correctly. English chose other letters.",
  "silent-letter": "There is a letter here you cannot hear.",
  "omission": "One letter went missing.",
  "addition": "One letter too many.",
  "vowel-choice": "You heard it right. The lazy vowel is the trap.",
  "letter-swap": "One letter is standing in for another.",
  "multiple-errors": "More than one thing slipped here. Take it syllable by syllable.",
};

export function feedback(diagnosis, entry) {
  if (diagnosis.correct) {
    return { headline: "Correct.", why: entry.why, practise: [] };
  }
  return {
    headline: HEADLINES[diagnosis.type],
    detail: diagnosis.detail,
    structure: entry.morph,
    origin: `${entry.lang}: ${entry.root}, ${entry.gloss}`,
    why: entry.why,
    practise: entry.family.slice(0, 3),
  };
}
