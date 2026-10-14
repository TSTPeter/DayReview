// The mini crossword: clues are meanings, answers are the term's words, and each answer
// is TYPED, whole, as in the dictation.
//
// She types an answer, never a letter into a square, so no wrong letter is ever left in the
// grid (docs/15, "no misspelling stays on screen"). A right answer fills its squares; a wrong
// one is marked against the word, with its rule, and then filled in too, so the grid stays
// true. The crossing letters are the crossword's own kind of hint: the pattern above the box
// shows the ones she already has.
//
// The puzzles are built offline by engine/crossword.py and held to their rules by
// tests/test_crossword.py. This week's words come first, because the test is on Friday; the
// rest of each puzzle is earlier weeks' words, so it is also spaced retrieval of the term.
//
// Rests on judgement. Retrieval of a word from its meaning, with a cue, is cued recall, which
// is the practice docs/01 supports; nothing here shows a crossword beats a list. It is here
// because it is a puzzle she may enjoy, and it is labelled that way (docs/15).
//
// No growing background: the screen is a grid, not a card at a time (docs/15).

import { answerBox } from "./answer.js";

const ACROSS = "a";

let kit = null;
let box = null;
const game = { puzzle: null, entries: [], shown: null, sel: -1, gained: 0, results: [],
               token: null, saving: null };

export function init(k) { kit = k; }

const reading = (a, b) => a.row - b.row || a.col - b.col || (a.dir === ACROSS ? -1 : 1);

export async function start() {
  const { ctx, $ } = kit;
  await game.saving;
  const week = ctx.week();
  const puzzles = ctx.data().weeks[week.id].crosswords;
  // The next puzzle in the week's order: a finished one is logged, so the log says how many
  // she has done this week (hidden words does the same).
  const log = await ctx.store.getKV("game_log", []);
  const done = log.filter((r) => r.game === "cross" && r.week === week.id).length;
  game.puzzle = puzzles[done % puzzles.length];
  game.entries = game.puzzle.entries.map((e) => {
    const dr = e.dir === ACROSS ? 0 : 1, dc = e.dir === ACROSS ? 1 : 0;
    return { ...e, len: e.word.length, state: "open",
             cells: [...e.word].map((_, i) => [e.row + i * dr, e.col + i * dc]) };
  }).sort(reading);
  game.shown = game.puzzle.grid.map((row) => [...row].map(() => false));
  game.gained = 0;
  game.results = [];
  game.sel = -1;
  game.picked = false;
  game.token = {};
  $("#cross-end").hidden = true;
  $("#cross-again").hidden = true;
  $("#cross-next").hidden = true;
  $("#cross-stage").hidden = false;
  $("#cross-count").textContent = `Puzzle ${(done % puzzles.length) + 1} of ${puzzles.length} this week. `
    + "Tap a clue or a square, then type the answer.";
  kit.paintPoints();
  drawGrid();
  drawClues();
  ctx.show("cross");
  select(game.entries.findIndex((e) => e.state === "open"));
}

function drawGrid() {
  const { ctx, $ } = kit;
  const { rows, cols, grid } = game.puzzle;
  const host = $("#cross-grid");
  host.style.setProperty("--cols", String(cols));
  const starts = new Map();
  for (const e of game.entries) if (!starts.has(`${e.row},${e.col}`)) starts.set(`${e.row},${e.col}`, e.n);
  const kids = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (grid[r][c] === ".") { kids.push(ctx.el("span", { className: "xw-block" })); continue; }
      const b = ctx.el("button", { className: "xw-cell" });
      b.dataset.r = String(r);
      b.dataset.c = String(c);
      if (starts.has(`${r},${c}`)) b.append(ctx.el("span", { className: "xw-n", textContent: String(starts.get(`${r},${c}`)) }));
      b.append(ctx.el("span", { className: "xw-l" }));
      b.onclick = () => cellTap(r, c);
      kids.push(b);
    }
  }
  host.replaceChildren(...kids);
  paintGrid();
}

const cellEl = (r, c) => kit.$(`#cross-grid .xw-cell[data-r="${r}"][data-c="${c}"]`);

function paintGrid() {
  const { grid } = game.puzzle;
  const sel = game.entries[game.sel];
  for (const b of document.querySelectorAll("#cross-grid .xw-cell")) {
    const r = Number(b.dataset.r), c = Number(b.dataset.c);
    b.querySelector(".xw-l").textContent = game.shown[r][c] ? grid[r][c] : "";
    b.classList.toggle("sel", !!sel && sel.cells.some(([rr, cc]) => rr === r && cc === c));
    const owners = game.entries.filter((e) => e.cells.some(([rr, cc]) => rr === r && cc === c));
    b.classList.toggle("right", game.shown[r][c] && owners.some((e) => e.state === "right"));
    b.classList.toggle("missed", game.shown[r][c] && !owners.some((e) => e.state === "right"));
    b.setAttribute("aria-label", `Row ${r + 1}, column ${c + 1}${game.shown[r][c] ? `, ${grid[r][c]}` : ", empty"}`);
  }
}

const dirName = (e) => (e.dir === ACROSS ? "across" : "down");

