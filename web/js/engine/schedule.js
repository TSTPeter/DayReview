// Port of engine/schedule.py. Same caveat as classify.js: mirror, do not improvise.
// tests/test_schedule_parity.py replays the Python golden file through this code.
//
// Leitner boxes of 1/2/4/8/16 days. docs/09 is honest that the intervals are a
// convention consistent with Cepeda et al. rather than derived from them: the optimal
// gap scales with the retention interval, roughly 10-20% of it, and there is no
// universal best gap.

export const BOX_DAYS = { 1: 1, 2: 2, 3: 4, 4: 8, 5: 16 };
export const PATTERN_TRIGGER = 2;

const DAY = 86400000;

export function addDays(iso, days) {
  return new Date(Date.parse(iso + "T00:00:00Z") + days * DAY).toISOString().slice(0, 10);
}

export function today() {
  return new Date().toISOString().slice(0, 10);
}

export class Scheduler {
  constructor(words, todayIso, state = null, patterns = null) {
    this.words = new Map(words.map((w) => [w.word, w]));
    this.today = todayIso || today();
    this.state = state || {};
    this.patterns = patterns || {};
    for (const w of this.words.values()) {
      if (!this.state[w.word]) {
        this.state[w.word] = { box: 1, due: this.today, seen: 0, wrong: 0 };
      }
      for (const p of w.patterns) {
        if (!this.patterns[p]) this.patterns[p] = { members: [], seen: 0, wrong: 0 };
        if (!this.patterns[p].members.includes(w.word)) this.patterns[p].members.push(w.word);
      }
    }
  }

  record(word, correct, diagnosisPatterns = []) {
    const st = this.state[word];
    st.seen += 1;
    const touched = new Set([...(this.words.get(word)?.patterns || []), ...diagnosisPatterns]);
    for (const p of touched) {
      if (!this.patterns[p]) this.patterns[p] = { members: [], seen: 0, wrong: 0 };
      this.patterns[p].seen += 1;
      if (!correct) this.patterns[p].wrong += 1;
    }
    if (correct) {
      st.box = Math.min(5, st.box + 1);
    } else {
      st.wrong += 1;
      st.box = 1;
    }
    st.due = addDays(this.today, BOX_DAYS[st.box]);
    return st;
  }

  advanceTo(iso) { this.today = iso; }

  weakPatterns() {
    // Python: sorted(list_of_keys, key=-wrong). Stable, so ties keep insertion order.
    return Object.keys(this.patterns)
      .filter((p) => this.patterns[p].wrong >= PATTERN_TRIGGER)
      .sort((a, b) => this.patterns[b].wrong - this.patterns[a].wrong);
  }

  due() {
    return Object.keys(this.state).filter((w) => this.state[w].due <= this.today);
  }

  session(size = 10) {
    const picked = [];
    const reserve = Math.max(1, Math.floor(size / 3));

    for (const p of this.weakPatterns()) {
      for (const sib of this.patterns[p].members) {
        if (picked.length < reserve && !picked.includes(sib)) picked.push(sib);
      }
    }

    const due = this.due()
      .filter((w) => !picked.includes(w))
      .sort((a, b) => {
        const sa = this.state[a], sb = this.state[b];
        return sa.box - sb.box || (-sa.wrong) - (-sb.wrong) || (a < b ? -1 : a > b ? 1 : 0);
      });

    const buckets = new Map();
    for (const w of due) {
      const key = this.words.get(w).patterns[0];
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(w);
    }
    while (picked.length < size && [...buckets.values()].some((b) => b.length)) {
      for (const key of [...buckets.keys()]) {
        if (!buckets.get(key).length) { buckets.delete(key); continue; }
        picked.push(buckets.get(key).shift());
        if (picked.length >= size) break;
      }
    }
    return this.interleave(picked);
  }

  // Greedy reorder so neighbouring words do not share a pattern. docs/01 Tier 2:
  // interleaved beat blocked at eight weeks, effects 0.18 to 0.42, but with NO
  // transfer to untrained words. So interleave the practice and never assume the
  // rule generalised: that is what the off-list probe slice is for.
  interleave(words) {
    const remaining = [...words];
    const out = [];
    while (remaining.length) {
      const last = out.length
        ? new Set(this.words.get(out[out.length - 1]).patterns) : new Set();
      let idx = remaining.findIndex(
        (w) => !this.words.get(w).patterns.some((p) => last.has(p)));
      if (idx === -1) idx = 0;
      out.push(remaining.splice(idx, 1)[0]);
    }
    return out;
  }

  report() {
    const boxes = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const s of Object.values(this.state)) boxes[s.box] += 1;
    return { boxes, weak_patterns: this.weakPatterns().slice(0, 5), due_today: this.due().length };
  }
}
