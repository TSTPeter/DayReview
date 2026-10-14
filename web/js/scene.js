// The growing background: white on white, richer as she gets cards right at the first go.
//
// Peter, 1 October 2026: graphical complexity that responds to performance, shapes and
// stickers of animals and objects, ever more complex but subtle, white on white; and
// a very mild degradation on a miss, as a nudge.
//
// Peter, 6 October 2026: "we seem to have lost the ever-more-complex background. That
// was ace." Nothing had gone from the code. The first build took TWO layers back on a
// miss, which is not very mild: one miss undid two right answers, so she needed about two
// in three right at the first go just to stand still, and the first animal only arrived
// at level 6. At six right in ten the page ended a round with an animal on it in about
// one round in eleven. Now a miss takes back ONE layer, the first animal arrives with her
// second right answer, and the plan runs to 20 layers so a long sitting keeps getting
// richer (docs/11).
//
// SUBTLE ON PURPOSE. docs/02: decoration competes with the task, which is why the
// practice screens have none. This is a game screen, the contrast is a few percent, the
// card she reads sits on an opaque sheet above it, and nothing moves except a layer
// fading in or out. Only the card-by-card games use it (docs/15).
//
// THE RULES. The level rises by one for each card right at the first go and falls by
// one on a miss: a step back, never a wipe. It lives for this sitting only and starts
// at nothing next time, so there is nothing to keep coming back for and nothing to
// lose overnight (docs/11: no streaks, nothing losable, nothing time-contingent).

import { ART } from "./rewards.js";

export const STEP_BACK = 1;                    // layers a miss takes away
const SVG = "http://www.w3.org/2000/svg";
const STICKERS = ["bird", "fish", "cat", "owl", "whale", "fox", "bee", "snail", "kite",
                  "boat", "tree", "flower", "mushroom", "star", "windmill", "lighthouse"];

// What each level adds, in order. The order is the design: a texture first, then the
// first animal at once, then patterns and animals taking turns, then the richer
// patterns that only a long sitting reaches. "low" puts an animal in the lower part of
// the screen, which is free of content on every game, so the first ones are seen.
export const PLAN = [
  null,
  { kind: "dots" },                              // 1
  { kind: "animal", count: 1, low: true },       // 2  the first animal
  { kind: "waves" },                             // 3
  { kind: "rings" },                             // 4
  { kind: "animal", count: 1, low: true },       // 5
  { kind: "diamonds" },                          // 6
  { kind: "confetti" },                          // 7
  { kind: "animal", count: 2 },                  // 8
  { kind: "rosettes" },                          // 9
  { kind: "animal", count: 2 },                  // 10
  { kind: "lattice" },                           // 11 polyphony in the sound, a lattice here
  { kind: "animal", count: 2 },                  // 12
  { kind: "stars" },                             // 13
  { kind: "garland" },                           // 14
  { kind: "dots", offset: true },                // 15
  { kind: "animal", count: 3 },                  // 16
  { kind: "scallops" },                          // 17
  { kind: "animal", count: 3 },                  // 18
  { kind: "confetti", more: true },              // 19
  { kind: "frame" },                             // 20
];
export const MAX = PLAN.length - 1;

let host = null;
let svg = null;
let level = 0;
let seed = 1;
let built = [];
let order = STICKERS;                          // this sitting's animals, each used once

