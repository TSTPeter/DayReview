"""
Scheduler: Leitner boxes over words, plus a pattern layer.

Two decisions the research pushed us to:

  Spacing     Cepeda et al. found the best gap is roughly 10-20% of how long you
              want the memory to last. Boxes of 1, 2, 4, 8, 16 days cover a term.
  Interleave  The 2025 classroom study found mixed rule types beat blocked ones at
              eight weeks. So a session never puts two words of one pattern together.

The pattern layer is the part most spelling apps skip. A word failing twice is a word
problem. A pattern failing twice is a rule problem, so we pull in sibling words that
use the same rule rather than redrilling the one word she got wrong.
"""

from datetime import date, timedelta

BOX_DAYS = {1: 1, 2: 2, 3: 4, 4: 8, 5: 16}
PATTERN_TRIGGER = 2   # failures of one pattern before siblings get pulled in


class Scheduler:
    def __init__(self, words, today=None):
        self.words = {w["word"]: w for w in words}
        self.today = today or date.today()
        self.state = {w: {"box": 1, "due": self.today, "seen": 0, "wrong": 0}
                      for w in self.words}
        self.patterns = {}
        for w in self.words.values():
            for p in w["patterns"]:
                self.patterns.setdefault(p, {"members": [], "seen": 0, "wrong": 0})
                self.patterns[p]["members"].append(w["word"])

    # ---------- recording ----------

    def record(self, word, correct, diagnosis_patterns=()):
        st = self.state[word]
        st["seen"] += 1
        for p in set(self.words[word]["patterns"]) | set(diagnosis_patterns):
            ps = self.patterns.setdefault(p, {"members": [], "seen": 0, "wrong": 0})
            ps["seen"] += 1
            if not correct:
                ps["wrong"] += 1
        if correct:
            st["box"] = min(5, st["box"] + 1)
        else:
            st["wrong"] += 1
            st["box"] = 1
        st["due"] = self.today + timedelta(days=BOX_DAYS[st["box"]])
        return st

    def advance_to(self, day):
        self.today = day

    # ---------- selection ----------

    def weak_patterns(self):
        return sorted([p for p, s in self.patterns.items() if s["wrong"] >= PATTERN_TRIGGER],
                      key=lambda p: -self.patterns[p]["wrong"])

    def due(self):
        return [w for w, s in self.state.items() if s["due"] <= self.today]

    def session(self, size=10):
        """Reserve a third of the session for weak patterns, fill the rest with variety."""
        picked, reserve = [], max(1, size // 3)

        # 1. siblings of the patterns she keeps failing
        for p in self.weak_patterns():
            for sib in self.patterns[p]["members"]:
                if len(picked) < reserve and sib not in picked:
                    picked.append(sib)

        # 2. everything due, taken round-robin across patterns so no run of one rule
        due = sorted((w for w in self.due() if w not in picked),
                     key=lambda w: (self.state[w]["box"], -self.state[w]["wrong"], w))
        buckets = {}
        for w in due:
            buckets.setdefault(self.words[w]["patterns"][0], []).append(w)
        while len(picked) < size and any(buckets.values()):
            for key in list(buckets):
                if not buckets[key]:
                    del buckets[key]
                    continue
                picked.append(buckets[key].pop(0))
                if len(picked) >= size:
                    break
        return self._interleave(picked)

    def _interleave(self, words):
        """Greedy reorder so neighbouring words do not share a pattern."""
        remaining, out = list(words), []
        while remaining:
            last = set(self.words[out[-1]]["patterns"]) if out else set()
            nxt = next((w for w in remaining if not (set(self.words[w]["patterns"]) & last)),
                       remaining[0])
            remaining.remove(nxt)
            out.append(nxt)
        return out

    def report(self):
        boxes = {b: 0 for b in BOX_DAYS}
        for s in self.state.values():
            boxes[s["box"]] += 1
        return {"boxes": boxes, "weak_patterns": self.weak_patterns()[:5],
                "due_today": len(self.due())}
