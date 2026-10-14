// A typed answer, marked the way the dictation marks it.
//
// Fill the gap, look cover write, the crossword and the bonus rounds all end in the same
// moment: she has typed a word from memory, and it is marked against the target, with the
// rule, as docs/01 asks (high-information feedback, d = 0.99, against d = 0.24 for
// "right" or "wrong"). This builds that moment once so every game does it the same way,
// with the same classifier the dictation uses (docs/05 decision 1).
//
// One attempt per word. A second go straight after seeing the answer would be copying,
// not recall, so the word is marked, shown, and left. After a miss it also shows the
// word's support, as every other game does (experiments/2026-10-support-types.md).

import { classify, feedback } from "./engine/classify.js";

/**
 * @param kit   what games.js hands every game: ctx, and so on
 * @param host  the element to build into
 * @param label what a screen reader calls the box
 * @param where the game's name, for the support log
 */
export function answerBox(kit, host, { label = "Type the word", where = "game" } = {}) {
  const { ctx } = kit;
  const input = ctx.el("input", { className: "spell", type: "text" });
  const attrs = { autocomplete: "off", autocapitalize: "none", autocorrect: "off",
                  spellcheck: "false", enterkeyhint: "done", "aria-label": label };
  for (const [k, v] of Object.entries(attrs)) input.setAttribute(k, v);
  const check = ctx.el("button", { className: "primary", textContent: "Check", disabled: true });
  const verdict = ctx.el("p", { className: "verdict" });
  const marked = ctx.el("div", { className: "marked" });
  const why = ctx.el("p", { className: "muted" });
  const support = ctx.el("div", { className: "support-inline", hidden: true });
  const result = ctx.el("div", { hidden: true }, [verdict, marked, why, support]);
  host.replaceChildren(input, ctx.el("div", { className: "row", style: "margin-top:1rem" }, [check]), result);

  let live = null;     // the question being asked: { word, points, done }

  const sync = () => { check.disabled = !live || !input.value.trim(); };
  input.addEventListener("input", sync);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); judge(); }
  });
  check.onclick = judge;

  function judge() {
    if (!live || !input.value.trim()) return;
    const { word, points, done } = live;
    live = null;
    const entry = ctx.entryFor(word);
    const attempt = input.value;
    const d = classify(attempt, entry);
    input.disabled = true;
    check.hidden = true;
    result.hidden = false;
    verdict.className = `verdict ${d.correct ? "right" : "wrong"}`;
    verdict.textContent = d.correct
      ? `Correct!${points ? `  +${points}` : ""}` : feedback(d, entry).headline;
    marked.replaceChildren(ctx.markedUp(word, d));
    why.textContent = d.correct ? (entry.why || "") : `${word}. ${entry.why || ""}`;
    support.replaceChildren();
    support.hidden = true;
    if (!d.correct) {
      const card = ctx.supports.render(word);
      if (card) {
        support.replaceChildren(card);
        support.hidden = false;
        ctx.supports.logShown(word, where);
      }
    }
    ctx.sfx.play(d.correct ? "correct" : "notyet");
    done({ correct: d.correct, decision: d, attempt });
  }

  return {
    /** Ask for a word. done({ correct, decision, attempt }) is called once, when she checks. */
    open(word, { points = 0, focus = true, done = () => {} } = {}) {
      input.value = "";
      input.disabled = false;
      check.hidden = false;
      check.disabled = true;
      result.hidden = true;
      live = { word, points, done };
      if (focus) input.focus();
    },
    /** She left: nothing is waiting for an answer any more. */
    close() {
      live = null;
      input.disabled = true;
    },
    input,
  };
}
