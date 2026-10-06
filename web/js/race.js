// Race the paper snail: six typed cards, and a race won by spelling.
//
// Each card is a word to type from its meaning, the first letter and the length, marked as the
// dictation marks it. A card right at the first go moves her two squares along the track; the
// snail moves one after every card whatever happens, so it is a slow, steady rival that cannot
// be hurried and cannot be failed by. There is no timer: the race is turn by turn, and it is
// decided by how many she spells, not by how fast she types.
//
// Rests on judgement: a race against a computer rival with a fixed pace is a familiar frame,
// and nothing here is competition with another child (docs/16). The words are typed recall,
// which is what docs/01 supports.
//
// One of the bonus rounds (bonus.js), with the growing background (scene.js).

import { ART } from "./rewards.js";
import { answerBox } from "./answer.js";

const ROUND = 6;
const TRACK = 10;      // squares to the finish line
const STRIDE = 2;      // squares for a card right at the first go
const CRAWL = 1;       // squares the snail moves after every card

let kit = null;
let box = null;
const game = { items: [], i: 0, her: 0, snail: 0, gained: 0, results: [], token: null, over: false };

export function init(k) { kit = k; }

export function start(words) {
  const { ctx, $ } = kit;
  kit.scene.attach($("#race-scene"));
  game.items = words.slice(0, ROUND);
  game.i = 0;
  game.her = 0;
  game.snail = 0;
  game.gained = 0;
  game.results = [];
  game.over = false;
  $("#race-end").hidden = true;
  $("#race-card").hidden = false;
  $("#race-score").textContent = "Score: 0";
  paintTrack();
  ctx.show("race");
  item();
}

function paintTrack() {
  const { $ } = kit;
  $("#race-her").style.setProperty("--pos", String(Math.min(game.her, TRACK)));
  $("#race-snail").style.setProperty("--pos", String(Math.min(game.snail, TRACK)));
  $("#race-track").dataset.her = String(game.her);
  $("#race-track").dataset.snail = String(game.snail);
  $("#race-her").setAttribute("aria-label", `You are ${Math.min(game.her, TRACK)} squares along`);
  $("#race-snail").setAttribute("aria-label", `The snail is ${Math.min(game.snail, TRACK)} squares along`);
}

function item() {
  const { ctx, $ } = kit;
  const word = game.items[game.i];
  const token = (game.token = {});
  const letters = word.replace(/-/g, "").length;
  $("#race-count").textContent = `Card ${game.i + 1} of ${game.items.length}`;
  $("#race-clue").textContent = ctx.data().words[word].meaning;
  $("#race-hint").textContent = `Starts with "${word[0]}". ${letters} letters.`;
  $("#race-next").hidden = true;
  kit.say("#race-feedback", "", "");
  box.open(word, { points: kit.POINTS.race, done: (r) => answered(word, token, r) });
}

async function answered(word, token, r) {
  if (game.token !== token) return;
  const { $ } = kit;
  game.snail += CRAWL;
  const gained = r.correct ? kit.POINTS.race : 0;
  if (r.correct) { game.her += STRIDE; kit.scene.up(); } else { kit.scene.down(); }
  game.gained += gained;
  game.results.push({ word, correct: r.correct, first_try: r.correct, error_type: r.decision.type });
  game.over = game.her >= TRACK || game.i + 1 >= game.items.length;
  paintTrack();
  $("#race-score").textContent = `Score: ${game.gained}`;
  kit.say("#race-feedback", r.correct ? "right" : "wrong", r.correct
    ? `You move ${STRIDE}. The snail moves ${CRAWL}.` : `You stay where you are. The snail moves ${CRAWL}.`);
  $("#race-next").textContent = game.over ? "Finish" : "Next card";
  $("#race-next").hidden = false;
  $("#race-next").focus();
  await kit.award(gained);
}

// How it ended, said kindly: the snail is slow and steady, and winning is not a verdict.
function verdict() {
  if (game.her >= TRACK) return "You crossed the line first!";
  if (game.her > game.snail) return "You were ahead at the end.";
  if (game.her === game.snail) return "A photo finish: you and the snail, side by side.";
  return "The snail got there first this time. It always takes the slow way, and it never stops.";
}

async function advance() {
  if (!game.over) { game.i += 1; item(); return; }
  const { ctx, $ } = kit;
  ctx.sfx.play("complete");
  game.token = null;
  box.close();
  const right = game.results.filter((r) => r.correct).length;
  const wrong = game.results.filter((r) => !r.correct).map((r) => r.word);
  $("#race-count").textContent = "Race over";
  $("#race-card").hidden = true;
  $("#race-next").hidden = true;
  $("#race-feedback").textContent = "";
  $("#race-end-text").textContent = `You scored ${game.gained} in the bonus round. ${verdict()}`;
  $("#race-end-words").textContent = `${right} of ${game.results.length} spelled right.`
    + (wrong.length ? ` Worth another look: ${wrong.join(", ")}.` : "");
  $("#race-end").hidden = false;
  $("#race-more-rounds").hidden = kit.tickets() <= 0;
  $("#race-quit").focus();
  await kit.logRound("bonus", game.results, game.gained, { kind: "race", her: game.her, snail: game.snail });
}

function leave() {
  game.token = null;
  box.close();
  kit.openHub();
}

export function wire() {
  const { $ } = kit;
  box = answerBox(kit, $("#race-answer"), { label: "Type the word", where: "race" });
  $("#race-her").innerHTML = ART.cat;
  $("#race-snail").innerHTML = ART.snail;
  $("#race-next").onclick = advance;
  $("#race-more-rounds").onclick = () => kit.startBonus();
  $("#race-quit").onclick = leave;
}
