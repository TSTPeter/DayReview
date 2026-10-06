// Letter tiles: the word's letters, jumbled, to put back in order.
//
// A quick one. She reads the meaning, taps the tiles into the slots, and checks. A wrong
// go never leaves a misspelling on screen (docs/15, "no misspelling stays on screen"):
// the letters that are in the right place stay, the others go back to the tray, and she is
// told how many were right. After three misses the word is shown, in its parts, with its
// rule, so nobody is stuck.
//
// Rests on judgement, and the little evidence there is leans the other way. Building words from
// letter cards is a classroom activity (Cunningham and Cunningham 1992, "Making Words", a guide
// for teachers with no controlled data), and the one controlled comparison found, with
// first-graders, had children spell better after writing words by hand than after typing them
// or arranging letter tiles (Cunningham and Stanovich 1990). So this is here for variety and
// because it is quick, and it earns no more than the jigsaw (docs/15).
//
// A hyphen tile is always in the tray, so its presence never gives a hyphen away: in a
// word with a hyphen it is the real one, and in any other word it is a spare.
//
// A game screen with the growing background (scene.js).

const ROUND = 5;
const MAX_MISSES = 3;

let kit = null;
const game = { items: [], i: 0, gained: 0, results: [], used: new Set(), token: null,
               word: "", slots: [], tiles: [], locked: [], misses: 0, done: false };

export function init(k) { kit = k; }

export function start({ fresh = true } = {}) {
  const { ctx, $, shuffle } = kit;
  const week = ctx.week();
  if (fresh) {
    kit.scene.attach($("#tiles-scene"));
    game.used = new Set();
  }
  const pool = week.words.filter((w) => ctx.data().words[w]);
  let fresher = pool.filter((w) => !game.used.has(w));
  if (fresher.length < ROUND) { game.used = new Set(); fresher = pool; }
  game.items = shuffle(fresher).slice(0, ROUND);
  for (const w of game.items) game.used.add(w);
  game.i = 0;
  game.gained = 0;
  game.results = [];
  $("#tiles-end").hidden = true;
  $("#tiles-again").hidden = true;
  $("#tiles-stage").hidden = false;
  kit.paintPoints();
  ctx.show("tiles");
  item();
}

function item() {
  const { ctx, $, shuffle } = kit;
  const word = game.items[game.i];
  game.token = {};
  game.word = word;
  game.misses = 0;
  game.done = false;
  game.locked = Array(word.length).fill(false);
  game.slots = Array(word.length).fill(null);
  // The word's own letters, and a hyphen if it does not already have one.
  const letters = [...word];
  if (!letters.includes("-")) letters.push("-");
  let order = shuffle(letters);
  for (let k = 0; k < 6 && order.join("") === word; k++) order = shuffle(letters);
  game.tiles = order.map((ch, id) => ({ id, ch, slot: null }));
  $("#tiles-count").textContent = `Word ${game.i + 1} of ${game.items.length}`;
  $("#tiles-clue").textContent = ctx.data().words[word].meaning;
  kit.say("#tiles-feedback", "", "");
  $("#tiles-support").replaceChildren();
  $("#tiles-support").hidden = true;
  $("#tiles-next").hidden = true;
  $("#tiles-check").hidden = false;
  $("#tiles-clear").hidden = false;
  $("#tiles-slots").className = "tile-slots";
  paint();
}

const tileButton = (t, where) => {
  const { ctx } = kit;
  const b = ctx.el("button", { className: `tile${t.ch === "-" ? " hyphen" : ""}`,
                               textContent: t.ch });
  b.dataset.id = String(t.id);
  b.setAttribute("aria-label", t.ch === "-" ? "hyphen" : t.ch);
  b.onclick = () => (where === "tray" ? place(t) : unplace(t));
  return b;
};

function paint() {
  const { ctx, $ } = kit;
  const slots = game.word.split("").map((_, k) => {
    const t = game.tiles.find((x) => x.slot === k);
    const s = ctx.el("div", { className: `slot${game.locked[k] ? " locked" : ""}` });
    s.dataset.k = String(k);
    if (t) {
      const b = tileButton(t, "slot");
      if (game.locked[k] || game.done) b.disabled = true;
      s.append(b);
    }
    return s;
  });
  $("#tiles-slots").replaceChildren(...slots);
  const tray = game.tiles.filter((t) => t.slot === null);
  $("#tiles-tray").replaceChildren(...tray.map((t) => tileButton(t, "tray")));
  $("#tiles-tray").hidden = game.done;
  const open = game.slots.some((_, k) => !game.locked[k] && !game.tiles.some((t) => t.slot === k));
  $("#tiles-check").disabled = game.done || open;
  $("#tiles-clear").disabled = game.done || !game.tiles.some((t) => t.slot !== null && !game.locked[t.slot]);
}

// A tapped tile goes to the first open slot, reading left to right.
function place(t) {
  if (game.done) return;
  const k = game.word.split("").findIndex((_, j) => !game.locked[j] && !game.tiles.some((x) => x.slot === j));
  if (k < 0) return;
  t.slot = k;
  paint();
}

function unplace(t) {
  if (game.done || game.locked[t.slot]) return;
  t.slot = null;
  paint();
}

function clear() {
  if (game.done) return;
  for (const t of game.tiles) if (t.slot !== null && !game.locked[t.slot]) t.slot = null;
  paint();
}

