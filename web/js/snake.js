// Letter snake: the crazy one. A paper snake, a board of letters, and a word to eat in order.
//
// Peter, 6 October 2026: "make them more crazy, like some kind of game where you have to eat
// letters as though you were pacman or snake." This is that, built so the spelling is the
// game and the steering is not: the edges wrap, the body is paper and may cross itself, a
// head boxed in by letters can turn round, nothing counts down, and the snake waits until she
// first turns. The rules are in snakecore.js, which has no screen in it so a test can play it.
//
// What it rests on is judgement, and it is the weakest of the games for learning. Choosing the
// next letter from a board is closer to hangman than to recall, so, as in hangman, she can type
// the whole word at any point, and that is the way to finish early and the one part with
// evidence behind it (docs/01). Without that, eating letters is a sort of guessing.
//
// Where it does not belong. It is a bonus round only, opened by points, one in four. It has no
// run sounds and does not feed the growing background beyond a right word adding a layer and a
// wrong letter taking one back, like every other card-by-card game. Under prefers-reduced-motion
// the snake moves one square a tap, not on its own, and anyone can switch to that.
//
// One of the bonus rounds (bonus.js).

import * as core from "./snakecore.js";
import { classify } from "./engine/classify.js";

const ROUND = 5;
const TICK_MS = 420;
const HINT_MS = 1800;

let kit = null;
const game = { items: [], i: 0, s: null, gained: 0, results: [], token: null, timer: null,
               paused: false, step: false, missedYet: false, hinting: [], hintTimer: null };

export function init(k) { kit = k; }

// The letters to tempt her with: those of the near miss (ent for ant), two from the word itself,
// and a vowel. All of them are plausible, none is obviously not the word's.
function spareFor(word) {
  const { ctx, shuffle } = kit;
  const decoys = [...new Set((ctx.data().words[word].decoys || []).flatMap((d) => [...d.text]))]
    .filter((ch) => /[a-z]/.test(ch)).slice(0, 3);
  const own = shuffle([...new Set([...word.replace(/-/g, "")])]).slice(0, 2);
  const vowel = "aeiou"[Math.floor(Math.random() * 5)];
  return [...decoys, ...own, vowel];
}

export function start(words) {
  const { ctx, $ } = kit;
  kit.scene.attach($("#snk-scene"));
  game.items = words.slice(0, ROUND);
  game.i = 0;
  game.gained = 0;
  game.results = [];
  game.step = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  $("#snk-end").hidden = true;
  $("#snk-play").hidden = false;
  $("#snk-score").textContent = "Score: 0";
  ctx.show("snake");
  item();
}

function stopClocks() {
  clearTimeout(game.timer);
  clearTimeout(game.hintTimer);
  game.timer = null;
  game.hintTimer = null;
}

function item() {
  const { ctx, $ } = kit;
  stopClocks();
  const word = game.items[game.i];
  game.token = {};
  game.s = core.makeBoard({ word, spare: spareFor(word) });
  game.missedYet = false;
  game.paused = false;
  game.hinting = [];
  $("#snk-count").textContent = `Word ${game.i + 1} of ${game.items.length}`;
  $("#snk-clue").textContent = ctx.data().words[word].meaning;
  $("#snk-input").value = "";
  $("#snk-input").disabled = false;
  $("#snk-solve").disabled = true;
  $("#snk-hint").disabled = false;
  $("#snk-pause").disabled = false;
  $("#snk-pause").textContent = "Pause";
  $("#snk-result").hidden = true;
  $("#snk-controls").hidden = false;
  $("#snk-next").hidden = true;
  kit.say("#snk-feedback", "", "Swipe, tap or use the arrows to steer. Eat the letters in order.");
  paintMode();
  draw();
}

function paintMode() {
  kit.$("#snk-mode").textContent = game.step ? "Moving: a step a tap" : "Moving: on its own";
}

