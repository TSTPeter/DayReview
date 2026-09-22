// The collection: cut-paper pieces earned by cracking rules.
//
// THE WHOLE DESIGN IS ONE CHOICE, MADE FROM ONE FINDING.
//
// Deci, Koestner & Ryan, 128 studies: expected tangible rewards REDUCE
// free-choice persistence: engagement-contingent d = -0.40, completion
// d = -0.36, performance d = -0.28, and the damage is larger in children than
// adults. The single exception is the UNEXPECTED reward: d = 0.01, no harm.
// Verbal praise helped overall (d = 0.33) but for children specifically was
// d = 0.11, non-significant.
//
// So every mechanic here is built to be one of the two safe kinds:
//
//   1. SELF-REFERENCED MASTERY. A piece appears when she cracks a RULE, not
//      when she answers, not when she shows up, not when a timer elapses.
//      docs/02: "being right about something hard" is the motivational
//      mechanism that does not backfire.
//   2. GENUINELY UNEXPECTED. Curios are never promised, never listed as
//      "3 more to go", never previewed. Nothing in the UI tells her they
//      exist until one arrives. The moment she can work towards one, it stops
//      being d = 0.01 and starts being d = -0.28.
//
// Consequently there is NO score, NO streak, NO daily target, NO progress
// bar towards a collection, and nothing she can lose. Pieces are permanent
// once earned: a bad week cannot take the garden away. Losable rewards are
// how a reward becomes a pressure, which is the ICO Children's code standard
// 13 problem as well as the overjustification one.
//
// The habit metrics Peter asked for (consistency, daily plotting) are real
// and useful, and they live in the GROWN-UP view where they inform an adult
// instead of nudging a child.

const CRACK_RUN = 3;   // consecutive correct on a pattern to count as cracked

const C = {
  coral: "#e2725b", teal: "#2f7d72", mustard: "#e0a32e",
  plum: "#6b4c7a", sage: "#8fa97f", cream: "#f7f1e3",
  kraft: "#e8dcc3", ink: "#23201c", sky: "#bcd8d4", rose: "#eaa9a0",
};

// Cut paper: flat shapes, one offset "under-sheet" per piece so it reads as
// layered card rather than as a flat icon.
const S = (inner) =>
  `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${inner}</svg>`;

