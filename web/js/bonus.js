// The bonus round: one of four games, picked at random, never the same one twice running.
//
// Peter, 6 October 2026: the game-show board "just isn't fun". Asked what should replace it he
// chose a detective game, a race with a paper snail and treasure chests, wanted one of them to
// turn up at random each time, and asked for something crazier, "like some kind of game where you
// have to eat letters as though you were pacman or snake". So there are four, in this folder:
//
//   detective.js  a mystery word and clues that open one at a time
//   race.js       six typed cards, and a race against a paper snail
//   chests.js     six locked chests, each opened by spelling its word
//   snake.js      the crazy one: eat the letters of a word in order
//
// What is the same for all four, because docs/15 and docs/11 say so:
//   * Points open it, every 50, and the points earned inside count too, so a good round can
//     earn the next. Nothing is for turning up.
//   * Every answer is spelling the word: typed, or in the snake's case steered, with typing the
//     whole word always allowed. A miss gets the rule and the support.
//   * The words are this week's and the two weeks before, so a round is spaced retrieval of the
//     term so far, as the board was.
//   * Nothing is kept from one round to the next. There is no streak, no collection, no count.
//
// Picking at random is only variety, not a reward: nothing about which game turns up depends
// on how she did or says anything is coming. It never repeats the last one, so it is not the
// same game again by luck.

import * as detective from "./detective.js";
import * as race from "./race.js";
import * as chests from "./chests.js";
import * as snake from "./snake.js";

const GAMES = { detective, race, chests, snake };
export const KINDS = Object.keys(GAMES);
const WORDS = 6;

let kit = null;

export function init(k) {
  kit = k;
  for (const game of Object.values(GAMES)) game.init(k);
}

export function wire() {
  for (const game of Object.values(GAMES)) game.wire();
}

/**
 * Words for a round: about half from this week and the rest from the two weeks before, with
 * none twice. A short term tops up from this week.
 */
export function pickWords(n = WORDS) {
  const { ctx, shuffle } = kit;
  const have = (w) => ctx.data().words[w];
  const weeks = ctx.weeksSoFar().slice(-3).reverse();
  const now = shuffle([...new Set(weeks[0].words.filter(have))]);
  const before = shuffle([...new Set(weeks.slice(1).flatMap((w) => w.words))]
    .filter((w) => have(w) && !weeks[0].words.includes(w)));
  const chosen = [...now.slice(0, Math.ceil(n / 2)), ...before.slice(0, Math.floor(n / 2))];
  for (const w of [...now.slice(Math.ceil(n / 2)), ...before.slice(Math.floor(n / 2))]) {
    if (chosen.length >= n) break;
    if (!chosen.includes(w)) chosen.push(w);
  }
  return shuffle(chosen).slice(0, n);
}

/** Which game this time: any but the last, at random. `forced` is for the tests. */
export async function pickKind(forced) {
  const { ctx } = kit;
  if (forced && GAMES[forced]) return forced;
  const last = await ctx.store.getKV("bonus_last", null);
  const others = KINDS.filter((k) => k !== last);
  return others[Math.floor(Math.random() * others.length)];
}

export async function start(forced) {
  const kind = await pickKind(forced);
  await kit.ctx.store.setKV("bonus_last", kind);
  GAMES[kind].start(pickWords());
}
