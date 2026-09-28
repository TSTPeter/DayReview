// The learning games: word jigsaw, root match, pattern sort, and the bonus round.
// docs/15-games.md says what each one rests on, and what it does not.
//
// Everything here sits OUTSIDE the practice loop, on purpose:
//   * Points exist only on these screens. They are earned for a right answer at
//     the first go (performance-contingent, the least harmful class in Deci et
//     al.), never for turning up, and they open the bonus round.
//   * Nothing here touches the scheduler or the attempt log. The dictation is the
//     daily quiz and it never locks; the fixed sequence stays the default.
//   * No wrong spelling is ever left on screen as something to look at. A wrong
//     jigsaw piece goes straight back to the tray; a sort card shows a gap.
//
// The content comes from engine/games.py via web/data/games.json.

import { classify, feedback } from "./engine/classify.js";

export const TICKET = 50;                      // points that open one bonus round
const ROUND = { jigsaw: 5, match: 5, sort: 10 };
const POINTS = { jigsaw: 10, match: 5, sort: 5 };
const BONUS_VALUES = [5, 10, 15];
const PAIR_COLOURS = ["var(--cut-teal)", "var(--cut-coral)", "var(--cut-plum)",
                      "var(--cut-mustard)", "var(--cut-sage)"];

let ctx = null;          // wired by app.js: see init()
let points = { earned: 0, rounds: 0 };

export function init(context) { ctx = context; }

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
  for (const id of ["#jig-points", "#match-points", "#sort-points"]) {
    const chip = $(id);
    if (chip) chip.textContent = `Points: ${points.earned}`;
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
  for (const id of ["#game-jigsaw", "#game-match", "#game-sort"]) $(id).disabled = !content;
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

const sort = { deck: null, cards: [], i: 0, first: true, gained: 0, sorted: [] };
const SEP = { a: "a", e: "e", c: "c", s: "s", hyphen: "-", none: "", space: " " };

export function startSort() {
  const week = ctx.week();
  sort.deck = ctx.data().weeks[week.id].sort;
  // Both bins in every round, or there is nothing to decide.
  const byBin = sort.deck.bins.map((b) => shuffle(sort.deck.cards.filter((c) => c.answer === b.key)));
  const take = [];
  for (let k = 0; take.length < ROUND.sort && byBin.some((xs) => xs.length); k++) {
    const xs = byBin[k % byBin.length];
    if (xs.length) take.push(xs.pop());
  }
  sort.cards = shuffle(take);
  sort.i = 0; sort.gained = 0; sort.sorted = [];
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
                               textContent: filled === " " ? "\u00a0" : filled }));
  }
  kids.push(ctx.el("span", { className: k1 ? `part ${k1}` : "", textContent: card.show[1] }));
  host.replaceChildren(...kids);
  $("#sort-count").textContent = `Card ${sort.i + 1} of ${sort.cards.length}`;
  if (filled === null) {
    sort.first = true;
    $("#sort-feedback").textContent = "";
    $("#sort-feedback").className = "game-feedback";
  }
}

async function sortPick(key, btn) {
  if (sort.busy) return;
  const card = sort.cards[sort.i];
  const fb = $("#sort-feedback");
  if (key !== card.answer) {
    sort.first = false;
    ctx.sfx.play("notyet");
    btn.classList.add("shake");
    setTimeout(() => btn.classList.remove("shake"), 380);
    fb.className = "game-feedback wrong";
    fb.textContent = `Not this time: ${card.explain}`;
    return;
  }
  sort.busy = true;
  const gained = sort.first ? POINTS.sort : 0;
  sort.gained += gained;
  sort.sorted.push({ card, first_try: sort.first });
  sortCard(SEP[card.answer]);
  $("#sort-card").classList.add("pop");
  fb.className = "game-feedback right";
  fb.textContent = `Yes: ${card.explain}` + (gained ? `  +${gained}` : "");
  ctx.sfx.play("correct");
  await award(gained);
  setTimeout(async () => {
    $("#sort-card").classList.remove("pop");
    sort.busy = false;
    sort.i += 1;
    if (sort.i < sort.cards.length) { sortCard(); return; }
    await sortEnd();
  }, 1100);
}

async function sortEnd() {
  await logRound("sort", sort.sorted.map((s) => ({ word: s.card.word, full: s.card.full,
                                                     first_try: s.first_try })), sort.gained);
  ctx.sfx.play("complete");
  $("#sort-card").replaceChildren(ctx.el("span", { textContent: "All sorted." }));
  $("#sort-count").textContent = "Round finished";
  $("#sort-bins").hidden = true;
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
  const fb = $("#sort-feedback");
  fb.className = "game-feedback right";
  fb.textContent = `${firsts} of ${sort.sorted.length} at the first go.`
    + (sort.gained ? ` +${sort.gained} points this round.` : "");
  $("#sort-again").hidden = false;
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
  $("#game-sort").onclick = startSort;
  $("#game-bonus").onclick = startBonus;
  $("#jig-check").onclick = jigCheck;
  $("#jig-clear").onclick = () => { for (const p of [...$("#jig-board").children]) movePiece(p, $("#jig-tray")); };
  $("#jig-next").onclick = jigNext;
  $("#match-again").onclick = startMatch;
  $("#sort-again").onclick = startSort;
  $("#bonus-input").addEventListener("input", (e) => {
    $("#bonus-check").disabled = !e.target.value.trim();
  });
  $("#bonus-input").addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); bonusCheck(); }
  });
  $("#bonus-check").onclick = bonusCheck;
  $("#bonus-back").onclick = bonusBack;
  for (const id of ["#jig-quit", "#match-quit", "#sort-quit", "#bonus-quit"]) $(id).onclick = openHub;
}
