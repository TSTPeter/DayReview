// Fill the gap: a real sentence from her dictation set, with its word left out, to type.
//
// docs/15 (6 October 2026) says what it rests on. In short: the KS2 standard is spelling
// right in her own writing, not in a list, and explicit spelling instruction transfers to
// free writing (Graham and Santangelo 2014, ES 0.94, docs/01), so here the word is
// retrieved from a sentence and typed, as the dictation does, and the sentence is the one
// she heard. The meaning and the first letter keep it fair.
//
// A game screen with the growing background (scene.js): a card right at the first go adds
// a layer, a miss takes one back. One attempt a sentence, marked as the dictation marks it.

import { answerBox } from "./answer.js";

const ROUND = 5;

let kit = null;
let box = null;
const game = { items: [], i: 0, gained: 0, results: [], used: new Set(), token: null };

export function init(k) { kit = k; }

/**
 * Where the word sits in its sentence: the part before, the word as the sentence spells it
 * (it may start with a capital), and the part after. Null unless it is there exactly once,
 * as a whole word, so a gap can never stand for two things.
 */
export function blank(sentence, word) {
  const escaped = word.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
  const re = new RegExp(`(^|[^A-Za-z-])(${escaped})(?![A-Za-z-])`, "gi");
  const hits = [...sentence.matchAll(re)];
  if (hits.length !== 1) return null;
  const m = hits[0];
  const start = m.index + m[1].length;
  return { before: sentence.slice(0, start), found: m[2], after: sentence.slice(start + m[2].length) };
}

export function start({ fresh = true } = {}) {
  const { ctx, $, shuffle } = kit;
  const week = ctx.week();
  if (fresh) {
    kit.scene.attach($("#gap-scene"));
    game.used = new Set();
  }
  const pool = week.words.filter((w) => ctx.data().words[w] && ctx.sentenceFor(w)
                                        && blank(ctx.sentenceFor(w), w));
  let fresher = pool.filter((w) => !game.used.has(w));
  if (fresher.length < ROUND) { game.used = new Set(); fresher = pool; }
  game.items = shuffle(fresher).slice(0, ROUND);
  for (const w of game.items) game.used.add(w);
  game.i = 0;
  game.gained = 0;
  game.results = [];
  $("#gap-end").hidden = true;
  $("#gap-again").hidden = true;
  $("#gap-card").hidden = false;
  $("#gap-answer").hidden = false;
  kit.paintPoints();
  ctx.show("gap");
  item();
}

function sentenceWith(node) {
  const { ctx, $ } = kit;
  const word = game.items[game.i];
  const { before, after } = blank(ctx.sentenceFor(word), word);
  $("#gap-sentence").replaceChildren(document.createTextNode(before), node,
                                     document.createTextNode(after));
}

function item() {
  const { ctx, $ } = kit;
  const word = game.items[game.i];
  const token = (game.token = {});
  const letters = word.replace(/-/g, "").length;
  const gap = ctx.el("span", { className: "gap-blank" });
  gap.style.setProperty("--len", String(letters));
  gap.setAttribute("role", "img");
  gap.setAttribute("aria-label", `blank, ${letters} letters`);
  sentenceWith(gap);
  $("#gap-count").textContent = `Sentence ${game.i + 1} of ${game.items.length}`;
  $("#gap-meaning").textContent = `Meaning: ${ctx.data().words[word].meaning}`;
  // First letter and length: enough to make it fair, no more (as in the bonus round).
  $("#gap-hint").textContent = `Starts with "${word[0]}". ${letters} letters.`;
  $("#gap-next").hidden = true;
  box.open(word, { points: kit.POINTS.gap, done: (r) => answered(word, token, r) });
}

async function answered(word, token, r) {
  if (game.token !== token) return;          // she left, and a new round has begun
  const { ctx } = kit;
  const { found } = blank(ctx.sentenceFor(word), word);
  sentenceWith(ctx.el("span", { className: `gap-filled ${r.correct ? "right" : "wrong"}`,
                                textContent: found }));
  const gained = r.correct ? kit.POINTS.gap : 0;
  game.gained += gained;
  game.results.push({ word, first_try: r.correct, error_type: r.decision.type });
  if (r.correct) kit.scene.up(); else kit.scene.down();
  const last = game.i + 1 >= game.items.length;
  const next = kit.$("#gap-next");
  next.textContent = last ? "Finish" : "Next sentence";
  next.hidden = false;
  next.focus();
  await kit.award(gained);
}

async function advance() {
  game.i += 1;
  if (game.i < game.items.length) { item(); return; }
  const { ctx, $ } = kit;
  ctx.sfx.play("complete");
  game.token = null;
  box.close();
  const firsts = game.results.filter((r) => r.first_try).length;
  const wrong = game.results.filter((r) => !r.first_try).map((r) => r.word);
  $("#gap-count").textContent = "Round finished";
  $("#gap-card").hidden = true;
  $("#gap-answer").hidden = true;
  $("#gap-next").hidden = true;
  $("#gap-end-text").textContent = `${firsts} of ${game.results.length} right at the first go.`
    + (game.gained ? `  +${game.gained} points this round.` : "");
  $("#gap-end-words").textContent = wrong.length ? `Worth another look: ${wrong.join(", ")}.` : "Every sentence filled.";
  $("#gap-end").hidden = false;
  $("#gap-again").hidden = false;
  $("#gap-again").focus();
  await kit.logRound("gap", game.results, game.gained);
}

function leave() {
  game.token = null;
  box.close();
  kit.openHub();
}

export function wire() {
  const { $ } = kit;
  box = answerBox(kit, $("#gap-answer"), { label: "Type the missing word", where: "gap" });
  $("#gap-next").onclick = advance;
  $("#gap-again").onclick = () => start({ fresh: false });
  $("#gap-quit").onclick = leave;
}
