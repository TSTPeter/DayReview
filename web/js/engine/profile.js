// Port of engine/profile.py. See that file for what the two headline numbers mean and,
// more importantly, for the honest caveat on orthographic_choice_rate: our
// operationalisation is structural, theirs was expert judgement of writing samples, so
// the absolute value is NOT comparable with the study's 14%. The trend is the signal.

export const ORTHOGRAPHIC_CHOICE_PATTERNS = new Set([
  "schwa", "sh-spelling", "ie-ei", "soft-c-g", "greek-marker",
  "french-ending", "ou-spelling", "ough", "homophone-trap",
  "suffix-ant-ent", "suffix-ance-ence", "suffix-ary-ery", "suffix-able-ible",
]);

export const CONFIDENCE_FLOOR = 24;
export const CONFIDENCE_SOLID = 48;

export const needsOrthographicChoice = (entry) =>
  (entry.patterns || []).some((p) => ORTHOGRAPHIC_CHOICE_PATTERNS.has(p));

export function confidenceFor(n) {
  if (n < CONFIDENCE_FLOOR) return "low";
  if (n < CONFIDENCE_SOLID) return "medium";
  return "high";
}

const r3 = (x) => Math.round(x * 1000) / 1000;

export function compute(marks, strategyResponses = []) {
  const total = marks.length;
  const errors = marks.filter((m) => !m.diagnosis.correct);
  const correct = marks.filter((m) => m.diagnosis.correct);

  const soundsRight = errors.filter((m) => m.diagnosis.sounds_right).length;
  const choiceCorrect = correct.filter((m) => needsOrthographicChoice(m.entry)).length;

  const mix = {};
  for (const m of errors) mix[m.diagnosis.type] = (mix[m.diagnosis.type] || 0) + 1;
  const errorMix = Object.fromEntries(
    Object.entries(mix).map(([k, v]) => [k, r3(v / (errors.length || 1))])
      .sort((a, b) => b[1] - a[1]));

  const seen = {}, right = {};
  for (const m of marks) {
    for (const p of m.entry.patterns || []) {
      seen[p] = (seen[p] || 0) + 1;
      if (m.diagnosis.correct) right[p] = (right[p] || 0) + 1;
    }
  }
  const patternStrength = {};
  for (const p of Object.keys(seen).sort()) patternStrength[p] = r3((right[p] || 0) / seen[p]);

  const off = marks.filter((m) => m.entry.on_list === false);
  const on = marks.filter((m) => m.entry.on_list !== false);
  const acc = (rows) =>
    rows.length ? r3(rows.filter((m) => m.diagnosis.correct).length / rows.length) : null;

  const strategy = {};
  if (strategyResponses.length) {
    const c = {};
    for (const s of strategyResponses) c[s] = (c[s] || 0) + 1;
    for (const [k, v] of Object.entries(c)) strategy[k] = r3(v / strategyResponses.length);
  }

  return {
    items: total,
    accuracy: acc(marks),
    phonological_reliance: errors.length ? r3(soundsRight / errors.length) : null,
    orthographic_choice_rate: correct.length ? r3(choiceCorrect / correct.length) : null,
    error_mix: errorMix,
    pattern_strength: patternStrength,
    transfer: { on_list: acc(on), off_list: acc(off), off_list_items: off.length },
    confidence: confidenceFor(total),
    strategy_self_report: strategy,
  };
}

export function narrate(p) {
  const out = [];
  if (p.confidence === "low") {
    out.push(`Only ${p.items} items so far, so treat all of this as a hint rather than a ` +
             `finding. It needs ${CONFIDENCE_FLOOR} to be worth reading.`);
  }
  const pr = p.phonological_reliance;
  if (pr !== null && pr !== undefined) {
    out.push(pr >= 0.6
      ? `${Math.round(pr * 100)}% of her errors read aloud correctly. She is spelling by ` +
        `sound and choosing the wrong legal letters. That is an orthographic problem, not ` +
        `a phonics one, and more phonics will not shift it.`
      : `${Math.round(pr * 100)}% of her errors read aloud correctly. A good share of the ` +
        `misses change the sound of the word, so some are decoding slips rather than ` +
        `orthographic choices.`);
  }
  const t = p.transfer;
  if (t.off_list !== null && t.on_list !== null) {
    const gap = t.on_list - t.off_list;
    out.push(gap >= 0.2
      ? `She scores ${Math.round(t.on_list * 100)}% on taught words but ` +
        `${Math.round(t.off_list * 100)}% on untaught words using the same rules. That gap ` +
        `says she is learning words rather than rules, which is what the interleaving ` +
        `research warns about.`
      : `Taught words ${Math.round(t.on_list * 100)}%, untaught words using the same rules ` +
        `${Math.round(t.off_list * 100)}%. The rules are travelling.`);
  }
  const weak = Object.entries(p.pattern_strength)
    .filter(([, v]) => v < 0.5).map(([k]) => k).sort();
  if (weak.length) out.push("Weakest rules: " + weak.slice(0, 5).join(", ") + ".");
  return out;
}
