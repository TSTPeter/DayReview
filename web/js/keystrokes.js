// Keystroke timing. docs/07 makes this a build requirement, not telemetry garnish.
//
// Ouellette & Tims found pre-existing keyboard skill constrained or facilitated
// learning in the typing condition, with no equivalent effect for printing. A child
// hunting for keys is being assessed on typing, not spelling, so an unmeasured slow
// typist makes every other number in the dataset uninterpretable. Suggate et al. point
// the other way: children with impaired fine motor skills learned decoding best BY
// typing. Both say measure it rather than guess.
//
// docs/04 also wants latency and edit count as cheap confidence proxies: a word spelled
// correctly, fast, with no edits is known; the same word after four edits is not, and
// should not be promoted a box on that evidence. Both are flagged as plausible but
// untested in docs/09, so they are recorded and NOT yet acted on.

export class Keystrokes {
  constructor() { this.reset(); }

  reset() {
    this.first = null;
    this.last = null;
    this.gaps = [];
    this.count = 0;
    this.edits = 0;
    this.prevLength = 0;
    this.deleteKeyPending = false;
  }

  onKey(event) {
    const now = performance.now();
    if (this.first === null) this.first = now;
    if (this.last !== null) this.gaps.push(now - this.last);
    this.last = now;
    this.count += 1;
    // Backspace and delete are the edit signal.
    if (event && (event.key === "Backspace" || event.key === "Delete")) {
      this.edits += 1;
      this.deleteKeyPending = true;
    }
  }

  onInput(value) {
    // A shortening we did NOT already see as a keydown: paste, autocorrect, long-press,
    // an IME. Without the flag a plain Backspace scores two edits, which would make
    // every typed attempt look twice as hesitant as it was.
    if (value.length < this.prevLength && !this.deleteKeyPending) this.edits += 1;
    this.deleteKeyPending = false;
    this.prevLength = value.length;
  }

  medianGap() {
    if (!this.gaps.length) return null;
    const s = [...this.gaps].sort((a, b) => a - b);
    const m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  }

  summary() {
    return {
      latency_ms: this.first === null ? null : Math.round(this.last - this.first),
      keystroke_count: this.count,
      edits_before_submit: this.edits,
      median_inter_key_ms: this.medianGap() === null ? null : Math.round(this.medianGap()),
    };
  }
}

// A rolling fluency estimate across attempts. Deliberately a description, not a
// threshold: docs/09 lists the Ouellette & Tims cut-off as still wanted, so there is
// no defensible number to branch on yet. Report it to the adult and let them decide.
export function fluency(medians) {
  const values = medians.filter((m) => typeof m === "number");
  if (values.length < 5) return { median_inter_key_ms: null, note: "not enough data yet" };
  const s = [...values].sort((a, b) => a - b);
  const median = s[Math.floor(s.length / 2)];
  let note;
  if (median > 900) {
    note = "Slow key finding. Typed scores are partly measuring typing. Prefer paper rounds.";
  } else if (median > 450) {
    note = "Moderate typing speed. Worth carrying as a covariate in any comparison.";
  } else {
    note = "Typing is fluent enough not to be the bottleneck.";
  }
  return { median_inter_key_ms: Math.round(median), samples: values.length, note };
}
