"""
The learner profile. See docs/03-diagnostic.md.

Two numbers carry the product thesis, both reproduced from the Northern Ireland cohort
study of 267 children with literacy difficulties (Frontiers in Education 2025):

  phonological_reliance    share of ERRORS that read aloud correctly.  Their cohort ~84%.
  orthographic_choice      share of CORRECT spellings that needed a choice between
                           several legal spellings of one sound.       Their cohort <14%.

A child high on the first and low on the second has not failed at phonics. She has
finished phonics and stalled before orthography, which is the layer this app teaches.

HONESTY ABOUT THE SECOND NUMBER. The study made that judgement by expert inspection of
each correct spelling in a writing sample. We cannot. We approximate it structurally:
a word demanded orthographic choice if it carries a pattern in which several graphemes
spell one sound. That is our operationalisation, not theirs, so our absolute value is
NOT comparable with their 14%. The direction of travel over repeated probes is the part
worth reading. ORTHOGRAPHIC_CHOICE_PATTERNS is deliberately a module constant so the
definition can be argued with and changed in one place.
"""

from collections import Counter

from classify import classify

# Patterns where the sound genuinely underdetermines the letters, and several legal
# spellings compete. Doubling, silent letters and base changes are excluded on purpose:
# they are unpredictable in a different way (quantity, inaudibility, morphology) rather
# than a choice between rival graphemes for one phoneme.
ORTHOGRAPHIC_CHOICE_PATTERNS = {
    "schwa", "sh-spelling", "ie-ei", "soft-c-g", "greek-marker",
    "french-ending", "ou-spelling", "ough", "homophone-trap",
    "suffix-ant-ent", "suffix-ance-ence", "suffix-ary-ery", "suffix-able-ible",
}

STRATEGY_LABELS = {
    "sounded_out": "I sounded it out",
    "looked_right": "It looked right",
    "thought_about_parts": "I thought about the parts",
    "just_knew": "I just knew it",
}

# docs/03: below 24 items the profile is 'low' and the app must say so rather than
# presenting it as fact.
CONFIDENCE_FLOOR = 24
CONFIDENCE_SOLID = 48


def needs_orthographic_choice(entry):
    return bool(set(entry.get("patterns", [])) & ORTHOGRAPHIC_CHOICE_PATTERNS)


def confidence_for(n_items):
    if n_items < CONFIDENCE_FLOOR:
        return "low"
    if n_items < CONFIDENCE_SOLID:
        return "medium"
    return "high"


def compute(marks, strategy_responses=None):
    """
    Build a profile from marked attempts.

    `marks` is a list of dicts, each carrying at least:
        entry     the word model entry that was attempted
        diagnosis the dict returned by classify()
    Extra keys are ignored, so an attempt row from the store can be passed straight in.
    """
    marks = list(marks)
    total = len(marks)
    errors = [m for m in marks if not m["diagnosis"]["correct"]]
    correct = [m for m in marks if m["diagnosis"]["correct"]]

    sounds_right = sum(1 for m in errors if m["diagnosis"]["sounds_right"])
    choice_correct = sum(1 for m in correct if needs_orthographic_choice(m["entry"]))

    error_mix = Counter(m["diagnosis"]["type"] for m in errors)
    mix_share = {k: round(v / len(errors), 3) for k, v in error_mix.items()} if errors else {}

    # Pattern strength: correct / attempted, per pattern the WORD carries. A word can
    # carry several, and each gets credit or blame, because we cannot tell which of a
    # word's patterns the child actually resolved.
    seen, right = Counter(), Counter()
    for m in marks:
        for p in m["entry"].get("patterns", []):
            seen[p] += 1
            if m["diagnosis"]["correct"]:
                right[p] += 1
    pattern_strength = {p: round(right[p] / seen[p], 3) for p in sorted(seen)}

    # Transfer: the off-list slice. docs/04 predicts this lags, and it is the number
    # that separates "learned the rule" from "learned the word".
    off = [m for m in marks if not m["entry"].get("on_list", True)]
    on = [m for m in marks if m["entry"].get("on_list", True)]

    def accuracy(rows):
        return round(sum(1 for m in rows if m["diagnosis"]["correct"]) / len(rows), 3) if rows else None

    profile = {
        "items": total,
        "accuracy": accuracy(marks),
        "phonological_reliance": round(sounds_right / len(errors), 3) if errors else None,
        "orthographic_choice_rate": round(choice_correct / len(correct), 3) if correct else None,
        "error_mix": dict(sorted(mix_share.items(), key=lambda kv: -kv[1])),
        "pattern_strength": pattern_strength,
        "transfer": {"on_list": accuracy(on), "off_list": accuracy(off),
                     "off_list_items": len(off)},
        "confidence": confidence_for(total),
        "strategy_self_report": {},
    }

    if strategy_responses:
        counts = Counter(strategy_responses)
        n = sum(counts.values())
        profile["strategy_self_report"] = {k: round(v / n, 3) for k, v in counts.most_common()}
    return profile


def marks_from(attempts, by_word):
    """Turn stored attempt rows into the shape compute() wants."""
    out = []
    for a in attempts:
        entry = by_word.get(a["word"])
        if entry:
            out.append({"entry": entry, "diagnosis": classify(a["attempt_text"], entry)})
    return out


def narrate(profile):
    """The grown-up view, in English. docs/08 M4: 'in English, with what to do about it'."""
    lines = []
    if profile["confidence"] == "low":
        lines.append(f"Only {profile['items']} items so far, so treat all of this as a hint "
                     f"rather than a finding. It needs {CONFIDENCE_FLOOR} to be worth reading.")
    pr = profile["phonological_reliance"]
    if pr is not None:
        if pr >= 0.6:
            lines.append(f"{pr:.0%} of her errors read aloud correctly. She is spelling by "
                         "sound and choosing the wrong legal letters. That is an orthographic "
                         "problem, not a phonics one, and more phonics will not shift it.")
        else:
            lines.append(f"{pr:.0%} of her errors read aloud correctly. A good share of the "
                         "misses change the sound of the word, so some are decoding slips "
                         "rather than orthographic choices.")
    t = profile["transfer"]
    if t["off_list"] is not None and t["on_list"] is not None:
        gap = t["on_list"] - t["off_list"]
        if gap >= 0.2:
            lines.append(f"She scores {t['on_list']:.0%} on taught words but {t['off_list']:.0%} "
                         "on untaught words using the same rules. That gap says she is learning "
                         "words rather than rules, which is what the interleaving research "
                         "warns about.")
        else:
            lines.append(f"Taught words {t['on_list']:.0%}, untaught words using the same rules "
                         f"{t['off_list']:.0%}. The rules are travelling.")
    weak = sorted((p for p, v in profile["pattern_strength"].items() if v < 0.5))
    if weak:
        lines.append("Weakest rules: " + ", ".join(weak[:5]) + ".")
    return lines
