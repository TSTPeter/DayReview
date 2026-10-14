// Treasure chests: six locked chests, each opened by spelling its word.
//
// A chest's clue is the word's meaning, its first letter and its length, and she types the
// word, marked as the dictation marks it. A chest opened at the first go shows a paper animal
// and adds a layer to the growing background (scene.js); one that is missed stays shut, and the
// word is marked against what she typed, with its rule. The chests come one after another, so
// there is nothing to choose and no board to find her way round: the first build of the bonus
// round was a board of squares, and Peter found it not fun.
//
// Everything is for this sitting only. The animals are not kept: nothing is collected from
// one day to the next, so there is nothing to come back for (docs/11, no streaks).
//
// Rests on judgement. The typed recall inside it is what docs/01 supports.
//
// One of the bonus rounds (bonus.js).

import { ART } from "./rewards.js";
import { answerBox } from "./answer.js";

const ROUND = 6;
const ANIMALS = ["bird", "fish", "cat", "owl", "whale", "fox", "bee", "snail", "kite",
                 "boat", "tree", "flower", "mushroom", "star", "windmill", "lighthouse"];

let kit = null;
let box = null;
const game = { items: [], i: 0, animals: [], states: [], gained: 0, results: [], token: null };

export function init(k) { kit = k; }

// A chest in cut paper: a plum lid on a kraft body with a brass lock. Open, the lid tips back and
// the animal sits in it.
const CHEST = (open, animal) => `<svg viewBox="0 0 64 64" aria-hidden="true">
  ${open ? `<g transform="translate(14 -2) scale(.55)">${animal}</g>` : ""}
  <rect x="8" y="32" width="48" height="24" rx="4" fill="#e8dcc3"/>
  <rect x="8" y="42" width="48" height="4" fill="#d6c7a6"/>
  ${open ? `<path d="M8 32 C6 20 14 14 20 14 L22 24 Z" fill="#6b4c7a"/>`
         : `<path d="M8 34 C8 18 56 18 56 34 Z" fill="#6b4c7a"/><rect x="29" y="32" width="6" height="10" rx="2" fill="#e0a32e"/>`}
</svg>`;

const inner = (name) => {
  const doc = new DOMParser().parseFromString(ART[name], "image/svg+xml").documentElement;
  return doc.innerHTML;
};

export function start(words) {
  const { ctx, $, shuffle } = kit;
  kit.scene.attach($("#chest-scene"));
  game.items = words.slice(0, ROUND);
  game.animals = shuffle(ANIMALS).slice(0, game.items.length);
  game.states = game.items.map(() => "locked");
  game.i = 0;
  game.gained = 0;
  game.results = [];
  $("#chest-end").hidden = true;
  $("#chest-card").hidden = false;
  $("#chest-score").textContent = "Score: 0";
  paintChests();
  ctx.show("chests");
  item();
}

function paintChests() {
  const { ctx, $ } = kit;
  $("#chest-grid").replaceChildren(...game.items.map((_, k) => {
    const state = game.states[k];
    const d = ctx.el("div", { className: `chest ${state}${k === game.i && state === "locked" ? " current" : ""}` });
    d.dataset.state = state;
    d.innerHTML = CHEST(state === "open", state === "open" ? inner(game.animals[k]) : "");
    d.setAttribute("aria-label", `Chest ${k + 1}, ${state === "open" ? "open" : state === "missed" ? "still locked" : "locked"}`);
    return d;
  }));
}

function item() {
  const { ctx, $ } = kit;
  const word = game.items[game.i];
  const token = (game.token = {});
  const letters = word.replace(/-/g, "").length;
  $("#chest-count").textContent = `Chest ${game.i + 1} of ${game.items.length}`;
  $("#chest-clue").textContent = ctx.data().words[word].meaning;
  $("#chest-hint").textContent = `Starts with "${word[0]}". ${letters} letters.`;
  $("#chest-next").hidden = true;
  paintChests();
  box.open(word, { points: kit.POINTS.chests, done: (r) => answered(word, token, r) });
}

async function answered(word, token, r) {
  if (game.token !== token) return;
  const { $ } = kit;
  game.states[game.i] = r.correct ? "open" : "missed";
  const gained = r.correct ? kit.POINTS.chests : 0;
  game.gained += gained;
  game.results.push({ word, correct: r.correct, first_try: r.correct, error_type: r.decision.type });
  if (r.correct) kit.scene.up(); else kit.scene.down();
  paintChests();
  $("#chest-score").textContent = `Score: ${game.gained}`;
  const last = game.i + 1 >= game.items.length;
  $("#chest-next").textContent = last ? "Finish" : "Next chest";
  $("#chest-next").hidden = false;
  $("#chest-next").focus();
  await kit.award(gained);
}

async function advance() {
  game.i += 1;
  if (game.i < game.items.length) { item(); return; }
  const { ctx, $ } = kit;
  ctx.sfx.play("complete");
  game.token = null;
  box.close();
  const opened = game.results.filter((r) => r.correct).length;
  const shut = game.results.filter((r) => !r.correct).map((r) => r.word);
  $("#chest-count").textContent = "All the chests tried";
  $("#chest-card").hidden = true;
  $("#chest-next").hidden = true;
  paintChests();
  $("#chest-end-text").textContent = `You scored ${game.gained} in the bonus round.`;
  $("#chest-end-words").textContent = `${opened} of ${game.results.length} chests opened.`
    + (shut.length ? ` Worth another look: ${shut.join(", ")}.` : "");
  $("#chest-end").hidden = false;
  $("#chest-more-rounds").hidden = kit.tickets() <= 0;
  $("#chest-quit").focus();
  await kit.logRound("bonus", game.results, game.gained, { kind: "chests" });
}

function leave() {
  game.token = null;
  box.close();
  kit.openHub();
}

export function wire() {
  const { $ } = kit;
  box = answerBox(kit, $("#chest-answer"), { label: "Type the word", where: "chests" });
  $("#chest-next").onclick = advance;
  $("#chest-more-rounds").onclick = () => kit.startBonus();
  $("#chest-quit").onclick = leave;
}