function drawClues() {
  const { ctx, $ } = kit;
  const group = (dir, title) => {
    const ul = ctx.el("ul", { className: "xw-list" });
    game.entries.forEach((e, i) => {
      if (e.dir !== dir) return;
      const b = ctx.el("button", { className: `xw-clue ${e.state}` });
      b.dataset.i = String(i);
      b.append(ctx.el("b", { textContent: `${e.n}` }), document.createTextNode(` ${e.clue} (${e.len})`));
      b.onclick = () => { if (e.state === "open") select(i); };
      ul.append(ctx.el("li", {}, [b]));
    });
    return ctx.el("div", { className: "xw-col" }, [ctx.el("h2", { textContent: title }), ul]);
  };
  $("#cross-clues").replaceChildren(group("a", "Across"), group("d", "Down"));
}

function paintClues() {
  game.entries.forEach((e, i) => {
    const b = kit.$(`#cross-clues .xw-clue[data-i="${i}"]`);
    if (!b) return;
    b.className = `xw-clue ${e.state}${i === game.sel ? " sel" : ""}`;
    b.disabled = e.state !== "open";
  });
}

// The letters she has so far, with a gap for each she has not.
function pattern(e) {
  return e.cells.map(([r, c]) => (game.shown[r][c] ? game.puzzle.grid[r][c] : "_")).join(" ");
}

function select(i) {
  if (i < 0) { finish(); return; }
  const { $ } = kit;
  const e = game.entries[i];
  game.sel = i;
  const token = (game.token = {});
  $("#cross-tab").textContent = `${e.n} ${dirName(e)}`;
  $("#cross-clue").textContent = e.clue;
  $("#cross-pattern").textContent = `${e.len} letters:  ${pattern(e)}`;
  $("#cross-next").hidden = true;
  box.open(e.word, { points: kit.POINTS.cross, focus: false, done: (r) => answered(i, token, r) });
  paintGrid();
  paintClues();
  // Picked from a clue or a square further down: bring the clue and its box into view. On a
  // phone the keyboard is what she needs next, and a tap is a gesture, so focusing is allowed;
  // at the start of a puzzle the page is left alone.
  if (game.picked) {
    $("#cross-current").scrollIntoView({ block: "nearest" });
    box.input.focus({ preventScroll: true });
  }
  game.picked = true;
}

function cellTap(r, c) {
  const open = game.entries.map((e, i) => ({ e, i }))
    .filter(({ e }) => e.state === "open" && e.cells.some(([rr, cc]) => rr === r && cc === c));
  if (!open.length) return;
  // On a crossing, a second tap turns to the other answer.
  const here = open.findIndex(({ i }) => i === game.sel);
  select(open[(here + 1) % open.length].i);
}

async function answered(i, token, r) {
  if (game.token !== token) return;
  const e = game.entries[i];
  e.state = r.correct ? "right" : "missed";
  for (const [rr, cc] of e.cells) game.shown[rr][cc] = true;
  const gained = r.correct ? kit.POINTS.cross : 0;
  game.gained += gained;
  game.results.push({ word: e.word, first_try: r.correct, error_type: r.decision.type });
  kit.$("#cross-pattern").textContent = `${e.len} letters:  ${pattern(e)}`;
  paintGrid();
  paintClues();
  const next = kit.$("#cross-next");
  const left = game.entries.some((x) => x.state === "open");
  next.textContent = left ? "Next clue" : "Finish";
  next.hidden = false;
  next.focus();
  await kit.award(gained);
}

function advance() {
  const open = game.entries.map((e, i) => ({ e, i })).filter(({ e }) => e.state === "open");
  if (!open.length) { finish(); return; }
  // The next one after this, in reading order, and round to the start if there is none.
  const after = open.find(({ i }) => i > game.sel) || open[0];
  select(after.i);
}

async function finish() {
  const { ctx, $ } = kit;
  ctx.sfx.play("complete");
  game.token = null;
  box.close();
  const firsts = game.results.filter((r) => r.first_try).length;
  const missed = game.results.filter((r) => !r.first_try).map((r) => r.word);
  $("#cross-stage").hidden = true;
  $("#cross-next").hidden = true;
  $("#cross-count").textContent = "Puzzle finished";
  $("#cross-end-text").textContent = `${firsts} of ${game.results.length} right at the first go.`
    + (game.gained ? `  +${game.gained} points this puzzle.` : "");
  $("#cross-end-words").textContent = missed.length ? `Worth another look: ${missed.join(", ")}.` : "Every answer in.";
  $("#cross-end").hidden = false;
  $("#cross-again").hidden = false;
  $("#cross-again").focus();
  // "Another puzzle" waits for this: the log is how it knows which puzzle is next.
  game.saving = kit.logRound("cross", game.results, game.gained);
}

function leave() {
  game.token = null;
  box.close();
  kit.openHub();
}

export function wire() {
  const { $ } = kit;
  box = answerBox(kit, $("#cross-answer"), { label: "Type the answer", where: "cross" });
  $("#cross-next").onclick = advance;
  $("#cross-again").onclick = start;
  $("#cross-quit").onclick = leave;
}
