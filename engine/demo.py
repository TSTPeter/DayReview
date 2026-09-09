"""
Verification harness.

Runs the classifier over every curated misspelling in the word model, reports how
many land in a useful category, and shows a worked session through the scheduler.
"""

import csv, json
from collections import Counter
from datetime import date, timedelta

from words import WORDS, PATTERNS
from classify import classify, feedback, sound_key, frame_key
from schedule import Scheduler

BY_WORD = {w["word"]: w for w in WORDS}


def coverage():
    counts, unclassified, plausible = Counter(), [], 0
    for entry in WORDS:
        for bad in entry["errors"]:
            d = classify(bad, entry)
            counts[d["type"]] += 1
            if d["type"] == "unclassified":
                unclassified.append((entry["word"], bad, d["detail"]))
            if d["sounds_right"]:
                plausible += 1
    total = sum(counts.values())
    return counts, total, unclassified, plausible


def show_examples(pairs):
    for word, bad in pairs:
        entry = BY_WORD[word]
        d = classify(bad, entry)
        f = feedback(d, entry)
        print(f"\n  {bad}  ->  {word}")
        print(f"    type      {d['type']}  ({d['detail']})")
        print(f"    says      {f['headline']}")
        print(f"    structure {f['structure']}   |   {f['origin']}")
        print(f"    why       {f['why']}")
        print(f"    practise  {', '.join(f['practise'])}")


def export():
    with open("words.json", "w") as fh:
        json.dump({"patterns": PATTERNS, "words": WORDS}, fh, indent=1)
    with open("words.csv", "w", newline="") as fh:
        wr = csv.writer(fh)
        wr.writerow(["word", "syllables", "morphemes", "language", "root", "gloss",
                     "traps", "patterns", "why", "family"])
        for w in WORDS:
            wr.writerow([w["word"], w["syll"], w["morph"], w["lang"], w["root"], w["gloss"],
                         " ".join(w["traps"]), " ".join(w["patterns"]), w["why"],
                         " ".join(w["family"])])


if __name__ == "__main__":
    counts, total, unclassified, plausible = coverage()
    print(f"WORDS: {len(WORDS)}   PATTERNS: {len(PATTERNS)}   test misspellings: {total}")
    print(f"phonologically plausible (reads aloud correctly): {plausible}/{total}"
          f"  = {100 * plausible / total:.0f}%\n")
    print("classification:")
    for t, n in counts.most_common():
        print(f"  {t:<20} {n:>4}  {100 * n / total:>5.1f}%")

    if unclassified:
        print(f"\nunclassified ({len(unclassified)}):")
        for w, bad, detail in unclassified[:12]:
            print(f"  {bad:<18} -> {w:<15} {detail}")

    print("\n" + "-" * 70)
    print("WORKED FEEDBACK")
    show_examples([("physical", "fisical"), ("government", "goverment"),
                   ("desperate", "desparate"), ("equipment", "equiptment"),
                   ("existence", "existance"), ("disastrous", "disasterous"),
                   ("necessary", "neccessary")])

    print("\n" + "-" * 70)
    print("WORKED SESSION (scheduler)")
    s = Scheduler(WORDS, today=date(2026, 9, 8))
    first = s.session(size=8)
    print("\nday 1 queue:", ", ".join(first))
    print("patterns:   ", " | ".join("/".join(BY_WORD[w]["patterns"][:1]) for w in first))

    # she gets the first three wrong, using the curated misspellings
    for i, w in enumerate(first):
        attempt = BY_WORD[w]["errors"][0] if i < 3 else w
        d = classify(attempt, BY_WORD[w])
        s.record(w, d["correct"], d["patterns"])
        if not d["correct"]:
            print(f"  wrote '{attempt}' for '{w}'  ->  {d['type']}  [{', '.join(d['patterns'])}]")

    print("\nafter day 1:", s.report())
    s.advance_to(date(2026, 9, 10))
    print("\nday 3 queue:", ", ".join(s.session(size=8)))
    print("pulled in because a rule is failing, not because the word is:",
          ", ".join(s.weak_patterns()) or "nothing yet")

    export()
    print("\nwrote words.json and words.csv")
