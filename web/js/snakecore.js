// The letter snake's rules, with no screen in them, so a test can play it.
//
// A paper snake crosses a board of letters and has to eat the letters of a word in the order
// the word is spelt. The board holds the word's own letters and a few spare ones, so it takes
// knowing the spelling to choose: eating the wrong letter is a miss, and the snake shrinks a
// little. There is no way to lose by steering: the edges wrap round, the body is paper and
// can pass over itself (so it may turn straight back, and a head boxed in by letters can
// always get out), and nothing counts down. docs/15 (6 October 2026) says what it rests on,
// which is judgement and not a study, and where it does not belong.
//
// A hyphen is a letter on this board, and there is always one: in a word that has a hyphen it
// is the real one, and in any other word it is a spare, so its presence never gives one away.

export const COLS = 8;
export const ROWS = 9;
export const MIN_LENGTH = 3;

export const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

const at = (x, y) => `${x},${y}`;

// A letter with a letter on every side cannot be reached without eating another first, which
// would make a miss of something that is not a spelling mistake. Boards never have one.
const around = (x, y, cols, rows) => [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]
  .map(([a, b]) => at((a + cols) % cols, (b + rows) % rows));
const boxedIn = (cells, x, y, cols, rows) => around(x, y, cols, rows).every((k) => cells.has(k));
const anyBoxedIn = (cells, cols, rows) => [...cells.keys()].some((k) => {
  const [x, y] = k.split(",").map(Number);
  return boxedIn(cells, x, y, cols, rows);
});
const pick = (xs, rand) => xs[Math.floor(rand() * xs.length)];

function shuffled(xs, rand) {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * A fresh board for one word. `spare` are the extra letters to tempt her: the letters of the
 * near miss (ant for ent) and a few chosen by the caller. No letter starts on the snake or
 * within two squares of its head, so nothing is eaten by accident on the first move.
 */
export function makeBoard({ word, rand = Math.random, cols = COLS, rows = ROWS, spare = [] }) {
  const letters = [...word];
  const pool = [...letters, ...(letters.includes("-") ? [] : ["-"]), ...spare];
  const hx = Math.floor(cols / 2);
  const hy = Math.floor(rows / 2);
  const snake = [[hx, hy], [hx - 1, hy], [hx - 2, hy]];
  const free = [];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const near = Math.max(Math.abs(x - hx), Math.abs(y - hy)) <= 2;
      if (!near) free.push([x, y]);
    }
  }
  if (free.length < pool.length) throw new Error("the board is too small for this word");
  let cells = new Map();
  for (let tries = 0; tries < 200; tries++) {
    cells = new Map();
    shuffled(free, rand).slice(0, pool.length).forEach(([x, y], i) => cells.set(at(x, y), pool[i]));
    if (!anyBoxedIn(cells, cols, rows)) break;
  }
  return { cols, rows, word, letters, next: 0, snake, cells, facing: "right", desired: null,
           misses: 0, hinted: false, done: false };
}

/** Turn the snake. Any way is allowed: the body is paper, so turning back on it costs nothing. */
export function turn(state, dir) {
  if (state.done || !DIRS[dir]) return false;
  state.desired = dir;
  return true;
}

// A wrongly eaten letter comes back on a free square, not beside the head, so the board
// always holds every letter she still needs.
function respawn(state, letter, rand) {
  const [hx, hy] = state.snake[0];
  const taken = new Set([...state.cells.keys(), ...state.snake.map(([x, y]) => at(x, y))]);
  const free = [];
  for (let y = 0; y < state.rows; y++) {
    for (let x = 0; x < state.cols; x++) {
      const dx = Math.min(Math.abs(x - hx), state.cols - Math.abs(x - hx));
      const dy = Math.min(Math.abs(y - hy), state.rows - Math.abs(y - hy));
      if (taken.has(at(x, y)) || Math.max(dx, dy) <= 1) continue;
      // Not where it would shut a letter in, itself or a neighbour.
      state.cells.set(at(x, y), letter);
      const shut = anyBoxedIn(state.cells, state.cols, state.rows);
      state.cells.delete(at(x, y));
      if (!shut) free.push([x, y]);
    }
  }
  const [x, y] = pick(free, rand);
  state.cells.set(at(x, y), letter);
}

/**
 * One step. Returns what happened: [] for a plain move, an "eat" for a letter (right or
 * wrong), and "done" when the word is finished. Nothing moves until she has turned once.
 */
export function advance(state, rand = Math.random) {
  if (state.done || !state.desired) return [];
  const [dx, dy] = DIRS[state.desired];
  state.facing = state.desired;
  const [hx, hy] = state.snake[0];
  const nx = (hx + dx + state.cols) % state.cols;
  const ny = (hy + dy + state.rows) % state.rows;
  state.snake.unshift([nx, ny]);
  const events = [];
  let grow = false;
  let shrink = false;
  const letter = state.cells.get(at(nx, ny));
  if (letter !== undefined) {
    state.cells.delete(at(nx, ny));
    if (letter === state.letters[state.next]) {
      grow = true;
      events.push({ type: "eat", ok: true, letter, index: state.next });
      state.next += 1;
      if (state.next === state.letters.length) {
        state.done = true;
        events.push({ type: "done" });
      }
    } else {
      shrink = true;
      state.misses += 1;
      respawn(state, letter, rand);
      events.push({ type: "eat", ok: false, letter });
    }
  }
  if (!grow) state.snake.pop();
  if (shrink && state.snake.length > MIN_LENGTH) state.snake.pop();
  return events;
}

/** She typed the whole word and it was right: the word is finished. */
export function solve(state) {
  state.next = state.letters.length;
  state.done = true;
}

/** She typed the whole word and it was wrong: a miss, and nothing else changes. */
export function missTyped(state) {
  state.misses += 1;
}

/** The squares that hold the letter she needs next, all of them. Using it halves the points. */
export function hintCells(state) {
  state.hinted = true;
  const want = state.letters[state.next];
  return [...state.cells].filter(([, l]) => l === want).map(([k]) => k.split(",").map(Number));
}

/**
 * What the word earns: the full amount for no wrong letter and no hint, half for a hint or
 * for one or two wrong letters, nothing beyond that. Like hangman, and for the same reason:
 * cheap enough to ask, dear enough to try first. Judgement (docs/15).
 */
export function score(state, full) {
  if (!state.done) return 0;
  if (state.misses === 0 && !state.hinted) return full;
  return state.misses <= 2 ? Math.floor(full / 2) : 0;
}