// The whole board, redrawn: at most forty small pieces, so there is nothing to optimise.
function draw() {
  const { ctx, $ } = kit;
  const s = game.s;
  const board = $("#snk-board");
  board.style.setProperty("--cols", String(s.cols));
  board.style.setProperty("--rows", String(s.rows));
  board.dataset.next = String(s.next);
  board.dataset.done = String(s.done);
  board.dataset.facing = s.facing;
  board.dataset.head = `${s.snake[0][0]},${s.snake[0][1]}`;
  const lit = new Set(game.hinting.map(([x, y]) => `${x},${y}`));
  const kids = [];
  for (const [k, letter] of s.cells) {
    const [x, y] = k.split(",").map(Number);
    const d = ctx.el("div", { className: `snk-letter${lit.has(k) ? " hint" : ""}`, textContent: letter });
    d.style.setProperty("--x", String(x));
    d.style.setProperty("--y", String(y));
    d.dataset.x = String(x);
    d.dataset.y = String(y);
    d.dataset.letter = letter;
    kids.push(d);
  }
  [...s.snake].reverse().forEach(([x, y], k, all) => {
    const head = k === all.length - 1;
    const d = ctx.el("div", { className: `snk-seg ${head ? "head" : "body"}` });
    d.style.setProperty("--x", String(x));
    d.style.setProperty("--y", String(y));
    if (head) d.dataset.facing = s.facing;
    kids.push(d);
  });
  board.replaceChildren(...kids);
  // The word so far: the letters she has eaten, and a blank for each she has not. A blank for a
  // hyphen looks like any other, so it gives nothing away.
  $("#snk-slots").replaceChildren(...s.letters.map((ch, k) =>
    ctx.el("span", { className: `snk-slot${k < s.next ? " on" : ""}`, textContent: k < s.next ? ch : "" })));
}

function schedule() {
  clearTimeout(game.timer);
  game.timer = setTimeout(() => {
    game.timer = null;
    if (game.paused || !game.s || game.s.done) return;
    step();
    if (!game.s.done) schedule();
  }, TICK_MS);
}

function missed() {
  if (game.missedYet) return;
  game.missedYet = true;
  kit.scene.down();
}

function step() {
  const s = game.s;
  const events = core.advance(s, Math.random);
  for (const e of events) {
    if (e.type !== "eat") continue;
    if (e.ok) {
      kit.ctx.sfx.play("correct");
      kit.say("#snk-feedback", "", "");
    } else {
      missed();
      kit.ctx.sfx.play("notyet");
      kit.say("#snk-feedback", "wrong", "Not that letter. It goes back on the board.");
    }
  }
  draw();
  if (s.done) finishWord(false);
}

function steer(dir) {
  const s = game.s;
  if (!s || s.done || game.paused) return;
  if (!core.turn(s, dir)) return;
  if (game.step) { step(); return; }
  if (!game.timer) schedule();
}

function pause(on) {
  if (!game.s || game.s.done) return;
  game.paused = on;
  kit.$("#snk-pause").textContent = on ? "Carry on" : "Pause";
  if (on) { clearTimeout(game.timer); game.timer = null; } else if (game.s.desired && !game.step) schedule();
}

function hint() {
  const s = game.s;
  if (s.done || s.hinted) return;
  game.hinting = core.hintCells(s);
  kit.$("#snk-hint").disabled = true;
  kit.say("#snk-feedback", "", "A place to start: the letters you could eat now are lit.");
  draw();
  game.hintTimer = setTimeout(() => { game.hinting = []; if (game.s === s) draw(); }, HINT_MS);
}

// Typing the whole word is the way to finish early, and the one move here that is free recall.
function solveTyped() {
  const { ctx, $ } = kit;
  const s = game.s;
  const raw = $("#snk-input").value;
  if (!s || s.done || !raw.trim()) return;
  const d = classify(raw, ctx.entryFor(game.items[game.i]));
  $("#snk-input").value = "";
  $("#snk-solve").disabled = true;
  if (d.correct) { core.solve(s); draw(); finishWord(true); return; }
  core.missTyped(s);
  missed();
  ctx.sfx.play("notyet");
  kit.say("#snk-feedback", "wrong", "That is not it. Keep going.");
}