const ART = {
  tree: S(`<path d="M30 58h6v-12h-6z" fill="${C.kraft}"/><path d="M32 6 12 34h40z" fill="${C.sage}"/><path d="M32 16 18 40h28z" fill="${C.teal}"/>`),
  house: S(`<path d="M12 30h40v28H12z" fill="${C.cream}"/><path d="M32 6 6 32h52z" fill="${C.coral}"/><path d="M26 42h12v16H26z" fill="${C.plum}"/>`),
  bird: S(`<path d="M14 38q10-18 30-16 12 2 8 12t-20 14-18-10z" fill="${C.teal}"/><path d="M28 34q8-8 18-4-6 12-18 4z" fill="${C.cream}"/><circle cx="41" cy="27" r="2" fill="${C.ink}"/>`),
  sun: S(`<circle cx="32" cy="32" r="15" fill="${C.mustard}"/><g stroke="${C.mustard}" stroke-width="4" stroke-linecap="round"><path d="M32 6v6M32 52v6M6 32h6M52 32h6M14 14l4 4M46 46l4 4M50 14l-4 4M18 46l-4 4"/></g>`),
  boat: S(`<path d="M8 42h48l-8 12H16z" fill="${C.coral}"/><path d="M32 8v30" stroke="${C.ink}" stroke-width="3"/><path d="M34 12l16 22H34z" fill="${C.cream}"/><path d="M30 16 16 34h14z" fill="${C.sky}"/>`),
  flower: S(`<path d="M31 60h3V36h-3z" fill="${C.sage}"/><g fill="${C.rose}"><circle cx="32" cy="16" r="9"/><circle cx="21" cy="26" r="9"/><circle cx="43" cy="26" r="9"/><circle cx="26" cy="36" r="9"/><circle cx="38" cy="36" r="9"/></g><circle cx="32" cy="27" r="7" fill="${C.mustard}"/>`),
  mountain: S(`<path d="M4 54 26 16l14 22 8-10 12 26z" fill="${C.plum}"/><path d="M26 16l8 12H18z" fill="${C.cream}"/>`),
  fish: S(`<path d="M50 32q-12-14-28-6-10 5 0 12 16 8 28-6z" fill="${C.teal}"/><path d="M50 32l10-9v18z" fill="${C.sky}"/><circle cx="28" cy="29" r="2.4" fill="${C.ink}"/>`),
  cat: S(`<path d="M16 26 14 10l12 8zM48 26 50 10 38 18z" fill="${C.kraft}"/><ellipse cx="32" cy="34" rx="19" ry="17" fill="${C.mustard}"/><circle cx="25" cy="32" r="2.4" fill="${C.ink}"/><circle cx="39" cy="32" r="2.4" fill="${C.ink}"/><path d="M29 40h6l-3 4z" fill="${C.coral}"/>`),
  bridge: S(`<path d="M4 44h56v6H4z" fill="${C.kraft}"/><path d="M8 44q24-26 48 0" fill="none" stroke="${C.coral}" stroke-width="5"/><path d="M18 44V32M32 44V26M46 44V32" stroke="${C.coral}" stroke-width="3"/>`),
  cloud: S(`<g fill="${C.cream}"><circle cx="22" cy="36" r="12"/><circle cx="36" cy="30" r="15"/><circle cx="48" cy="38" r="10"/></g><path d="M12 46h42v6H12z" fill="${C.sky}"/>`),
  star: S(`<path d="M32 4l8 18 20 2-15 13 5 20-18-11-18 11 5-20L4 24l20-2z" fill="${C.mustard}"/><path d="M32 14l4 10 11 1-8 7 3 11-10-6z" fill="${C.cream}" opacity=".55"/>`),
  mushroom: S(`<path d="M26 58h12V38H26z" fill="${C.cream}"/><path d="M6 38q6-26 26-26t26 26z" fill="${C.coral}"/><g fill="${C.cream}"><circle cx="20" cy="28" r="4"/><circle cx="34" cy="22" r="5"/><circle cx="45" cy="31" r="3.5"/></g>`),
  owl: S(`<ellipse cx="32" cy="36" rx="18" ry="20" fill="${C.plum}"/><path d="M14 20l6 8-10 2zM50 20l-6 8 10 2z" fill="${C.plum}"/><circle cx="25" cy="32" r="7" fill="${C.cream}"/><circle cx="39" cy="32" r="7" fill="${C.cream}"/><circle cx="25" cy="32" r="3" fill="${C.ink}"/><circle cx="39" cy="32" r="3" fill="${C.ink}"/><path d="M29 41h6l-3 5z" fill="${C.mustard}"/>`),
  whale: S(`<path d="M6 38q14-16 34-10 14 4 18 14-16 10-34 6-14-3-18-10z" fill="${C.sky}"/><path d="M6 38q-2-8 4-10 2 6-4 10z" fill="${C.teal}"/><circle cx="44" cy="34" r="2.4" fill="${C.ink}"/><path d="M40 18q4-8 10-6-2 8-10 6z" fill="${C.cream}"/>`),
  kite: S(`<path d="M32 4 52 28 32 52 12 28z" fill="${C.coral}"/><path d="M32 4v48M12 28h40" stroke="${C.cream}" stroke-width="2"/><path d="M32 52q6 8-2 10" fill="none" stroke="${C.ink}" stroke-width="2"/>`),
  lighthouse: S(`<path d="M24 56h16L36 18H28z" fill="${C.cream}"/><path d="M26 30h12v7H26zM25 42h14v7H25z" fill="${C.coral}"/><path d="M26 18h12l-3-8h-6z" fill="${C.mustard}"/><path d="M4 56h56v4H4z" fill="${C.kraft}"/>`),
  windmill: S(`<path d="M26 58h12L34 22h-4z" fill="${C.cream}"/><g fill="${C.teal}"><path d="M32 20 14 14l4 10zM32 20l6-18 8 6zM32 20l18 6-4 10zM32 20l-6 18-8-6z"/></g><circle cx="32" cy="20" r="3" fill="${C.ink}"/>`),
  bee: S(`<ellipse cx="32" cy="36" rx="16" ry="12" fill="${C.mustard}"/><path d="M26 25v22M36 25v22" stroke="${C.ink}" stroke-width="4"/><ellipse cx="24" cy="22" rx="9" ry="6" fill="${C.cream}" opacity=".85" transform="rotate(-20 24 22)"/><ellipse cx="41" cy="22" rx="9" ry="6" fill="${C.cream}" opacity=".85" transform="rotate(20 41 22)"/>`),
  snail: S(`<path d="M8 48h22v6H8z" fill="${C.sage}"/><path d="M12 48q-4-10 6-10t6 8" fill="${C.sage}"/><circle cx="40" cy="34" r="17" fill="${C.kraft}"/><path d="M40 34a10 10 0 1 1-7 17" fill="none" stroke="${C.coral}" stroke-width="4"/><path d="M14 38v-8M20 38v-8" stroke="${C.sage}" stroke-width="3"/>`),
  fox: S(`<path d="M32 52 12 24l8-12 8 10h8l8-10 8 12z" fill="${C.coral}"/><path d="M32 52 22 34h20z" fill="${C.cream}"/><circle cx="25" cy="30" r="2.6" fill="${C.ink}"/><circle cx="39" cy="30" r="2.6" fill="${C.ink}"/><circle cx="32" cy="42" r="2.6" fill="${C.ink}"/>`),
};

