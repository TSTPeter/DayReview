// Look, cover, write: the school's own method, with the check done by the classifier.
//
// She looks at the word in its parts, says it, covers it, writes it from memory, and checks.
// What supports it: a meta-analysis found the cover-copy-compare family effective for spelling
// and for maths, and strongest when combined with other evidence-based components (Joseph et al.
// 2012, docs/01; the abstract gives no figures), and a small controlled trial with 55
// seven-year-olds found look, say, cover, write, check, fix improved the spelling of the words
// taught, though rule-based teaching transferred better to new words (Dymock and Nicholson
// 2017). So what is supported is check-and-retry on the words practised, not transfer. The
// retrieval in the middle is what docs/01 backs, and the looking is preparation, so the cover
// goes on when SHE says: nothing counts down. A word that was missed comes round again at the
// end of the round, because a miss, feedback and a second retrieval is the sequence retrieval
// practice relies on. That last choice is judgement.
//
// A game screen with the growing background (scene.js). Points are for a word right at
// the first go; the second look earns none and does not touch the background.

import { answerBox } from "./answer.js";

const ROUND = 5;

let kit = null;
let box = null;
const game = { items: [], i: 0, gained: 0, results: [], missed: [], again: false,
               used: new Set(), token: null };

export function init(k) { kit = k; }

export function start({ fresh = true } = {}) {
  const { ctx, $, shuffle } = kit;
  const week = ctx.week();
  if (fresh) {
    kit.scene.attach($("#lcw-scene"));
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
  game.missed = [];
  game.again = false;
  $("#lcw-end").hidden = true;
  $("#lcw-again").hidden = true;
  $("#lcw-card").hidden = false;
  kit.paintPoints();
  ctx.show("lcw");
  look();
}

// Step one: the word, in its parts, and nothing else to do but look.
function look() {
  const { ctx, $ } = kit;
  const word = game.items[game.i];
  game.token = {};
  const n = game.items.length;
  $("#lcw-count").textContent = game.again
    ? `Another look: word ${game.i + 1} of ${n}` : `Word ${game.i + 1} of ${n}`;
  $("#lcw-tab").textContent = game.again ? "Look again" : "Look";
  $("#lcw-word").replaceChildren(...kit.partSpans(word));
  $("#lcw-meaning").textContent = ctx.data().words[word].meaning;
  $("#lcw-prompt").textContent = "Look at it. Say it out loud, one part at a time. "
    + "Tap Cover when you are ready.";
  $("#lcw-cover").hidden = false;
  $("#lcw-answer").hidden = true;
  $("#lcw-next").hidden = true;
  box.close();
}

// Step two: the word goes under a cover and she writes it from memory.
function cover() {
  const { ctx, $ } = kit;
  const word = game.items[game.i];
  const token = game.token;
  const letters = word.replace(/-/g, "").length;
  const hidden = ctx.el("span", { className: "lcw-cover" });
  hidden.style.setProperty("--len", String(letters));
  hidden.setAttribute("role", "img");
  hidden.setAttribute("aria-label", `The word is covered. ${letters} letters.`);
  $("#lcw-word").replaceChildren(hidden);
  $("#lcw-tab").textContent = "Cover, then write";
  $("#lcw-prompt").textContent = game.again ? "Write it again, from memory." : "Now write it from memory.";
  $("#lcw-cover").hidden = true;
  $("#lcw-answer").hidden = false;
  box.open(word, { points: game.again ? 0 : kit.POINTS.lcw, done: (r) => checked(word, token, r) });
}

// Step three: the word comes out from under the cover, beside her marked attempt.
async function checked(word, token, r) {
  if (game.token !== token) return;
  const { $ } = kit;
  $("#lcw-word").replaceChildren(...kit.partSpans(word));
  $("#lcw-tab").textContent = "Check";
  $("#lcw-prompt").textContent = "";
  game.results.push({ word, first_try: !game.again && r.correct, correct: r.correct,
                      error_type: r.decision.type, ...(game.again ? { again: true } : {}) });
  let gained = 0;
  if (!game.again) {
    gained = r.correct ? kit.POINTS.lcw : 0;
    game.gained += gained;
    if (r.correct) kit.scene.up(); else { kit.scene.down(); game.missed.push(word); }
  }
  const last = game.i + 1 >= game.items.length;
  $("#lcw-next").textContent = !last ? "Next word"
    : (!game.again && game.missed.length ? "Another look" : "Finish");
  $("#lcw-next").hidden = false;
  $("#lcw-next").focus();
  await kit.award(gained);
}

async function advance() {
  const last = game.i + 1 >= game.items.length;
  if (!last) { game.i += 1; look(); return; }
  if (!game.again && game.missed.length) {
    // The ones she missed come round once more, for no points.
    game.items = [...game.missed];
    game.i = 0;
    game.again = true;
    look();
    return;
  }
  await finish();
}

async function finish() {
  const { ctx, $ } = kit;
  ctx.sfx.play("complete");
  game.token = null;
  box.close();
  const first = game.results.filter((r) => !r.again);
  const firsts = first.filter((r) => r.first_try).length;
  const stillWrong = game.results.filter((r) => r.again && !r.correct).map((r) => r.word);
  $("#lcw-count").textContent = "Round finished";
  $("#lcw-card").hidden = true;
  $("#lcw-answer").hidden = true;
  $("#lcw-cover").hidden = true;
  $("#lcw-next").hidden = true;
  $("#lcw-end-text").textContent = `${firsts} of ${first.length} right at the first go.`
    + (game.gained ? `  +${game.gained} points this round.` : "");
  $("#lcw-end-words").textContent = stillWrong.length
    ? `Worth another look: ${[...new Set(stillWrong)].join(", ")}.` : "Every word written.";
  $("#lcw-end").hidden = false;
  $("#lcw-again").hidden = false;
  $("#lcw-again").focus();
  await kit.logRound("lcw", game.results, game.gained);
}

function leave() {
  game.token = null;
  box.close();
  kit.openHub();
}

export function wire() {
  const { $ } = kit;
  box = answerBox(kit, $("#lcw-answer"), { label: "Write the word from memory", where: "lcw" });
  $("#lcw-cover").onclick = cover;
  $("#lcw-next").onclick = advance;
  $("#lcw-again").onclick = () => start({ fresh: false });
  $("#lcw-quit").onclick = leave;
}
