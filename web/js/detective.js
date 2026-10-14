// Word detective: a mystery word, and clues that open one at a time.
//
// The first clue is free, the meaning. She types a guess; if it is not right the next clue
// opens by itself, and she can ask for the next one whenever she likes. The sooner she knows
// it the more it is worth, 15, 10 or 5, so a clue is cheap enough to ask for rather than
// stay stuck, and dear enough to try first. Learners often use on-demand help poorly, and
// using it well goes with learning more (Aleven et al. 2003, docs/15), which is why the
// help costs something and arrives in a fixed order.
//
// Rests on judgement: graded cues for retrieval, a typed answer, the word marked at the end.
// A wrong guess is cleared at once, as in hangman, so a misspelling is not left to look at,
// and the last wrong one is marked against the word with its rule.
//
// One of the bonus rounds (bonus.js), with the growing background (scene.js).

import { classify, feedback } from "./engine/classify.js";

const ROUND = 5;
const VALUES = [15, 10, 5];

let kit = null;
const game = { items: [], i: 0, rung: 0, wrong: 0, last: "", gained: 0, results: [],
               token: null, over: false };

export function init(k) { kit = k; }

const clueText = (word, rung) => {
  const c = kit.ctx.data().words[word];
  const letters = word.replace(/-/g, "").length;
  return [
    `It means: ${c.meaning}`,
    `Where it comes from: ${c.origin.lang}, a word meaning ‘${c.origin.gloss}’.`,
    `It has ${letters} letters and starts with “${word[0]}”.`,
  ][rung];
};

export function start(words) {
  const { ctx, $ } = kit;
  kit.scene.attach($("#det-scene"));
  game.items = words.slice(0, ROUND);
  game.i = 0;
  game.gained = 0;
  game.results = [];
  $("#det-end").hidden = true;
  $("#det-case").hidden = false;
  $("#det-score").textContent = "Score: 0";
  ctx.show("detective");
  item();
}

function paintClues() {
  const { ctx, $ } = kit;
  const word = game.items[game.i];
  $("#det-clues").replaceChildren(...Array.from({ length: game.rung + 1 }, (_, r) =>
    ctx.el("li", { textContent: clueText(word, r) })));
  const worth = VALUES[game.rung];
  $("#det-worth").textContent = game.over ? ""
    : `Worth ${worth} now${game.rung < VALUES.length - 1 ? `, ${VALUES[game.rung + 1]} after another clue` : ""}.`;
  $("#det-more").hidden = game.over || game.rung >= VALUES.length - 1;
}

function item() {
  const { $ } = kit;
  const token = (game.token = {});
  game.rung = 0;
  game.wrong = 0;
  game.last = "";
  game.over = false;
  $("#det-count").textContent = `Case ${game.i + 1} of ${game.items.length}`;
  $("#det-input").value = "";
  $("#det-input").disabled = false;
  $("#det-go").disabled = true;
  $("#det-guess").hidden = false;
  $("#det-result").hidden = true;
  $("#det-next").hidden = true;
  kit.say("#det-feedback", "", "");
  paintClues();
  $("#det-input").focus();
  return token;
}

async function guess() {
  const { ctx, $ } = kit;
  const raw = $("#det-input").value;
  if (game.over || !raw.trim()) return;
  const word = game.items[game.i];
  const entry = ctx.entryFor(word);
  const d = classify(raw, entry);
  $("#det-input").value = "";
  $("#det-go").disabled = true;
  if (d.correct) { await close(true, d); return; }
  game.last = d;
  if (game.wrong === 0) kit.scene.down();
  game.wrong += 1;
  ctx.sfx.play("notyet");
  if (game.rung < VALUES.length - 1) {
    game.rung += 1;
    paintClues();
    kit.say("#det-feedback", "wrong", "Not it. Here is another clue.");
    return;
  }
  await close(false, d);
}

function more() {
  if (game.over || game.rung >= VALUES.length - 1) return;
  game.rung += 1;
  kit.say("#det-feedback", "", "");
  paintClues();
  kit.$("#det-input").focus();
}

async function close(solved, d) {
  const { ctx, $ } = kit;
  const word = game.items[game.i];
  const entry = ctx.entryFor(word);
  game.over = true;
  const gained = solved ? VALUES[game.rung] : 0;
  game.gained += gained;
  game.results.push({ word, correct: solved, first_try: solved && game.wrong === 0,
                      clues: game.rung + 1, wrong: game.wrong, error_type: d.type });
  if (solved && game.wrong === 0) kit.scene.up();
  $("#det-input").disabled = true;
  $("#det-guess").hidden = true;
  paintClues();
  const verdict = $("#det-verdict");
  verdict.className = `verdict ${solved ? "right" : "wrong"}`;
  verdict.textContent = solved ? `Case solved!${gained ? `  +${gained}` : ""}` : feedback(d, entry).headline;
  // A missed case shows her last attempt against the word, and the rule.
  $("#det-marked").replaceChildren(solved ? ctx.el("span", { className: "whole" }, kit.partSpans(word))
                                          : ctx.markedUp(word, d));
  $("#det-why").textContent = solved ? entry.why || "" : `${word}. ${entry.why || ""}`;
  $("#det-support").replaceChildren();
  $("#det-support").hidden = true;
  if (game.wrong > 0) {
    const card = ctx.supports.render(word);
    if (card) { $("#det-support").replaceChildren(card); $("#det-support").hidden = false; ctx.supports.logShown(word, "detective"); }
  }
  $("#det-result").hidden = false;
  $("#det-score").textContent = `Score: ${game.gained}`;
  ctx.sfx.play(solved ? "correct" : "notyet");
  const last = game.i + 1 >= game.items.length;
  $("#det-next").textContent = last ? "Finish" : "Next case";
  $("#det-next").hidden = false;
  $("#det-next").focus();
  await kit.award(gained);
}

async function advance() {
  game.i += 1;
  if (game.i < game.items.length) { item(); return; }
  const { ctx, $ } = kit;
  ctx.sfx.play("complete");
  game.token = null;
  const solved = game.results.filter((r) => r.correct);
  const open = game.results.filter((r) => !r.correct).map((r) => r.word);
  $("#det-count").textContent = "All cases closed";
  $("#det-case").hidden = true;
  $("#det-result").hidden = true;
  $("#det-next").hidden = true;
  $("#det-end-text").textContent = `You scored ${game.gained} in the bonus round.`;
  $("#det-end-words").textContent = `${solved.length} of ${game.results.length} cases solved.`
    + (open.length ? ` Worth another look: ${open.join(", ")}.` : "");
  $("#det-end").hidden = false;
  $("#det-more-rounds").hidden = kit.tickets() <= 0;
  $("#det-quit").focus();
  await kit.logRound("bonus", game.results, game.gained, { kind: "detective" });
}

function leave() {
  game.token = null;
  kit.openHub();
}

export function wire() {
  const { $ } = kit;
  $("#det-input").addEventListener("input", (e) => { $("#det-go").disabled = !e.target.value.trim(); });
  $("#det-input").addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); guess(); } });
  $("#det-go").onclick = guess;
  $("#det-more").onclick = more;
  $("#det-next").onclick = advance;
  $("#det-more-rounds").onclick = () => kit.startBonus();
  $("#det-quit").onclick = leave;
}