async function check() {
  if (game.done) return;
  const { ctx, $ } = kit;
  const word = game.word;
  const built = [...word].map((_, k) => game.tiles.find((t) => t.slot === k)?.ch ?? "");
  if (built.join("") === word) { await finishWord(true); return; }
  // Keep what is in the right place, send the rest back, and say how many were right.
  const right = [];
  [...word].forEach((ch, k) => {
    if (!game.locked[k] && built[k] === ch) right.push(k);
  });
  for (const k of right) game.locked[k] = true;
  for (const t of game.tiles) if (t.slot !== null && !game.locked[t.slot]) t.slot = null;
  const inPlace = game.locked.filter(Boolean).length;
  const first = game.misses === 0;
  game.misses += 1;
  ctx.sfx.play("notyet");
  if (first) {
    kit.scene.down();
    const card = ctx.supports.render(word);
    $("#tiles-support").replaceChildren(...(card ? [card] : []));
    $("#tiles-support").hidden = !card;
    if (card) ctx.supports.logShown(word, "tiles");
  }
  if (game.misses >= MAX_MISSES) { await finishWord(false); return; }
  kit.say("#tiles-feedback", "wrong", `${inPlace} of ${word.length} are in the right place. `
    + "Those stay. Try the rest.");
  const slotsEl = $("#tiles-slots");
  slotsEl.classList.add("shake");
  setTimeout(() => slotsEl.classList.remove("shake"), 380);
  paint();
}

async function finishWord(solved) {
  const { ctx, $ } = kit;
  const word = game.word;
  const first = solved && game.misses === 0;
  game.done = true;
  // Show it whole, in its parts, whichever way it ended.
  game.tiles.forEach((t) => { t.slot = null; });
  const pool = [...word].map((ch, k) => ({ ch, k }));
  const used = new Set();
  for (const { ch, k } of pool) {
    const t = game.tiles.find((x) => x.ch === ch && x.slot === null && !used.has(x.id));
    t.slot = k;
    used.add(t.id);
  }
  game.locked = Array(word.length).fill(true);
  paint();
  $("#tiles-slots").classList.add(solved ? "done" : "shown");
  const gained = first ? kit.POINTS.tiles : 0;
  game.gained += gained;
  game.results.push({ word, first_try: first, misses: game.misses, revealed: !solved });
  if (first) kit.scene.up();
  const why = ctx.data().words[word].why;
  $("#tiles-feedback").className = `game-feedback ${solved ? "right" : "wrong"}`;
  $("#tiles-feedback").replaceChildren(
    ...(solved ? [] : [document.createTextNode("Here it is. ")]),
    ...kit.partSpans(word),
    document.createTextNode(`  ${why}${gained ? `  +${gained}` : ""}`));
  ctx.sfx.play(solved ? "correct" : "notyet");
  $("#tiles-check").hidden = true;
  $("#tiles-clear").hidden = true;
  const last = game.i + 1 >= game.items.length;
  $("#tiles-next").textContent = last ? "Finish" : "Next word";
  $("#tiles-next").hidden = false;
  $("#tiles-next").focus();
  await kit.award(gained);
}

async function advance() {
  game.i += 1;
  if (game.i < game.items.length) { item(); return; }
  const { ctx, $ } = kit;
  ctx.sfx.play("complete");
  game.token = null;
  const firsts = game.results.filter((r) => r.first_try).length;
  const wrong = game.results.filter((r) => !r.first_try).map((r) => r.word);
  $("#tiles-count").textContent = "Round finished";
  $("#tiles-stage").hidden = true;
  $("#tiles-next").hidden = true;
  $("#tiles-end-text").textContent = `${firsts} of ${game.results.length} at the first go.`
    + (game.gained ? `  +${game.gained} points this round.` : "");
  $("#tiles-end-words").textContent = wrong.length ? `Worth another look: ${wrong.join(", ")}.` : "Every word built.";
  $("#tiles-end").hidden = false;
  $("#tiles-again").hidden = false;
  $("#tiles-again").focus();
  await kit.logRound("tiles", game.results, game.gained);
}

function leave() {
  game.token = null;
  kit.openHub();
}

export function wire() {
  const { $ } = kit;
  $("#tiles-check").onclick = check;
  $("#tiles-clear").onclick = clear;
  $("#tiles-next").onclick = advance;
  $("#tiles-again").onclick = () => start({ fresh: false });
  $("#tiles-quit").onclick = leave;
  // A keyboard, where there is one, places tiles too: a letter takes a matching tile, and
  // Backspace takes the last one back.
  document.addEventListener("keydown", (e) => {
    if (!$("#screen-tiles").classList.contains("on") || game.done) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === "Backspace") {
      const placed = game.tiles.filter((t) => t.slot !== null && !game.locked[t.slot]);
      if (placed.length) { e.preventDefault(); unplace(placed.sort((a, b) => b.slot - a.slot)[0]); }
      return;
    }
    if (e.key === "Enter" && !$("#tiles-check").disabled) { e.preventDefault(); check(); return; }
    const ch = e.key === "-" ? "-" : e.key.toLowerCase();
    if (!/^[a-z-]$/.test(ch)) return;
    const t = game.tiles.find((x) => x.slot === null && x.ch === ch);
    if (t) { e.preventDefault(); place(t); }
  });
}