const ART_KEYS = Object.keys(ART);

// Curios: only ever arrive unannounced, alongside a cracked rule. Never
// listed, never counted down to, never shown as "locked".
const CURIOS = [
  { key: "paper-crane", art: ART.bird,   line: "A paper crane landed in your garden." },
  { key: "night-owl",   art: ART.owl,    line: "An owl moved into the tree." },
  { key: "small-whale", art: ART.whale,  line: "Somehow, a whale." },
  { key: "red-kite",    art: ART.kite,   line: "Someone let go of a kite." },
  { key: "bee",         art: ART.bee,    line: "A bee found the flowers." },
  { key: "snail",       art: ART.snail,  line: "A snail is crossing, slowly." },
  { key: "fox",         art: ART.fox,    line: "A fox is watching from the hill." },
];

// A piece MEANS a rule, so the mapping has to be a bijection: two rules
// sharing a shape would make the garden unreadable as a record of what she
// can do. A hash collides; an ordered assignment over the sorted rule list
// does not, and is stable across sessions because the rule list is fixed
// data. Unknown keys fall back to a hash, which only matters if a rule is
// added without re-running assignArt.
let ASSIGNED = null;

export function assignArt(patternKeys) {
  const keys = [...new Set(patternKeys)].sort();
  ASSIGNED = new Map();
  keys.forEach((k, i) => ASSIGNED.set(k, ART_KEYS[i % ART_KEYS.length]));
  return ASSIGNED;
}

export function artFor(pattern) {
  if (ASSIGNED && ASSIGNED.has(pattern)) return ART[ASSIGNED.get(pattern)];
  let h = 0;
  for (let i = 0; i < pattern.length; i++) h = (h * 31 + pattern.charCodeAt(i)) >>> 0;
  return ART[ART_KEYS[h % ART_KEYS.length]];
}

/**
 * Which rules has she cracked? A rule is cracked on CRACK_RUN consecutive
 * correct attempts at words carrying it. Consecutive, so it means "I can do
 * this now" rather than "I have done a lot of these".
 *
 * Attempts must be in chronological order.
 */
export function crackedPatterns(attempts, byWord) {
  const run = {};
  const cracked = new Set();
  for (const a of attempts) {
    const entry = byWord.get(a.word);
    if (!entry) continue;
    for (const p of entry.patterns || []) {
      run[p] = a.correct ? (run[p] || 0) + 1 : 0;
      if (run[p] >= CRACK_RUN) cracked.add(p);
    }
  }
  return cracked;
}

/**
 * Decide what, if anything, appears after this session. Returns pieces newly
 * cracked plus at most one curio.
 *
 * The curio is deliberately probabilistic and unlisted. `rand` is injectable
 * so the test suite can pin it.
 */
export function settle(newlyCracked, alreadyHave, rand = Math.random) {
  const out = { pieces: [...newlyCracked], curio: null };
  if (!out.pieces.length) return out;             // no rule cracked, no curio
  const available = CURIOS.filter((c) => !alreadyHave.includes(c.key));
  if (!available.length) return out;
  // Roughly one time in three, and only ever riding along with real mastery.
  if (rand() < 0.34) out.curio = available[Math.floor(rand() * available.length)];
  return out;
}

export function renderWorld(el, crackedList, curioKeys, patternNames = {}) {
  el.replaceChildren();
  if (!crackedList.length && !curioKeys.length) {
    const p = document.createElement("p");
    p.className = "world-empty";
    p.textContent = "Your garden starts empty. Crack a spelling rule and something turns up.";
    el.append(p);
    return;
  }
  const wrap = document.createElement("div");
  wrap.className = "world-pieces";
  for (const pattern of crackedList) {
    const d = document.createElement("div");
    d.className = "world-piece";
    d.title = patternNames[pattern] || pattern.replace(/-/g, " ");
    d.innerHTML = artFor(pattern);
    wrap.append(d);
  }
  for (const key of curioKeys) {
    const c = CURIOS.find((x) => x.key === key);
    if (!c) continue;
    const d = document.createElement("div");
    d.className = "world-piece";
    d.title = c.line;
    d.innerHTML = c.art;
    wrap.append(d);
  }
  el.append(wrap);
}

export { CURIOS, CRACK_RUN, ART };
