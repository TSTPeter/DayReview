// The learning games: word jigsaw, root match, pattern sort, hangman, hidden words,
// and the bonus round. docs/15-games.md says what each one rests on, and what it
// does not.
//
// Everything here sits OUTSIDE the practice loop, on purpose:
//   * Points exist only on these screens. They are earned for a right answer at
//     the first go (performance-contingent, the least harmful class in Deci et
//     al.), never for turning up, and they open the bonus round.
//   * Nothing here touches the scheduler or the attempt log. The dictation is the
//     daily quiz and it never locks; the fixed sequence stays the default.
//   * No wrong spelling is ever left on screen as something to look at. A wrong
//     jigsaw piece goes straight back to the tray; a sort card shows a gap; a
//     wrong hangman letter is a crossed-out key; a hidden-words block is made
//     of nothing but correct spellings.
//
// The content comes from engine/games.py via web/data/games.json.

import { classify, feedback } from "./engine/classify.js";
import { wordForm } from "./engine/derive.js";
import * as scene from "./scene.js";
import * as voice from "./voice.js";
import * as gap from "./gap.js";
import * as lcw from "./lcw.js";
import * as tiles from "./tiles.js";
import * as crossword from "./crossword.js";

export const TICKET = 50;                      // points that open one bonus round
const ROUND = { jigsaw: 5, match: 5, sort: 10, hangman: 5 };
const POINTS = { jigsaw: 10, match: 5, sort: 5, hangman: 10, hunt: 10,
                 gap: 10, lcw: 10, tiles: 10, cross: 10 };
const BONUS_VALUES = [5, 10, 15];
const PAIR_COLOURS = ["var(--cut-teal)", "var(--cut-coral)", "var(--cut-plum)",
                      "var(--cut-mustard)", "var(--cut-sage)"];

const SVG = "http://www.w3.org/2000/svg";

let ctx = null;          // wired by app.js: see init()
let points = { earned: 0, rounds: 0 };

export function init(context) {
  ctx = context;
  // What the newer games are handed: the app's context and the shared parts of this file,
  // so each is a small module of its own and none repeats points, logging or the marking.
  const kit = { ctx, $, shuffle, plural, POINTS, scene, award, logRound, paintPoints, say,
                partSpans, openHub };
  for (const game of [gap, lcw, tiles, crossword]) game.init(kit);
}

