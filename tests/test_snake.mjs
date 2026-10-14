// The letter snake's rules (web/js/snakecore.js), played without a screen.
//
// Every claim the game makes about itself is checked here, with a seeded generator so a
// failure can be replayed: the board holds exactly the letters it should, eating the right
// letter grows and the wrong one shrinks, the edges wrap, it cannot turn back on itself, a
// wrong letter always comes back so the word can always be finished, and a whole word can be
// eaten in order by something that knows the spelling.
import { readFileSync } from "node:fs";
import { makeBoard, turn, advance, solve, missTyped, hintCells, score, COLS, ROWS, MIN_LENGTH, DIRS }
  from "../web/js/snakecore.js";

let failures = 0;
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "  ok  " : "FAIL  "}${name}${detail ? "  : " + detail : ""}`);
  if (!ok) failures += 1;
};

// A small seeded generator (mulberry32).
const seeded = (seed) => () => {
  seed = (seed + 0x6D2B79F5) >>> 0;
  let t = seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const counts = (xs) => xs.reduce((m, x) => m.set(x, (m.get(x) || 0) + 1), new Map());
const onBoard = (s) => [...s.cells.values()];
const wanted = (s) => s.letters.slice(s.next);
const holdsWhatIsStillNeeded = (s) => {
  const have = counts(onBoard(s));
  for (const [l, n] of counts(wanted(s))) if ((have.get(l) || 0) < n) return false;
  return true;
};
const terms = JSON.parse(readFileSync(new URL("../web/data/term.json", import.meta.url), "utf8"));
const words = [...new Set(terms.weeks.flatMap((w) => w.words))];

// ---------------------------------------------------------------- the board
{
  const s = makeBoard({ word: "decent", rand: seeded(1), spare: ["a", "t", "r"] });
  check("the board holds the word's letters, a spare hyphen, and the spares, and nothing else",
        [...counts(onBoard(s))].sort().join() === [...counts([..."decent", "-", "a", "t", "r"])].sort().join(),
        onBoard(s).join(""));
  const h = s.snake[0];
  check("the snake starts in the middle, three long, with nothing near its head",
        s.snake.length === 3 && h[0] === Math.floor(COLS / 2) && h[1] === Math.floor(ROWS / 2)
        && [...s.cells.keys()].every((k) => { const [x, y] = k.split(",").map(Number);
          return Math.max(Math.abs(x - h[0]), Math.abs(y - h[1])) > 2; }));
  check("no two letters share a square", new Set(s.cells.keys()).size === s.cells.size);
  let shut = 0;
  for (let seed = 1; seed <= 400; seed++) {
    const b = makeBoard({ word: words[seed % words.length], rand: seeded(seed), spare: ["a", "e", "t", "n"] });
    for (const k of b.cells.keys()) {
      const [x, y] = k.split(",").map(Number);
      const sides = [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]].map(([a, c]) => `${(a + COLS) % COLS},${(c + ROWS) % ROWS}`);
      if (sides.every((q) => b.cells.has(q))) shut += 1;
    }
  }
  check("no letter on any of 400 boards has a letter on every side, which would force a miss", shut === 0, `${shut}`);
  check("a word with no hyphen still gets one, so its presence gives nothing away",
        onBoard(s).filter((l) => l === "-").length === 1);
  const hy = makeBoard({ word: "co-operate", rand: seeded(2) });
  check("a word with a hyphen has exactly one, and it is a letter to be eaten in its place",
        onBoard(hy).filter((l) => l === "-").length === 1 && hy.letters[2] === "-");
}

// ---------------------------------------------------------------- steering
{
  const s = makeBoard({ word: "cat", rand: seeded(3) });
  check("nothing moves until she turns", advance(s).length === 0 && s.snake[0][0] === 4 && s.snake[0][1] === 4);
  check("a turn up is taken", turn(s, "up") === true);
  advance(s);
  check("it moves one square a step", s.snake[0][1] === 3 && s.snake.length === 3);
  check("it can turn straight back, because the body is paper and nothing collides",
        turn(s, "down") === true && (advance(s), s.snake[0][1] === 4 && s.snake.length === 3));
  const w = makeBoard({ word: "cat", rand: seeded(4), cols: COLS, rows: ROWS });
  w.cells.clear();
  w.snake = [[0, 4], [1, 4], [2, 4]];
  w.facing = "up";
  turn(w, "left");
  advance(w);
  check("the edges wrap round, so steering can never lose", w.snake[0][0] === COLS - 1);
  const v = makeBoard({ word: "cat", rand: seeded(5) });
  v.cells.clear();
  v.snake = [[3, 0], [3, 1], [3, 2]];
  v.facing = "right";
  turn(v, "up");
  advance(v);
  check("and so does the top, to the bottom", v.snake[0][1] === ROWS - 1);
}

// ---------------------------------------------------------------- eating
{
  const s = makeBoard({ word: "cat", rand: seeded(6) });
  s.cells.clear();
  s.cells.set("5,4", "c");        // one step right of the head
  s.cells.set("6,4", "x");        // a wrong letter beyond it
  turn(s, "right");
  const e1 = advance(s, seeded(1));
  check("eating the letter she needs takes the next place and grows the snake",
        e1.length === 1 && e1[0].ok && e1[0].letter === "c" && s.next === 1 && s.snake.length === 4);
  const before = s.snake.length;
  const e2 = advance(s, seeded(1));
  check("eating a wrong letter is a miss, and the snake shrinks, but never below its least",
        e2.length === 1 && !e2[0].ok && s.misses === 1 && s.next === 1 && s.snake.length === Math.max(MIN_LENGTH, before - 1));
  check("the wrong letter comes back on the board, so the word can still be finished",
        [...s.cells.values()].includes("x") && !s.cells.has("6,4"));
}
{
  const s = makeBoard({ word: "at", rand: seeded(7) });
  s.cells.clear();
  s.cells.set("5,4", "a");
  s.cells.set("6,4", "t");
  turn(s, "right");
  advance(s);
  const e = advance(s);
  check("the last letter finishes the word", e.some((x) => x.type === "done") && s.done && s.next === 2);
  check("a finished snake stops", advance(s).length === 0 && turn(s, "up") === false);
  check("a clean word earns the full points", score(s, 10) === 10);
}

// ---------------------------------------------------------------- the points
{
  const s = makeBoard({ word: "at", rand: seeded(8) });
  solve(s);
  check("typing the word, right, finishes it and earns the full points", s.done && score(s, 10) === 10);
  const t = makeBoard({ word: "at", rand: seeded(9) });
  missTyped(t);
  solve(t);
  check("a wrong typed guess before it costs half, as a wrong letter does", score(t, 10) === 5);
  const u = makeBoard({ word: "at", rand: seeded(10) });
  u.misses = 3;
  solve(u);
  check("three wrong goes earn nothing, though the word is still finished", u.done && score(u, 10) === 0);
  const h = makeBoard({ word: "cat", rand: seeded(11) });
  const cells = hintCells(h);
  check("a hint names every square that holds the letter she needs, and halves the points",
        cells.length >= 1 && cells.every(([x, y]) => h.cells.get(`${x},${y}`) === "c") && h.hinted);
  solve(h);
  check("a hinted word that is finished earns half", score(h, 10) === 5);
  const n = makeBoard({ word: "cat", rand: seeded(12) });
  check("an unfinished word earns nothing", score(n, 10) === 0);
}

// ---------------------------------------------------------------- play at random, and play it right
{
  let broken = null;
  for (let seed = 1; seed <= 60 && !broken; seed++) {
    const rand = seeded(seed);
    const word = words[Math.floor(rand() * words.length)];
    const s = makeBoard({ word, rand, spare: ["a", "e", "t"] });
    for (let step = 0; step < 600 && !s.done; step++) {
      if (rand() < 0.3) turn(s, ["up", "down", "left", "right"][Math.floor(rand() * 4)]);
      advance(s, rand);
      const inside = s.snake.every(([x, y]) => x >= 0 && x < s.cols && y >= 0 && y < s.rows);
      const noOverlap = new Set(s.cells.keys()).size === s.cells.size
        && ![...s.cells.keys()].includes(`${s.snake[0][0]},${s.snake[0][1]}`);
      if (!inside || !noOverlap || s.snake.length < MIN_LENGTH || !holdsWhatIsStillNeeded(s)) {
        broken = `${word}, seed ${seed}, step ${step}: inside ${inside}, noOverlap ${noOverlap}, length ${s.snake.length}`;
        break;
      }
    }
  }
  check("at random, the snake stays on the board and the board always holds what is still needed",
        broken === null, broken || "60 words played");
}
{
  // Something that knows the spelling: a breadth-first search, over squares and the way the
  // snake faces, for the nearest square with the next letter, round every wrong letter,
  // across the wrapping edges. Every word of the term can be finished without one wrong letter.
  const names = Object.keys(DIRS);
  const firstMove = (s, want) => {
    const [hx, hy] = s.snake[0];
    const seen = new Set([`${hx},${hy},${s.facing}`]);
    let frontier = [{ x: hx, y: hy, facing: s.facing, first: null }];
    while (frontier.length) {
      const next = [];
      for (const { x, y, facing, first } of frontier) {
        for (const name of names) {
          const [dx, dy] = DIRS[name];
          const nx = (x + dx + s.cols) % s.cols, ny = (y + dy + s.rows) % s.rows;
          const there = s.cells.get(`${nx},${ny}`);
          if (there !== undefined && there !== want) continue;
          const move = first || name;
          if (there === want) return move;
          const k = `${nx},${ny},${name}`;
          if (!seen.has(k)) { seen.add(k); next.push({ x: nx, y: ny, facing: name, first: move }); }
        }
      }
      frontier = next;
    }
    return null;
  };
  const stuck = [];
  for (const word of words) {
    const rand = seeded(word.length * 31 + word.charCodeAt(0));
    const s = makeBoard({ word, rand, spare: ["a", "e", "t"] });
    let steps = 0;
    while (!s.done && steps < 900) {
      steps += 1;
      const go = firstMove(s, s.letters[s.next]);
      if (!go || !turn(s, go)) break;
      advance(s, rand);
    }
    if (!s.done || s.misses) stuck.push(`${word} (${s.misses} wrong, ${steps} steps)`);
  }
  check("each of the term's 88 words can be eaten in order without a wrong letter",
        stuck.length === 0, stuck.slice(0, 5).join("; "));
}

console.log(`\n${failures ? `${failures} CHECK(S) FAILED` : "all checks passed"}\n`);
process.exit(failures ? 1 : 0);