async function finishWord(typed) {
  const { ctx, $ } = kit;
  stopClocks();
  const s = game.s;
  const word = game.items[game.i];
  const gained = core.score(s, kit.POINTS.snake);
  game.gained += gained;
  game.results.push({ word, correct: true, first_try: s.misses === 0 && !s.hinted, misses: s.misses,
                      hint: s.hinted, typed });
  if (s.misses === 0) kit.scene.up();
  $("#snk-controls").hidden = true;
  $("#snk-input").disabled = true;
  const verdict = $("#snk-verdict");
  verdict.className = "verdict right";
  verdict.textContent = `${typed ? "You knew it!" : "You ate it!"}${gained ? `  +${gained}` : ""}`;
  $("#snk-whole").replaceChildren(...kit.partSpans(word));
  $("#snk-why").textContent = ctx.data().words[word].why;
  $("#snk-result").hidden = false;
  $("#snk-score").textContent = `Score: ${game.gained}`;
  kit.say("#snk-feedback", "", "");
  ctx.sfx.play("correct");
  const last = game.i + 1 >= game.items.length;
  $("#snk-next").textContent = last ? "Finish" : "Next word";
  $("#snk-next").hidden = false;
  $("#snk-next").focus();
  await kit.award(gained);
}

async function advance() {
  game.i += 1;
  if (game.i < game.items.length) { item(); return; }
  const { ctx, $ } = kit;
  ctx.sfx.play("complete");
  game.token = null;
  const clean = game.results.filter((r) => r.first_try).length;
  $("#snk-count").textContent = "Round over";
  $("#snk-play").hidden = true;
  $("#snk-next").hidden = true;
  $("#snk-end-text").textContent = `You scored ${game.gained} in the bonus round.`;
  $("#snk-end-words").textContent = `${clean} of ${game.results.length} eaten with no wrong letter.`;
  $("#snk-end").hidden = false;
  $("#snk-more-rounds").hidden = kit.tickets() <= 0;
  $("#snk-quit").focus();
  await kit.logRound("bonus", game.results, game.gained, { kind: "snake" });
}

function leave() {
  stopClocks();
  game.token = null;
  game.paused = true;
  kit.openHub();
}

const KEYS = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right",
               w: "up", s: "down", a: "left", d: "right" };

export function wire() {
  const { $ } = kit;
  $("#snk-solve").onclick = solveTyped;
  $("#snk-input").addEventListener("input", (e) => { $("#snk-solve").disabled = !e.target.value.trim(); });
  $("#snk-input").addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); solveTyped(); } });
  $("#snk-hint").onclick = hint;
  $("#snk-pause").onclick = () => pause(!game.paused);
  $("#snk-mode").onclick = () => {
    game.step = !game.step;
    clearTimeout(game.timer);
    game.timer = null;
    paintMode();
    if (!game.step && game.s && game.s.desired && !game.s.done && !game.paused) schedule();
  };
  $("#snk-next").onclick = advance;
  $("#snk-more-rounds").onclick = () => kit.startBonus();
  $("#snk-quit").onclick = leave;
  for (const b of document.querySelectorAll("#snk-pad button")) b.onclick = () => steer(b.dataset.dir);
  document.addEventListener("keydown", (e) => {
    if (!$("#screen-snake").classList.contains("on") || e.target === $("#snk-input")) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const dir = KEYS[e.key];
    if (dir) { e.preventDefault(); steer(dir); }
  });
  // A hidden page must not keep a snake running behind it.
  document.addEventListener("visibilitychange", () => { if (document.hidden) pause(true); });
  // Steering by finger: a swipe turns that way; a tap turns towards where it landed.
  const board = $("#snk-board");
  let from = null;
  board.addEventListener("pointerdown", (e) => { from = { x: e.clientX, y: e.clientY }; });
  board.addEventListener("pointercancel", () => { from = null; });
  board.addEventListener("pointerup", (e) => {
    if (!from || !game.s) return;
    let dx = e.clientX - from.x;
    let dy = e.clientY - from.y;
    from = null;
    if (Math.hypot(dx, dy) < 24) {
      const r = board.getBoundingClientRect();
      const cell = r.width / game.s.cols;
      const [hx, hy] = game.s.snake[0];
      dx = e.clientX - (r.left + (hx + 0.5) * cell);
      dy = e.clientY - (r.top + (hy + 0.5) * cell);
    }
    steer(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : (dy > 0 ? "down" : "up"));
  });
}