const $ = (sel) => document.querySelector(sel);
const shuffle = (xs) => {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

// ------------------------------------------------------------------ points

export async function loadPoints() {
  points = { earned: 0, rounds: 0, ...(await ctx.store.getKV("game_points", {})) };
  return points;
}

export const tickets = (p = points) => Math.floor(p.earned / TICKET) - p.rounds;
const toNext = (p = points) => TICKET - (p.earned % TICKET);

async function award(n) {
  if (!n) return;
  const before = tickets();
  points.earned += n;
  await ctx.store.setKV("game_points", points);
  if (tickets() > before) ctx.sfx.play("unlock");
  paintPoints();
}

function paintPoints() {
  // Every game's chip, but not the bonus round's, which shows that round's own score.
  for (const chip of document.querySelectorAll(".points-chip:not(#bonus-score)")) {
    chip.textContent = `Points: ${points.earned}`;
  }
}

async function logRound(game, items, gained) {
  const log = await ctx.store.getKV("game_log", []);
  log.push({ at: new Date().toISOString(), game, week: ctx.week()?.id || null,
             items, points: gained });
  await ctx.store.setKV("game_log", log);
}

// ------------------------------------------------------------------ hub

export async function openHub() {
  await loadPoints();
  const week = ctx.week();
  const content = week && ctx.data().weeks[week.id];
  $("#games-empty").hidden = !!content;
  for (const id of ["#game-jigsaw", "#game-match", "#game-sort", "#game-hangman",
                    "#game-gap", "#game-lcw", "#game-tiles"]) {
    $(id).disabled = !content;
  }
  $("#game-cross").disabled = !(content && content.crosswords && content.crosswords.length);
  $("#game-hunt").disabled = !(content && content.blocks && content.blocks.length);
  $("#games-week").textContent = week ? `This week: ${week.theme || week.words.join(", ")}` : "";
  $("#game-sort").disabled = !(content && content.sort);
  $("#games-points").textContent = `Your points: ${points.earned}`;
  const ready = tickets();
  $("#games-bonus-state").textContent = ready > 0
    ? (ready === 1 ? "Ready to play!" : `Ready to play! You have ${ready} rounds waiting.`)
    : `${toNext()} more points to open it.`;
  $("#games-bonus-bar").style.width = ready > 0 ? "100%"
    : `${Math.round(((TICKET - toNext()) / TICKET) * 100)}%`;
  $("#game-bonus").disabled = !(ready > 0 && content);
  ctx.show("games");
}

// ------------------------------------------------------------------ word jigsaw

const jig = { items: [], i: 0, first: true, results: [], gained: 0 };

export function startJigsaw() {
  const week = ctx.week();
  const words = week.words.filter((w) => (ctx.data().words[w]?.parts.length || 0) >= 2);
  jig.items = shuffle(words).slice(0, ROUND.jigsaw);
  jig.i = 0; jig.results = []; jig.gained = 0;
  paintPoints();
  ctx.show("jigsaw");
  jigItem();
}

// The shape encodes the piece's place in the word, as a real jigsaw does: a flat
// left edge starts a word, a flat right edge ends one. A decoy takes the shape
// of the piece it could replace, so the shape never gives the choice away.
function pieceShape(part, index, count) {
  return { notch: index > 0, tab: index < count - 1 };
}

function makePiece(part, shape) {
  const b = ctx.el("button", { className: `piece k-${part.kind}`, textContent: part.text });
  b.dataset.text = part.text;
  b.dataset.notch = shape.notch ? "1" : "";
  b.dataset.tab = shape.tab ? "1" : "";
  b.setAttribute("aria-label", part.text === "-" ? "hyphen" : part.text);
  return b;
}

// Draw the cut-paper outline once the piece has a width. Pixel units, so the tab
// stays round whatever the length of the text.
function drawPiece(b) {
  const w = b.offsetWidth, h = b.offsetHeight, r = 10;
  if (!w || !h) return;
  const mid = h / 2;
  const right = b.dataset.tab
    ? `V${mid - r} A${r} ${r} 0 1 1 ${w} ${mid + r} V${h}` : `V${h}`;
  const left = b.dataset.notch
    ? `V${mid + r} A${r} ${r} 0 1 0 0 ${mid - r} V0` : "V0";
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("width", w + r);
  svg.setAttribute("height", h);
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", `M0 0 H${w} ${right} H0 ${left} Z`);
  svg.append(path);
  b.querySelector("svg")?.remove();
  b.prepend(svg);
}

function jigItem() {
  const word = jig.items[jig.i];
  const c = ctx.data().words[word];
  jig.first = true;
  $("#jig-count").textContent = `Word ${jig.i + 1} of ${jig.items.length}`;
  $("#jig-clue").textContent = c.meaning;
  $("#jig-feedback").textContent = "";
  $("#jig-feedback").className = "game-feedback";
  $("#jig-board").className = "jig-board";
  $("#jig-board").replaceChildren();
  $("#jig-next").hidden = true;
  $("#jig-check").hidden = false;
  $("#jig-clear").hidden = false;
  $("#jig-support").replaceChildren();
  $("#jig-support").hidden = true;
  const count = c.parts.length;
  const pieces = c.parts.map((p, i) => makePiece(p, pieceShape(p, i, count)));
  for (const d of c.decoys) {
    const twin = c.parts.length - 1;          // a decoy replaces the last piece
    pieces.push(makePiece(d, pieceShape(d, twin, count)));
  }
  $("#jig-tray").replaceChildren(...shuffle(pieces));
  for (const b of pieces) wirePiece(b);
  requestAnimationFrame(() => pieces.forEach(drawPiece));
  jigState();
}

function jigState() {
  $("#jig-check").disabled = !$("#jig-board").children.length;
}

function movePiece(b, to, before = null) {
  to.insertBefore(b, before);
  drawPiece(b);
  jigState();
}

// Tap moves a piece between tray and board. Drag works too, and drops a piece
// at the place in the word where it lands.
function wirePiece(b) {
  let start = null, ghost = null;
  b.addEventListener("pointerdown", (e) => {
    if ($("#jig-board").classList.contains("done")) return;
    start = { x: e.clientX, y: e.clientY };
    b.setPointerCapture(e.pointerId);
  });
  b.addEventListener("pointermove", (e) => {
    if (!start) return;
    if (!ghost && Math.hypot(e.clientX - start.x, e.clientY - start.y) > 10) {
      ghost = b.cloneNode(true);
      ghost.classList.add("piece-ghost");
      document.body.append(ghost);
      b.classList.add("dragging");
    }
    if (ghost) {
      ghost.style.left = `${e.clientX - b.offsetWidth / 2}px`;
      ghost.style.top = `${e.clientY - b.offsetHeight / 2}px`;
    }
  });
  const end = (e) => {
    if (!start) return;
    const dragged = !!ghost;
    start = null;
    if (ghost) { ghost.remove(); ghost = null; b.classList.remove("dragging"); }
    if ($("#jig-board").classList.contains("done")) return;
    if (!dragged) {
      movePiece(b, b.parentElement.id === "jig-tray" ? $("#jig-board") : $("#jig-tray"));
      return;
    }
    const board = $("#jig-board"), tray = $("#jig-tray");
    const over = (el) => {
      const r = el.getBoundingClientRect();
      return e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
    };
    if (over(board)) {
      const after = [...board.children].find((p) => p !== b
        && e.clientX < p.getBoundingClientRect().left + p.offsetWidth / 2);
      movePiece(b, board, after || null);
    } else if (over(tray)) {
      movePiece(b, tray);
    }
  };
  b.addEventListener("pointerup", end);
  // Keyboard: Enter or Space on a focused piece moves it, as a tap does.
  b.addEventListener("click", (e) => {
    if (e.detail !== 0 || $("#jig-board").classList.contains("done")) return;
    movePiece(b, b.parentElement.id === "jig-tray" ? $("#jig-board") : $("#jig-tray"));
  });
  b.addEventListener("pointercancel", () => {
    start = null;
    if (ghost) { ghost.remove(); ghost = null; b.classList.remove("dragging"); }
  });
}

async function jigCheck() {
  const word = jig.items[jig.i];
  const c = ctx.data().words[word];
  const board = [...$("#jig-board").children];
  const built = board.map((p) => p.dataset.text);
  const target = c.parts.map((p) => p.text);
  const fb = $("#jig-feedback");
  if (built.join("") === word) {
    $("#jig-board").classList.add("done", "pop");
    const gained = jig.first ? POINTS.jigsaw : 0;
    jig.results.push({ word, first_try: jig.first });
    jig.gained += gained;
    fb.className = "game-feedback right";
    fb.textContent = `${target.filter((t) => t !== "-").join(" + ")}. ${c.why}`
      + (gained ? `  +${gained}` : "");
    ctx.sfx.play("correct");
    // The screen answers at once; saving the points can follow.
    $("#jig-check").hidden = true;
    $("#jig-clear").hidden = true;
    $("#jig-next").hidden = false;
    $("#jig-next").textContent = jig.i + 1 < jig.items.length ? "Next word" : "Finish";
    $("#jig-next").focus();
    await award(gained);
    return;
  }
  if (jig.first) showSupport(word, "#jig-support", "jigsaw");
  jig.first = false;
  ctx.sfx.play("notyet");
  fb.className = "game-feedback wrong";
  const decoys = new Set(c.decoys.map((d) => d.text));
  const usedDecoy = board.find((p) => decoys.has(p.dataset.text) && !target.includes(p.dataset.text));
  const sorted = (xs) => [...xs].sort().join("|");
  if (usedDecoy) {
    fb.textContent = `Not that ending. ${c.why}`;
    usedDecoy.classList.add("shake");
    setTimeout(() => { usedDecoy.classList.remove("shake"); movePiece(usedDecoy, $("#jig-tray")); }, 380);
  } else if (sorted(built) === sorted(target)) {
    fb.textContent = "All the right pieces. Now put them in order.";
    for (const p of board) movePiece(p, $("#jig-tray"));
  } else if (target.includes("-") && !built.includes("-")) {
    const [head, ...rest] = word.split("-");
    fb.textContent = `Something goes between ${head} and ${rest.join("-")}.`;
  } else {
    fb.textContent = "There is still a piece missing.";
  }
}

async function jigNext() {
  jig.i += 1;
  if (jig.i < jig.items.length) { jigItem(); return; }
  const firsts = jig.results.filter((r) => r.first_try).length;
  await logRound("jigsaw", jig.results, jig.gained);
  ctx.sfx.play("complete");
  $("#jig-count").textContent = "Round finished";
  $("#jig-clue").textContent = `${plural(jig.results.length, "word")} built, `
    + `${firsts} at the first go.`;
  $("#jig-board").replaceChildren();
  $("#jig-tray").replaceChildren();
  const fb = $("#jig-feedback");
  fb.className = "game-feedback right";
  fb.textContent = jig.gained ? `+${jig.gained} points this round.` : "Every word built.";
  $("#jig-next").hidden = false;
  $("#jig-next").textContent = "Another round";
  $("#jig-next").onclick = () => { $("#jig-next").onclick = jigNext; startJigsaw(); };
}

// ------------------------------------------------------------------ root match

const match = { pairs: [], picked: null, done: new Set(), tried: new Set(), gained: 0,
                lines: [] };

export function startMatch() {
  const week = ctx.week();
  match.pairs = shuffle(ctx.data().weeks[week.id].roots).slice(0, ROUND.match);
  match.picked = null; match.done = new Set(); match.tried = new Set();
  match.gained = 0; match.lines = [];
  paintPoints();
  const left = match.pairs.map((p, i) => ctx.el("button", {
    textContent: p.part, dataset: { i: String(i), side: "left" } }));
  const right = shuffle(match.pairs.map((p, i) => ({ p, i }))).map(({ p, i }) =>
    ctx.el("button", { textContent: p.means, dataset: { i: String(i), side: "right" } }));
  for (const b of [...left, ...right]) b.onclick = () => matchPick(b);
  $("#match-left").replaceChildren(...left);
  $("#match-right").replaceChildren(...right);
  $("#match-lines").replaceChildren();
  $("#match-feedback").textContent = "";
  $("#match-feedback").className = "game-feedback";
  $("#match-again").hidden = true;
  ctx.show("match");
}

// A curly line with a loop in the middle, from one button's edge to the other's.
function swirl(a, b) {
  const box = $("#match-area").getBoundingClientRect();
  const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
  const x1 = ra.right - box.left, y1 = ra.top + ra.height / 2 - box.top;
  const x2 = rb.left - box.left, y2 = rb.top + rb.height / 2 - box.top;
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2, r = Math.min(16, Math.abs(x2 - x1) / 6);
  return `M${x1} ${y1} Q${x1 + (mx - x1) * 0.6} ${y1} ${mx} ${my - r} `
       + `a${r} ${r} 0 1 1 0.1 0 Q${x2 - (x2 - mx) * 0.6} ${y2} ${x2} ${y2}`;
}

function drawLine(a, b, cls, colour) {
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", swirl(a, b));
  if (cls) path.setAttribute("class", cls);
  if (colour) path.style.stroke = colour;
  $("#match-lines").append(path);
  const len = path.getTotalLength ? path.getTotalLength() : 0;
  if (len) {
    path.style.strokeDasharray = cls === "miss" ? "6 8" : `${len}`;
    if (cls !== "miss") {
      path.style.strokeDashoffset = `${len}`;
      requestAnimationFrame(() => requestAnimationFrame(() => { path.style.strokeDashoffset = "0"; }));
    }
  }
  return path;
}

function redrawLines() {
  if (!$("#screen-match").classList.contains("on")) return;
  $("#match-lines").replaceChildren();
  for (const { a, b, colour } of match.lines) {
    const p = drawLine(a, b, "", colour);
    p.style.strokeDasharray = "none";
  }
}
window.addEventListener("resize", redrawLines);

async function matchPick(btn) {
  if (btn.classList.contains("matched")) return;
  const side = btn.dataset.side;
  if (!match.picked || match.picked.dataset.side === side) {
    if (match.picked) match.picked.classList.remove("picked");
    match.picked = btn;
    btn.classList.add("picked");
    return;
  }
  const a = side === "left" ? btn : match.picked;
  const b = side === "left" ? match.picked : btn;
  match.picked.classList.remove("picked");
  match.picked = null;
  const i = Number(a.dataset.i);
  const pair = match.pairs[i];
  const fb = $("#match-feedback");
  if (a.dataset.i === b.dataset.i) {
    const colour = PAIR_COLOURS[match.done.size % PAIR_COLOURS.length];
    for (const x of [a, b]) { x.classList.add("matched"); x.style.setProperty("--pair", colour); }
    drawLine(a, b, "", colour);
    match.lines.push({ a, b, colour });
    match.done.add(i);
    const gained = match.tried.has(i) ? 0 : POINTS.match;
    match.gained += gained;
    // A part that is the whole word (bruise) needs no list of the words it builds.
    const whole = pair.words.length === 1 && pair.words[0] === pair.part;
    a.replaceChildren(document.createTextNode(pair.part),
      ...(whole ? [] : [ctx.el("span", { className: "from", textContent: pair.words.join(", ") })]));
    b.replaceChildren(document.createTextNode(pair.means),
      ctx.el("span", { className: "from", textContent: `from ${pair.from}` }));
    fb.className = "game-feedback right";
    fb.textContent = (whole
      ? `${pair.part} comes from a word meaning "${pair.means}".`
      : `${pair.part} means "${pair.means}": ${pair.words.join(", ")}.`)
      + (gained ? `  +${gained}` : "");
    ctx.sfx.play("correct");
    await award(gained);
    if (match.done.size === match.pairs.length) {
      const firsts = match.pairs.length - match.tried.size;
      await logRound("match", match.pairs.map((p, j) =>
        ({ word: p.words[0], part: p.part, first_try: !match.tried.has(j) })), match.gained);
      ctx.sfx.play("complete");
      fb.textContent = `All ${match.pairs.length} matched, ${firsts} at the first go.`
        + (match.gained ? ` +${match.gained} points this round.` : "");
      $("#match-again").hidden = false;
    }
    return;
  }
  match.tried.add(i);
  ctx.sfx.play("notyet");
  const line = drawLine(a, b, "miss");
  for (const x of [a, b]) x.classList.add("shake");
  fb.className = "game-feedback wrong";
  fb.textContent = `Not those two. ${pair.part} does not mean "${b.textContent}".`;
  setTimeout(() => { line.remove(); for (const x of [a, b]) x.classList.remove("shake"); }, 700);
}

// ------------------------------------------------------------------ pattern sort

// Quick when she is right, slower when she is not. Peter, 1 October 2026:
//   * A right answer gets no note: the gap fills, a sound, the next card.
//   * A miss gets a moment to reflect, not a countdown: the bins rest for a few
//     seconds while she reads the rule and the word's support, and, where the support
//     is saying it aloud and an adult has switched the microphone on, hearing her say
//     it ends the pause early.
//   * Right answers in a row at the first go earn a run sound at 3, 5, 7 and 9, and
//     polyphony from 11; the background grows richer with them and steps back gently
//     on a miss (scene.js).
// The run and the background last for this sitting only. Points never go down.
const REFLECT_MS = 3500;
const NEXT_RIGHT_MS = 650;
const NEXT_AFTER_MISS_MS = 900;
const sort = { deck: null, cards: [], i: 0, first: true, gained: 0, sorted: [], run: 0,
               resting: false, busy: false, listening: null, said: null, shown: null, token: null };
const SEP = { a: "a", e: "e", c: "c", s: "s", hyphen: "-", none: "", space: " " };

export async function startSort(options = {}) {
  const week = ctx.week();
  sort.deck = ctx.data().weeks[week.id].sort;
  if (options.fresh !== false) {
    // A new sitting: a plain background, no run, and the microphone if it is wanted.
    sort.run = 0;
    scene.attach($("#sort-scene"));
    if (await ctx.store.getKV("voice_on", false)) await voice.open();
  }
  // Both bins in every round, or there is nothing to decide.
  const byBin = sort.deck.bins.map((b) => shuffle(sort.deck.cards.filter((c) => c.answer === b.key)));
  const take = [];
  for (let k = 0; take.length < ROUND.sort && byBin.some((xs) => xs.length); k++) {
    const xs = byBin[k % byBin.length];
    if (xs.length) take.push(xs.pop());
  }
  sort.cards = shuffle(take);
  sort.i = 0; sort.gained = 0; sort.sorted = [];
  // A pause or a next-card timer from a round she left is still running: it holds
  // the old card's token, so it can no longer touch this one.
  if (sort.listening) sort.listening.stopped = true;
  sort.listening = null;
  sort.busy = false;
  $("#sort-title").textContent = sort.deck.title;
  $("#sort-result").hidden = true;
  $("#sort-again").hidden = true;
  $("#sort-bins").hidden = false;
  $("#sort-bins").replaceChildren(...sort.deck.bins.map((bin) => {
    const b = ctx.el("button", { dataset: { key: bin.key } });
    b.append(ctx.el("span", { textContent: bin.label }), ctx.el("small", { textContent: bin.note }));
    b.onclick = () => sortPick(bin.key, b);
    return b;
  }));
  rest(false);
  paintPoints();
  ctx.show("sort");
  sortCard();
}

// What kind of deck this is, read off its bins. The colours then say which part
// is which: for -ant/-ent the root is coral and the ending plum; for a prefix the
// prefix is teal; a compound is two whole words. The gap is the decision.
function deckKind(deck) {
  return { "a/e": "ant-ent", "c/s": "noun-verb", "hyphen/none": "prefix",
           "hyphen/space": "compound" }[deck.bins.map((b) => b.key).join("/")];
}
const SORT_KINDS = { "ant-ent": ["k-root", "k-suffix"], prefix: ["k-prefix", "k-root"],
                     compound: ["k-word", "k-word"], "noun-verb": ["", ""] };

function sortCard(filled = null) {
  const card = sort.cards[sort.i];
  const host = $("#sort-card");
  const kind = deckKind(sort.deck);
  host.className = `sort-card${kind === "noun-verb" ? " sentence" : ""}`;
  const [k0, k1] = SORT_KINDS[kind] || ["", ""];
  const kids = [ctx.el("span", { className: k0 ? `part ${k0}` : "", textContent: card.show[0] })];
  if (filled === null) {
    kids.push(ctx.el("span", { className: "gap" }));
  } else if (filled !== "") {
    // 'no hyphen' closes the gap: re + turn is simply return.
    kids.push(ctx.el("span", { className: "gap filled part k-hyphen",
                               textContent: filled === " " ? " " : filled }));
  }
  kids.push(ctx.el("span", { className: k1 ? `part ${k1}` : "", textContent: card.show[1] }));
  host.replaceChildren(...kids);
  $("#sort-count").textContent = `Card ${sort.i + 1} of ${sort.cards.length}`;
  if (filled === null) {
    sort.token = {};
    sort.first = true;
    sort.said = null;
    sort.shown = null;
    say("#sort-feedback", "", "");
    $("#sort-support").replaceChildren();
    $("#sort-support").hidden = true;
  }
}

function rest(on) {
  sort.resting = on;
  $("#sort-bins").classList.toggle("resting", on);
  for (const b of $("#sort-bins").children) b.disabled = on;
}

// A miss: the run ends, the background steps back, and the bins rest while she
// reads. The pause is a moment to reflect, so nothing on screen counts it down.
async function sortMiss(card, btn) {
  sort.first = false;
  sort.run = 0;
  scene.down();
  $("#screen-sort").dataset.run = "0";
  ctx.sfx.play("notyet");
  btn.classList.add("shake");
  setTimeout(() => btn.classList.remove("shake"), 380);
  say("#sort-feedback", "wrong", `Not this time: ${card.explain}`);
  const shows = card.word ? ctx.supports.showsFor(card.word) : [];
  const support = shows.length ? ctx.supports.render(card.word, { shows }) : null;
  $("#sort-support").replaceChildren(...(support ? [support] : []));
  $("#sort-support").hidden = !support;
  sort.shown = shows.join(" ") || null;
  rest(true);
  const token = sort.token;
  const pause = new Promise((resolve) => setTimeout(resolve, REFLECT_MS));
  if (!support || !(shows.includes("say") && voice.isOpen())) {
    await pause;
    if (card.word) ctx.supports.logShown(card.word, "sort", null);
    if (sort.token === token) rest(false);
    return;
  }
  // Saying it aloud, with the microphone on. Hearing her ends the pause early; if she
  // is quiet the bins come back at the usual time and it keeps listening until she
  // picks, so a late "said it" still counts.
  const signal = { stopped: false };
  sort.listening = signal;
  const bar = ctx.el("i");
  const meter = ctx.el("div", { className: "listen" }, [
    ctx.el("span", { className: "mic", textContent: "Listening" }),
    ctx.el("span", { className: "meter" }, [bar])]);
  support.append(meter);
  const heard = voice.listen(REFLECT_MS * 3, (v) => { bar.style.width = `${Math.round(v * 100)}%`; },
                             signal);
  heard.then((result) => {
    const said = result === "heard";
    if (sort.token === token && sort.listening === signal) {
      sort.said = said;
      sort.listening = null;
      if (said) meter.replaceChildren(ctx.el("span", { className: "mic heard", textContent: "I heard you." }));
    }
    if (card.word) ctx.supports.logShown(card.word, "sort", said);
  });
  await Promise.race([heard, pause]);
  if (sort.token === token) rest(false);
}

async function sortPick(key, btn) {
  if (sort.busy || sort.resting) return;
  const card = sort.cards[sort.i];
  if (key !== card.answer) { await sortMiss(card, btn); return; }
  sort.busy = true;
  if (sort.listening) {
    // She picked before saying it: stop listening, and it was not said.
    sort.listening.stopped = true;
    sort.listening = null;
    if (sort.said !== true) sort.said = false;
  }
  const first = sort.first;
  const gained = first ? POINTS.sort : 0;
  sort.gained += gained;
  sort.sorted.push({ card, first_try: first, support: sort.shown, said: sort.said });
  sortCard(SEP[card.answer]);
  $("#sort-card").classList.add("pop");
  // No note on a right answer, only the points. The rule waits for a miss.
  say("#sort-feedback", "right", gained ? `+${gained}` : "");
  if (first) {
    sort.run += 1;
    scene.up();
    $("#screen-sort").dataset.run = String(sort.run);
    if (!ctx.sfx.isRunMilestone(sort.run) || !ctx.sfx.playRun(sort.run)) ctx.sfx.play("correct");
  } else {
    ctx.sfx.play("correct");
  }
  const token = sort.token;
  await award(gained);
  setTimeout(async () => {
    if (sort.token !== token) return;     // she left, and a new round has begun
    $("#sort-card").classList.remove("pop");
    sort.busy = false;
    sort.i += 1;
    if (sort.i < sort.cards.length) { sortCard(); return; }
    await sortEnd();
  }, first ? NEXT_RIGHT_MS : NEXT_AFTER_MISS_MS);
}

async function sortEnd() {
  ctx.sfx.play("complete");
  $("#sort-card").replaceChildren(ctx.el("span", { textContent: "All sorted." }));
  $("#sort-count").textContent = "Round finished";
  $("#sort-bins").hidden = true;
  $("#sort-support").hidden = true;
  // The pattern, made visible: every card in its bin.
  const cols = sort.deck.bins.map((bin) => {
    const col = ctx.el("div", { className: "sheet kraft" });
    col.append(ctx.el("span", { className: "tab", textContent: `${bin.label}: ${bin.note}` }));
    const ul = ctx.el("ul");
    for (const s of sort.sorted.filter((x) => x.card.answer === bin.key)) {
      ul.append(ctx.el("li", { textContent: s.card.full }));
    }
    col.append(ul);
    return col;
  });
  $("#sort-result").replaceChildren(...cols);
  $("#sort-result").hidden = false;
  const firsts = sort.sorted.filter((s) => s.first_try).length;
  say("#sort-feedback", "right", `${firsts} of ${sort.sorted.length} at the first go.`
    + (sort.gained ? ` +${sort.gained} points this round.` : ""));
  $("#sort-again").hidden = false;
  await logRound("sort", sort.sorted.map((s) => ({ word: s.card.word, full: s.card.full,
    first_try: s.first_try, support: s.support, said: s.said })), sort.gained);
}

/** Leaving the game ends the sitting: the microphone closes at once. */
function leaveSort() {
  if (sort.listening) sort.listening.stopped = true;
  voice.close();
  openHub();
}

// ------------------------------------------------------------------ shared by the letter games

// A hint halves what the word is worth: enough to make trying first worth it,
// not so much that she stays stuck rather than ask. Judgement (docs/15).
const hinted = (n) => Math.floor(n / 2);

// After a miss, the word's support (experiments/2026-10-support-types.md): its arm's
// pieces once the experiment runs, where it comes from and saying it aloud before.
function showSupport(word, sel, where) {
  const card = ctx.supports.render(word);
  $(sel).replaceChildren(...(card ? [card] : []));
  $(sel).hidden = !card;
  if (card) ctx.supports.logShown(word, where);
}

function say(sel, tone, text) {
  const fb = $(sel);
  fb.className = `game-feedback${tone ? ` ${tone}` : ""}`;
  fb.textContent = text;
}

// The word in its parts, each in its colour: the same picture as every other game.
const partSpans = (word) => ctx.data().words[word].parts.map((p) =>
  ctx.el("span", { className: `part k-${p.kind}`, textContent: p.text }));

// One part kind per letter, hyphens included, for colouring a word letter by letter.
const letterKinds = (word) => ctx.data().words[word].parts.flatMap((p) => [...p.text].map(() => p.kind));

const theme = (week) => (week.theme || "").replace(/-/g, "‑");

// ------------------------------------------------------------------ hangman

// Eight petals, so eight wrong letters. They fall in an order that keeps the
// flower looking balanced for as long as it can.
const PETALS = 8;
const FALL_ORDER = [0, 4, 2, 6, 1, 5, 3, 7];
const KEYS = [..."abcdefghijklmnopqrstuvwxyz", "-"];
const PETAL_PATH = "M100 92 C 80 72 82 42 100 32 C 118 42 120 72 100 92 Z";
const hang = { items: [], i: 0, word: "", guessed: new Set(), given: new Set(), misses: 0,
               hinted: false, done: false, keys: new Map(), results: [], gained: 0 };

export function startHangman() {
  const week = ctx.week();
  hang.items = shuffle(week.words.filter((w) => ctx.data().words[w])).slice(0, ROUND.hangman);
  hang.i = 0; hang.results = []; hang.gained = 0;
  $("#hang-next").onclick = hangNext;
  paintPoints();
  ctx.show("hangman");
  hangItem();
}

function drawFlower() {
  const petals = [];
  for (let k = 0; k < PETALS; k++) {
    const g = document.createElementNS(SVG, "g");
    g.dataset.k = String(k);
    const p = document.createElementNS(SVG, "path");
    p.setAttribute("class", "petal");
    p.setAttribute("d", PETAL_PATH);
    p.setAttribute("transform", `rotate(${k * 45} 100 92)`);
    g.append(p);
    petals.push(g);
  }
  $("#hang-petals").replaceChildren(...petals);
}

function hangItem() {
  hang.word = hang.items[hang.i];
  hang.guessed = new Set(); hang.given = new Set();
  hang.misses = 0; hang.hinted = false; hang.done = false;
  $("#hang-count").textContent = `Word ${hang.i + 1} of ${hang.items.length}. `
    + `This week: ${theme(ctx.week())}`;
  drawFlower();
  hang.keys = new Map(KEYS.map((k) => {
    const b = ctx.el("button", { textContent: k, dataset: { key: k } });
    b.setAttribute("aria-label", k === "-" ? "hyphen" : k);
    b.onclick = () => hangGuess(k);
    return [k, b];
  }));
  $("#hang-keys").replaceChildren(...hang.keys.values());
  $("#hang-keys").hidden = false;
  $("#hang-input").value = "";
  $("#hang-solve").disabled = true;
  $("#hang-solve-row").hidden = false;
  $("#hang-hint").hidden = false;
  $("#hang-hint").disabled = false;
  $("#hang-next").hidden = true;
  $("#hang-reveal").hidden = true;
  say("#hang-feedback", "", "");
  paintHang();
}

function paintHang() {
  const word = [...hang.word];
  const shown = (ch) => hang.done || hang.guessed.has(ch);
  $("#hang-word").replaceChildren(...word.map((ch) => ctx.el("span", {
    className: `slot${shown(ch) ? " shown" : ""}${hang.given.has(ch) ? " given" : ""}`,
    textContent: shown(ch) ? ch : "" })));
  // Read out what is showing, never what is hidden.
  $("#hang-word").setAttribute("aria-label", `The word: ${word.map((ch) =>
    (shown(ch) ? (ch === "-" ? "hyphen" : ch) : "blank")).join(", ")}`);
  const left = PETALS - hang.misses;
  $("#hang-left").textContent = hang.done ? "" : `${plural(left, "petal")} left`;
}

async function hangGuess(k, hint = false) {
  if (hang.done || hang.guessed.has(k)) return;
  hang.guessed.add(k);
  if (hint) hang.given.add(k);
  const key = hang.keys.get(k);
  key.disabled = true;
  if (hang.word.includes(k)) {
    key.classList.add("hit");
    say("#hang-feedback", "", hint ? `A place to start: ${k}.` : "");
    paintHang();
    if ([...hang.word].every((ch) => hang.guessed.has(ch))) await hangEnd(true);
    return;
  }
  key.classList.add("miss");
  await hangMiss(k === "-" ? "No hyphen in this word." : `No ${k} in this word.`);
}

async function hangMiss(message) {
  hang.misses += 1;
  $(`#hang-petals [data-k="${FALL_ORDER[hang.misses - 1]}"]`).classList.add("falling", "fallen");
  paintHang();
  if (hang.misses >= PETALS) { await hangEnd(false); return; }
  ctx.sfx.play("notyet");
  say("#hang-feedback", "wrong", message);
}

// A starting place: the first letter still hidden, reading from the left. Never
// the hyphen, which in the hyphen weeks is the very decision she is there to make.
async function hangHint() {
  if (hang.done || hang.hinted) return;
  const ch = [...hang.word].find((c) => c !== "-" && !hang.guessed.has(c));
  if (!ch) return;
  hang.hinted = true;
  $("#hang-hint").disabled = true;
  await hangGuess(ch, true);
}

// Typing the whole word is the way to finish early, and the one move here that
// is free recall. A wrong guess costs a petal, and it never stays on screen.
async function hangSolve() {
  if (hang.done) return;
  const typed = wordForm($("#hang-input").value);
  $("#hang-input").value = "";
  $("#hang-solve").disabled = true;
  if (!typed) return;
  if (typed === hang.word) { await hangEnd(true, true); return; }
  await hangMiss("That is not it. Keep guessing.");
}

async function hangEnd(solved, typed = false) {
  hang.done = true;
  if (!solved) for (const ch of hang.word) if (!hang.guessed.has(ch)) hang.given.add(ch);
  const gained = !solved ? 0 : hang.hinted ? hinted(POINTS.hangman) : POINTS.hangman;
  hang.results.push({ word: hang.word, solved, hint: hang.hinted, misses: hang.misses, typed });
  hang.gained += gained;
  paintHang();
  $("#hang-keys").hidden = true;
  $("#hang-solve-row").hidden = true;
  $("#hang-hint").hidden = true;
  // A miss is information: the word in its parts, and its rule.
  $("#hang-reveal").replaceChildren(
    ctx.el("p", { className: "whole" }, partSpans(hang.word)),
    ctx.el("p", { className: "muted", textContent: ctx.data().words[hang.word].why }));
  $("#hang-reveal").hidden = false;
  if (!solved) {
    const card = ctx.supports.render(hang.word);
    if (card) {
      $("#hang-reveal").append(card);
      ctx.supports.logShown(hang.word, "hangman");
    }
  }
  say("#hang-feedback", solved ? "right" : "wrong", solved
    ? `${typed ? "You knew it!" : "You got it!"}${gained ? `  +${gained}` : ""}`
    : "Out of petals this time. Here is the word.");
  ctx.sfx.play(solved ? "correct" : "notyet");
  $("#hang-next").hidden = false;
  $("#hang-next").textContent = hang.i + 1 < hang.items.length ? "Next word" : "Finish";
  $("#hang-next").focus();
  await award(gained);
}

async function hangNext() {
  hang.i += 1;
  if (hang.i < hang.items.length) { hangItem(); return; }
  ctx.sfx.play("complete");
  const solved = hang.results.filter((r) => r.solved);
  $("#hang-count").textContent = "Round finished";
  $("#hang-reveal").hidden = true;
  $("#hang-word").replaceChildren();
  $("#hang-left").textContent = "";
  say("#hang-feedback", "right", `${solved.length} of ${hang.results.length} solved, `
    + `${solved.filter((r) => !r.hint).length} without a hint.`
    + (hang.gained ? ` +${hang.gained} points this round.` : ""));
  $("#hang-next").textContent = "Another round";
  $("#hang-next").onclick = startHangman;
  await logRound("hangman", hang.results, hang.gained);
}

// ------------------------------------------------------------------ hidden words

// A block from engine/wordblocks.py: four or five of the week's words fill it,
// each a path through touching letters. She traces a word by tapping its letters
// one after another, or by sliding through them. Any route that spells a hidden
// word counts. The block carries every route and every way they fit together, so
// checking her route is a lookup, never a search.
const hunt = { block: null, found: new Map(), trace: [], hint: null, hinted: new Set(),
               gained: 0, done: false, saving: null };

export async function startHunt() {
  await hunt.saving;
  const week = ctx.week();
  const blocks = ctx.data().weeks[week.id].blocks;
  // The next block in the week's order: a finished block is logged, so the log
  // says how many she has done this week.
  const log = await ctx.store.getKV("game_log", []);
  const done = log.filter((r) => r.game === "hunt" && r.week === week.id).length;
  const b = hunt.block = blocks[done % blocks.length];
  hunt.found = new Map(); hunt.trace = []; hunt.hint = null; hunt.hinted = new Set();
  hunt.gained = 0; hunt.done = false;
  $("#hunt-wrap").style.setProperty("--cols", String(b.cols));
  $("#hunt-grid").replaceChildren(...[...b.letters].map((ch, i) => {
    const cell = ctx.el("button", { className: "hunt-cell", textContent: ch,
                                    dataset: { i: String(i) } });
    if (ch === "-") cell.setAttribute("aria-label", "hyphen");
    return cell;
  }));
  $("#hunt-found").replaceChildren();
  $("#hunt-again").hidden = true;
  $("#hunt-hint").hidden = false;
  $("#hunt-clear").hidden = false;
  say("#hunt-feedback", "", "");
  paintPoints();
  huntCount();
  ctx.show("hunt");
  requestAnimationFrame(huntDraw);
}

const huntCell = (i) => $("#hunt-grid").children[i];

function adjacent(a, b) {
  const cols = hunt.block.cols;
  return a !== b && Math.abs(Math.floor(a / cols) - Math.floor(b / cols)) <= 1
    && Math.abs((a % cols) - (b % cols)) <= 1;
}

const spent = () => new Set([...hunt.found].flatMap(([w, r]) => hunt.block.routes[w][r]));

// The ways the whole block can still be finished, given what she has found.
const stillFits = () => hunt.block.tilings.filter((t) =>
  [...hunt.found].every(([w, r]) => t[w] === r));

function huntCount() {
  const b = hunt.block;
  $("#hunt-count").textContent = `${plural(b.words.length, "word")} from this week `
    + `(${theme(ctx.week())}) are hiding here. Found: ${hunt.found.size}.`;
}

// Tap the next letter to add it, the last letter again to take it back, an
// earlier one to go back to there, or any other letter to start again from it.
function huntTap(i) {
  if (hunt.done || spent().has(i)) return;
  const t = hunt.trace;
  const at = t.indexOf(i);
  if (at >= 0 && at === t.length - 1) t.pop();
  else if (at >= 0) t.length = at + 1;
  else if (t.length && adjacent(t[t.length - 1], i)) t.push(i);
  else hunt.trace = [i];
  huntChanged();
}

// Sliding a finger through the letters does the same. Only the middle of a letter
// counts as touching it, so a diagonal slide does not clip the letters it passes.
function wireHunt() {
  const grid = $("#hunt-grid");
  let drag = null;
  const cellAt = (x, y) => {
    const cell = document.elementFromPoint(x, y)?.closest(".hunt-cell");
    if (!cell || !grid.contains(cell)) return null;
    const r = cell.getBoundingClientRect();
    const off = Math.hypot(x - (r.left + r.width / 2), y - (r.top + r.height / 2));
    return off <= r.width * 0.42 ? Number(cell.dataset.i) : null;
  };
  grid.addEventListener("pointerdown", (e) => {
    const cell = e.target.closest(".hunt-cell");
    if (!cell || hunt.done) return;
    const i = Number(cell.dataset.i);
    drag = { id: e.pointerId, start: i, last: i, moved: false };
    grid.setPointerCapture(e.pointerId);
  });
  grid.addEventListener("pointermove", (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const i = cellAt(e.clientX, e.clientY);
    if (i === null || i === drag.last) return;
    if (!drag.moved) {
      drag.moved = true;
      // A slide carries on from the end of the trace, or starts a new one.
      if (hunt.trace[hunt.trace.length - 1] !== drag.start) {
        hunt.trace = spent().has(drag.start) ? [] : [drag.start];
      }
    }
    drag.last = i;
    const t = hunt.trace;
    if (t.length >= 2 && t[t.length - 2] === i) { t.pop(); huntChanged(); return; }
    if (!t.length || spent().has(i) || t.includes(i) || !adjacent(t[t.length - 1], i)) return;
    t.push(i);
    huntChanged();
  });
  grid.addEventListener("pointerup", (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const { start, moved } = drag;
    drag = null;
    if (!moved) huntTap(start);
  });
  grid.addEventListener("pointercancel", () => { drag = null; });
  // Keyboard: Enter or Space on a focused letter taps it.
  grid.addEventListener("click", (e) => {
    const cell = e.target.closest(".hunt-cell");
    if (cell && e.detail === 0) huntTap(Number(cell.dataset.i));
  });
  window.addEventListener("resize", () => {
    if ($("#screen-hunt").classList.contains("on")) huntDraw();
  });
}

async function huntChanged() {
  paintTrace();
  const b = hunt.block;
  const t = hunt.trace;
  const w = b.words.indexOf(t.map((i) => b.letters[i]).join(""));
  if (w < 0) return;
  if (hunt.found.has(w)) {
    say("#hunt-feedback", "", `You have found ${b.words[w]} already.`);
    hunt.trace = [];
    paintTrace();
    return;
  }
  const r = b.routes[w].findIndex((route) =>
    route.length === t.length && route.every((c, k) => c === t[k]));
  const fits = stillFits();
  if (r >= 0 && fits.some((f) => f[w] === r)) { await huntFound(w, r, false); return; }
  // Spelled right, along a route that would leave the rest unable to fit. It still
  // counts: the word moves to the nearest route that fits, starting where she did
  // if it can.
  const score = (k) => {
    const route = b.routes[w][k];
    return (route[0] === t[0] ? 100 : 0) + route.filter((c) => t.includes(c)).length;
  };
  const best = fits.map((f) => f[w]).sort((x, y) => score(y) - score(x))[0];
  await huntFound(w, best, true);
}

function paintTrace() {
  const on = new Set(hunt.trace);
  for (const cell of $("#hunt-grid").children) {
    cell.classList.toggle("on", on.has(Number(cell.dataset.i)));
  }
  huntDraw();
}

// The lines run underneath the letters, in the gaps between them.
function huntDraw() {
  const b = hunt.block;
  if (!b) return;
  const box = $("#hunt-wrap").getBoundingClientRect();
  const centre = (i) => {
    const r = huntCell(i).getBoundingClientRect();
    return `${r.left - box.left + r.width / 2},${r.top - box.top + r.height / 2}`;
  };
  const line = (cells, cls) => {
    const p = document.createElementNS(SVG, "polyline");
    p.setAttribute("class", cls);
    p.setAttribute("points", cells.map(centre).join(" "));
    return p;
  };
  $("#hunt-lines").replaceChildren(
    ...[...hunt.found].map(([w, r]) => line(b.routes[w][r], "word")),
    ...(hunt.trace.length > 1 ? [line(hunt.trace, "trace")] : []));
}

async function huntFound(w, r, moved) {
  const b = hunt.block;
  const word = b.words[w];
  hunt.found.set(w, r);
  hunt.trace = [];
  const kinds = letterKinds(word);
  b.routes[w][r].forEach((c, k) => huntCell(c).classList.add("found", `k-${kinds[k]}`));
  if (hunt.hint && hunt.hint.w === w) hunt.hint = null;
  paintHint();
  paintTrace();
  const gained = hunt.hinted.has(word) ? hinted(POINTS.hunt) : POINTS.hunt;
  hunt.gained += gained;
  $("#hunt-found").append(ctx.el("span", {}, partSpans(word)));
  say("#hunt-feedback", "right", `Found ${word}!${moved ? " In this block it fits here." : ""}`
    + `  +${gained}`);
  huntCount();
  // The screen answers at once; saving follows.
  const last = hunt.found.size === b.words.length;
  if (last) huntEnd(word);
  else ctx.sfx.play("correct");
  await award(gained);
  if (last) await hunt.saving;
}

// A starting place: the first letter of a word she has not found yet is ringed.
// Asking again rings the next letter of the same word, which shows the way it
// goes. It never rings a whole word.
function huntHint() {
  if (hunt.done) return;
  const b = hunt.block;
  if (!hunt.hint) {
    const w = b.words.findIndex((_, k) => !hunt.found.has(k));
    if (w < 0) return;
    hunt.hint = { w, lit: 0, route: null };
  }
  const h = hunt.hint;
  hunt.hinted.add(b.words[h.w]);
  const route = hintRoute();
  h.lit = Math.min(h.lit + 1, route.length - 1);
  paintHint();
  say("#hunt-feedback", "", h.lit === 1 ? "A word starts at the ringed letter."
    : "The ringed letters are the start of a word, in order.");
}

// The hinted word's route in a layout that can still be finished, keeping the
// letters already ringed where they are.
function hintRoute() {
  const b = hunt.block, h = hunt.hint;
  const fits = stillFits();
  const lit = h.route ? h.route.slice(0, h.lit) : [];
  h.route = fits.map((f) => b.routes[h.w][f[h.w]]).find((r) => lit.every((c, k) => r[k] === c))
    || b.routes[h.w][fits[0][h.w]];
  return h.route;
}

function paintHint() {
  if (hunt.hint) hintRoute();
  const ringed = new Set(hunt.hint ? hunt.hint.route.slice(0, hunt.hint.lit) : []);
  for (const cell of $("#hunt-grid").children) {
    cell.classList.toggle("hint", ringed.has(Number(cell.dataset.i)));
  }
}

function huntEnd(word) {
  hunt.done = true;
  const b = hunt.block;
  const items = b.words.map((w) => ({ word: w, hint: hunt.hinted.has(w) }));
  ctx.sfx.play("complete");
  say("#hunt-feedback", "right", `Found ${word}! All ${b.words.length} found, `
    + `${items.filter((x) => !x.hint).length} without a hint.`
    + (hunt.gained ? ` +${hunt.gained} points this block.` : ""));
  $("#hunt-hint").hidden = true;
  $("#hunt-clear").hidden = true;
  $("#hunt-again").hidden = false;
  $("#hunt-again").focus();
  // "Another block" waits for this: the log is how it knows which block is next.
  hunt.saving = logRound("hunt", items, hunt.gained);
}

// ------------------------------------------------------------------ bonus round

const bonus = { tiles: [], open: null, score: 0 };

export async function startBonus() {
  await loadPoints();
  if (tickets() <= 0) return openHub();
  points.rounds += 1;
  await ctx.store.setKV("game_points", points);
  // This week, last week, the week before: older words are worth the same, so a
  // round is spaced retrieval of the term so far, not just of this week's list.
  const weeks = ctx.weeksSoFar().slice(-3).reverse();
  const cats = [];
  for (const w of weeks) {
    const words = shuffle(w.words.filter((x) => ctx.data().words[x])).slice(0, 3)
      .sort((x, y) => x.length - y.length);
    if (words.length === 3) cats.push({ name: w.theme || "This week", words });
  }
  // A short term so far: make up three columns from this week alone.
  while (cats.length < 3) {
    const pool = shuffle(weeks[0].words.filter((x) => ctx.data().words[x]
      && !cats.some((c) => c.words.includes(x))));
    if (pool.length < 3) break;
    cats.push({ name: weeks[0].theme || "This week", words: pool.slice(0, 3)
      .sort((x, y) => x.length - y.length) });
  }
  bonus.tiles = [];
  bonus.score = 0;
  const board = $("#bonus-board");
  // Non-breaking hyphens, so "-ant, -ance and -ancy" never wraps at a hyphen.
  board.replaceChildren(...cats.map((c) => ctx.el("div", { className: "cat",
    textContent: c.name.replace(/-/g, "\u2011") })));
  for (let row = 0; row < 3; row++) {
    for (const c of cats) {
      const tile = { word: c.words[row], value: BONUS_VALUES[row], cat: c.name, done: false };
      tile.btn = ctx.el("button", { textContent: String(tile.value) });
      tile.btn.setAttribute("aria-label", `${c.name}, ${tile.value}`);
      tile.btn.onclick = () => bonusOpen(tile);
      bonus.tiles.push(tile);
      board.append(tile.btn);
    }
  }
  board.style.gridTemplateColumns = `repeat(${cats.length}, 1fr)`;
  $("#bonus-clue").hidden = true;
  $("#bonus-end").hidden = true;
  $("#bonus-board").hidden = false;
  $("#bonus-score").textContent = "Score: 0";
  ctx.show("bonus");
}

function bonusOpen(tile) {
  if (tile.done) return;
  bonus.open = tile;
  const c = ctx.data().words[tile.word];
  const letters = tile.word.replace(/-/g, "").length;
  $("#bonus-clue-tab").textContent = `${tile.cat}, ${tile.value}`;
  $("#bonus-clue-text").textContent = c.meaning;
  // First letter and length: enough to make the clue fair, no more.
  $("#bonus-clue-hint").textContent = `Starts with "${tile.word[0]}". ${letters} letters.`;
  $("#bonus-input").value = "";
  $("#bonus-check").disabled = true;
  $("#bonus-result").hidden = true;
  $("#bonus-check").hidden = false;
  $("#bonus-input").disabled = false;
  $("#bonus-board").hidden = true;
  $("#bonus-clue").hidden = false;
  $("#bonus-input").focus();
}

async function bonusCheck() {
  const tile = bonus.open;
  const raw = $("#bonus-input").value;
  if (!raw.trim()) return;
  const entry = ctx.entryFor(tile.word);
  const d = classify(raw, entry);
  tile.done = true;
  tile.correct = d.correct;
  tile.type = d.type;
  if (d.correct) bonus.score += tile.value;
  $("#bonus-input").disabled = true;
  $("#bonus-check").hidden = true;
  $("#bonus-result").hidden = false;
  const v = $("#bonus-verdict");
  v.className = `verdict ${d.correct ? "right" : "wrong"}`;
  v.textContent = d.correct ? `Correct! +${tile.value}` : feedback(d, entry).headline;
  $("#bonus-marked").replaceChildren(ctx.markedUp(tile.word, d));
  $("#bonus-why").textContent = d.correct ? (entry.why || "") : `${tile.word}. ${entry.why || ""}`;
  $("#bonus-support").replaceChildren();
  $("#bonus-support").hidden = true;
  if (!d.correct) showSupport(tile.word, "#bonus-support", "bonus");
  tile.btn.classList.add("done", d.correct ? "right" : "wrong");
  tile.btn.textContent = tile.word;
  $("#bonus-score").textContent = `Score: ${bonus.score}`;
  ctx.sfx.play(d.correct ? "correct" : "notyet");
  if (d.correct) await award(tile.value);
  $("#bonus-back").focus();
}

async function bonusBack() {
  $("#bonus-clue").hidden = true;
  $("#bonus-board").hidden = false;
  if (bonus.tiles.every((t) => t.done)) await bonusEnd();
}

async function bonusEnd() {
  const right = bonus.tiles.filter((t) => t.correct);
  await logRound("bonus", bonus.tiles.map((t) => ({ word: t.word, correct: !!t.correct,
                                                     error_type: t.type })), bonus.score);
  ctx.sfx.play("complete");
  $("#bonus-end-text").textContent = `You scored ${bonus.score} in the bonus round.`;
  const wrong = bonus.tiles.filter((t) => !t.correct).map((t) => t.word);
  $("#bonus-end-words").textContent = `${right.length} of ${bonus.tiles.length} spelled right.`
    + (wrong.length ? ` Worth another look: ${wrong.join(", ")}.` : "");
  $("#bonus-end").hidden = false;
}

// ------------------------------------------------------------------ wiring

export function wire() {
  $("#game-jigsaw").onclick = startJigsaw;
  $("#game-match").onclick = startMatch;
  $("#game-sort").onclick = () => startSort({ fresh: true });
  $("#game-bonus").onclick = startBonus;
  $("#game-hangman").onclick = startHangman;
  $("#game-hunt").onclick = startHunt;
  $("#game-gap").onclick = () => gap.start();
  $("#game-lcw").onclick = () => lcw.start();
  $("#game-tiles").onclick = () => tiles.start();
  $("#game-cross").onclick = () => crossword.start();
  for (const game of [gap, lcw, tiles, crossword]) game.wire();
  $("#hang-hint").onclick = hangHint;
  $("#hang-solve").onclick = hangSolve;
  $("#hang-input").addEventListener("input", (e) => {
    $("#hang-solve").disabled = !e.target.value.trim();
  });
  $("#hang-input").addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); hangSolve(); }
  });
  // A keyboard, where there is one, guesses letters too.
  document.addEventListener("keydown", (e) => {
    if (!$("#screen-hangman").classList.contains("on") || e.target === $("#hang-input")) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key.toLowerCase();
    if (/^[a-z]$/.test(k) || k === "-") { e.preventDefault(); hangGuess(k); }
  });
  $("#hunt-hint").onclick = huntHint;
  $("#hunt-clear").onclick = () => { hunt.trace = []; paintTrace(); say("#hunt-feedback", "", ""); };
  $("#hunt-again").onclick = startHunt;
  wireHunt();
  $("#jig-check").onclick = jigCheck;
  $("#jig-clear").onclick = () => { for (const p of [...$("#jig-board").children]) movePiece(p, $("#jig-tray")); };
  $("#jig-next").onclick = jigNext;
  $("#match-again").onclick = startMatch;
  $("#sort-again").onclick = () => startSort({ fresh: false });
  $("#bonus-input").addEventListener("input", (e) => {
    $("#bonus-check").disabled = !e.target.value.trim();
  });
  $("#bonus-input").addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); bonusCheck(); }
  });
  $("#bonus-check").onclick = bonusCheck;
  $("#bonus-back").onclick = bonusBack;
  for (const id of ["#jig-quit", "#match-quit", "#bonus-quit", "#hang-quit",
                    "#hunt-quit"]) $(id).onclick = openHub;
  $("#sort-quit").onclick = leaveSort;
}