function prng(s) {
  let a = s >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const node = (name, attrs = {}) => {
  const n = document.createElementNS(SVG, name);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  return n;
};

// Every shape is drawn twice: a faint shadow a hair down and right, then the white.
// That reads as embossed paper and needs no SVG filter, which Safari handles unevenly.
function embossed(make) {
  const g = node("g");
  const shadow = make();
  shadow.setAttribute("class", "shade");
  shadow.setAttribute("transform", `translate(0.8 1) ${shadow.getAttribute("transform") || ""}`);
  const light = make();
  light.setAttribute("class", "lite");
  g.append(shadow, light);
  return g;
}

function sticker(name, x, y, size, turn) {
  const inner = new DOMParser().parseFromString(ART[name], "image/svg+xml").documentElement;
  return embossed(() => {
    const g = node("g", { transform: `translate(${x} ${y}) rotate(${turn} ${size / 2} ${size / 2}) scale(${size / 64})` });
    for (const child of inner.childNodes) g.append(child.cloneNode(true));
    return g;
  });
}

// How many animals the levels before n have used, so each animal layer takes the next
// ones from this sitting's order and no animal is drawn twice.
const animalsBefore = (n) => PLAN.slice(1, n).reduce((k, p) => k + (p.kind === "animal" ? p.count : 0), 0);

function layer(n, w, h, rand) {
  const plan = PLAN[n];
  const g = node("g", { class: "layer" });
  g.dataset.kind = plan.kind;
  const r = (a, b) => a + rand() * (b - a);
  const scatter = (count, draw) => { for (let i = 0; i < count; i++) g.append(draw(r(0, w), r(0, h))); };
  switch (plan.kind) {
    case "dots": {
      const step = 46, off = plan.offset ? 23 : 0;
      for (let y = off; y < h; y += step) {
        for (let x = off; x < w; x += step) g.append(embossed(() => node("circle", { cx: x, cy: y, r: 2.2 })));
      }
      break;
    }
    case "waves":
      for (let k = 0; k < 4; k++) {
        const y0 = r(0.1, 0.9) * h, amp = r(8, 18), len = r(80, 140);
        let d = `M0 ${y0}`;
        for (let x = 0; x <= w; x += len / 2) d += ` Q${x + len / 4} ${y0 + (x / (len / 2) % 2 ? -amp : amp)} ${x + len / 2} ${y0}`;
        g.append(embossed(() => node("path", { d, fill: "none", "stroke-width": 3 })));
      }
      break;
    case "rings":
      scatter(8, (x, y) => embossed(() => node("circle", { cx: x, cy: y, r: r(14, 34), fill: "none", "stroke-width": 4 })));
      break;
    case "diamonds":
      scatter(8, (x, y) => {
        const s = r(16, 30);
        return embossed(() => node("path", { d: `M${x} ${y - s}L${x + s} ${y}L${x} ${y + s}L${x - s} ${y}Z`,
                                             transform: `rotate(${r(0, 45)} ${x} ${y})` }));
      });
      break;
    case "animal": {
      const first = animalsBefore(n);
      for (let i = 0; i < plan.count; i++) {
        const name = order[(first + i) % order.length];
        const size = r(plan.count === 1 ? 96 : 76, plan.count === 1 ? 132 : 120);
        const y = plan.low ? r(h * 0.58, Math.max(h * 0.58, h - size)) : r(0, h - size);
        g.append(sticker(name, r(0, w - size), y, size, r(-14, 14)));
      }
      break;
    }
    case "confetti":
      scatter(plan.more ? 26 : 16, (x, y) => embossed(() => node("rect", { x, y, width: r(6, 12), height: r(6, 12), rx: 2,
                                                         transform: `rotate(${r(0, 90)} ${x} ${y})` })));
      break;
    case "rosettes":
      scatter(3, (x, y) => {
        const rose = node("g");
        for (let k = 0; k < 4; k++) rose.append(node("circle", { cx: x, cy: y, r: 18 + k * 14, fill: "none", "stroke-width": 3 }));
        return embossed(() => rose.cloneNode(true));
      });
      break;
    case "lattice": {
      const step = 64;
      let d = "";
      for (let x = -h; x < w + h; x += step) d += `M${x} 0L${x + h} ${h}M${x + h} 0L${x} ${h}`;
      g.append(embossed(() => node("path", { d, fill: "none", "stroke-width": 1.6 })));
      break;
    }
    case "stars":
      scatter(12, (x, y) => {
        const s = r(8, 14);
        const pts = Array.from({ length: 10 }, (_, k) => {
          const a = (Math.PI / 5) * k - Math.PI / 2, rr = k % 2 ? s / 2.4 : s;
          return `${x + rr * Math.cos(a)},${y + rr * Math.sin(a)}`;
        }).join(" ");
        return embossed(() => node("polygon", { points: pts }));
      });
      break;
    case "garland": {
      const garland = node("g");
      for (let x = 20; x < w; x += 44) {
        garland.append(node("circle", { cx: x, cy: 18, r: 6 }), node("circle", { cx: x, cy: h - 18, r: 6 }));
      }
      g.append(embossed(() => garland.cloneNode(true)));
      break;
    }
    case "scallops": {
      // A row of cut-paper scallops along the bottom edge, bumps rising, and another
      // along the top edge, bumps hanging.
      const s = 34;
      let bottom = `M0 ${h}`, top = "M0 0";
      for (let x = 0; x < w + s; x += s) {
        bottom += ` a${s / 2} ${s / 2} 0 0 1 ${s} 0`;
        top += ` a${s / 2} ${s / 2} 0 0 0 ${s} 0`;
      }
      g.append(embossed(() => node("path", { d: bottom, fill: "none", "stroke-width": 3 })),
               embossed(() => node("path", { d: top, fill: "none", "stroke-width": 3 })));
      break;
    }
    case "frame":
      g.append(embossed(() => node("rect", { x: 10, y: 10, width: w - 20, height: h - 20, rx: 22,
                                             fill: "none", "stroke-width": 3 })),
               embossed(() => node("rect", { x: 20, y: 20, width: w - 40, height: h - 40, rx: 16,
                                             fill: "none", "stroke-width": 1.4 })));
      break;
    default:
      break;
  }
  return g;
}

function draw() {
  if (!svg) return;
  const w = Math.max(320, window.innerWidth), h = Math.max(480, window.innerHeight);
  svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
  // Add what is missing, each layer seeded by this sitting and its own number so it
  // always lands in the same place; fade out what the level has stepped back past.
  for (let n = 1; n <= level; n++) {
    if (built[n]) {
      built[n].classList.remove("going");
      continue;
    }
    const g = layer(n, w, h, prng(seed + n * 7919));
    g.dataset.n = String(n);
    svg.append(g);
    built[n] = g;
    requestAnimationFrame(() => g.classList.add("shown"));
  }
  for (let n = level + 1; n <= MAX; n++) {
    const g = built[n];
    if (!g) continue;
    built[n] = null;
    g.classList.remove("shown");
    g.classList.add("going");
    setTimeout(() => g.remove(), 700);
  }
  host.dataset.level = String(level);
}

/** Start a sitting: an empty background, a new arrangement, a new order of animals. */
export function attach(el) {
  host = el;
  host.replaceChildren();
  svg = node("svg", { preserveAspectRatio: "xMidYMid slice" });
  host.append(svg);
  level = 0;
  built = [];
  seed = (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0;
  const rand = prng(seed);
  order = [...STICKERS];
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  draw();
}

export const value = () => level;
export function up() { level = Math.min(MAX, level + 1); draw(); }
export function down() { level = Math.max(0, level - STEP_BACK); draw(); }
