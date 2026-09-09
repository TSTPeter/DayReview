"""
Error classifier.

"Wrong" is useless feedback. A misspelling is evidence about which layer of the word
broke. We work out the layer, then hand the scheduler a pattern to practise rather
than one word to redrill.

Rule order, most confident first:

  1. correct
  2. transposition        freind      -> friend
  3. doubling             neccessary  -> necessary
  4. suffix-choice        existance   -> existence
  5. base-change          disasterous -> disastrous
  6. grapheme-choice      fisical     -> physical      (sounds right, letters wrong)
  7. silent-letter        goverment   -> government
  8. omission / addition  cemetry     -> cemetery
  9. vowel-choice         desparate   -> desperate     (schwa)
 10. letter-swap          expecially  -> especially    (one letter for another)
 11. multiple-errors, with the raw diff shown

Rules 6 and 9 use two cheap keys instead of a phoneme aligner:

  sound_key   collapses spellings that make the same sound (ph -> f, ck -> k,
              doubles -> single, final silent e dropped)
  frame_key   sound_key with vowels blanked, so a right consonant skeleton with
              wrong vowels falls out as a schwa error

Deliberately less than a real aligner, and honest about it. It needs no pronunciation
dictionary, which matters because CMUdict is American and this list is British.
"""

import re
from difflib import SequenceMatcher

VOWELS = set("aeiou")

SUFFIX_PAIRS = [
    ("ant", "ent"), ("ance", "ence"), ("ancy", "ency"),
    ("ary", "ery"), ("ary", "ory"), ("ery", "ory"),
    ("able", "ible"), ("ise", "ize"), ("tion", "sion"), ("al", "le"),
    ("ous", "us"), ("ly", "ley"), ("er", "or"), ("our", "or"),
]

# Graphemes that can spell the same sound.
SOUND_CLASSES = [
    ("f", ["ph", "ff", "f"]),
    ("k", ["ck", "ch", "qu", "c", "k"]),
    ("s", ["sc", "ss", "c", "s"]),
    # "si" is deliberately absent: the contextual rule above already catches si
    # before a vowel (pension). Left in this blanket list it also fired on "simbol"
    # and "sincere", reading them as /sh/. Dropping it fixed two false negatives in
    # the plausibility count and changed no classification. "ci" and "ti" are kept:
    # dropping them cost specificity, moving cases into the vaguer vowel-choice.
    ("S", ["sh", "ci", "ti", "ss", "ch"]),         # the /sh/ sound
    ("j", ["dge", "ge", "j", "g"]),
    ("z", ["ze", "se", "z", "s"]),
    ("E", ["ee", "ea", "ie", "ei", "e"]),          # long e
    ("I", ["y", "i"]),                             # short i
    ("A", ["eigh", "ai", "ay", "ei", "a"]),        # long a
    ("O", ["ough", "ow", "oa", "ou", "o"]),        # long o
    ("R", ["our", "er", "ur", "ir", "or", "ar"]),
]
CLASS_OF = {sp: canon for canon, spellings in SOUND_CLASSES for sp in spellings}


def normalise(text):
    return re.sub(r"[^a-z]", "", (text or "").lower())


# The KS2 mark scheme gives a mark for the exact letter sequence and nothing else.
# Case is free and mixed case is accepted, but a correct sequence still scores ZERO
# if an apostrophe or hyphen is wrongly inserted, or if the letters are split into
# clearly divided components. See docs/07-assessment.md.
#
# This lives apart from normalise() on purpose: normalise() also feeds the diff
# aligner, which must not care about punctuation.
SPLITTERS = {"'": "an apostrophe", "\u2019": "an apostrophe",
             "-": "a hyphen", "\u2010": "a hyphen", "\u2011": "a hyphen"}


def mark_scheme_penalty(raw, word):
    """Why the mark scheme would refuse a letter-perfect attempt. None if it would not."""
    raw = (raw or "").strip()
    for ch, name in SPLITTERS.items():
        if ch in raw and ch not in word:
            return f"the letters are right, but {name} inside a word scores zero"
    if re.search(r"\s", raw):
        return "the letters are right, but they are split into separate parts, which scores zero"
    return None


def sound_key(word):
    """Rough spelling-to-sound key. Equal keys means it would read aloud the same."""
    w = normalise(word)
    w = re.sub(r"sci(?=[aeou])", "S", w)          # conscience, conscious
    w = re.sub(r"[cst]i(?=[aeou])", "S", w)       # ancient, station, pension
    w = re.sub(r"c(?=[eiy])", "s", w)             # soft c: criticise, sincere
    w = re.sub(r"g(?=[eiy])", "j", w)             # soft g: privilege
    w = w.replace("x", "ks")
    for canon, spellings in SOUND_CLASSES:
        for sp in sorted(spellings, key=len, reverse=True):
            w = w.replace(sp, canon)
    w = re.sub(r"(.)\1+", r"\1", w)                        # collapse doubles
    w = re.sub(r"([bcdfghjklmnpqrstvwxyz])e$", r"\1", w)   # drop final silent e
    return w.replace("h", "")


def frame_key(word):
    """sound_key with vowels blanked: the consonant skeleton."""
    return re.sub(r"[aeiouAEIO]", "@", sound_key(word))


def _edits(target, attempt):
    out = []
    for tag, i1, i2, j1, j2 in SequenceMatcher(None, target, attempt).get_opcodes():
        if tag != "equal":
            out.append({"tag": tag, "target": target[i1:i2], "attempt": attempt[j1:j2],
                        "at": i1, "end": i2, "j": j1, "jend": j2})
    return out


def _trap_at(entry, start, end):
    """Which annotated trap, if any, does this edit sit inside?"""
    target = normalise(entry["word"])
    for trap in entry["traps"]:
        i = target.find(trap)
        while i != -1:
            if start <= i + len(trap) and end >= i:
                return trap
            i = target.find(trap, i + 1)
    return None


def _is_transposition(target, attempt):
    if len(target) != len(attempt):
        return None
    diff = [i for i, (a, b) in enumerate(zip(target, attempt)) if a != b]
    if len(diff) == 2 and diff[1] - diff[0] == 1:
        i, j = diff
        if target[i] == attempt[j] and target[j] == attempt[i]:
            return target[i:j + 1]
    return None


def _vowels_only_swap(target, attempt):
    """An anagram whose every difference is one vowel standing in for another.

    'saperate' and 'relavent' are anagrams of their targets, but calling them
    sequencing errors teaches the wrong thing: the child heard a schwa and reached
    for the wrong letter. Let those fall through to the vowel-choice rule, which
    names the real decision. Genuine reorderings move consonants too, so 'yatch',
    'restaraunt' and 'amature' are untouched.
    """
    if len(target) != len(attempt):
        return False
    diff = [(t, a) for t, a in zip(target, attempt) if t != a]
    return bool(diff) and all(t in VOWELS and a in VOWELS for t, a in diff)


def _doubling(edit, target, attempt):
    """A consonant that should double and does not, or the reverse."""
    t, a, i = edit["target"], edit["attempt"], edit["at"]
    if edit["tag"] == "delete" and len(t) == 1 and t not in VOWELS:
        neighbours = {target[i - 1] if i else "", target[i + 1] if i + 1 < len(target) else ""}
        if t in neighbours:
            return ("missed the double", t * 2)
    if edit["tag"] == "insert" and len(a) == 1 and a not in VOWELS:
        j = attempt.find(a, max(0, i - 1))
        neighbours = {attempt[j - 1] if j else "", attempt[j + 1] if j + 1 < len(attempt) else ""}
        if a in neighbours:
            return ("doubled a letter that stays single", a * 2)
    if edit["tag"] == "replace" and len(t) == 2 and t[0] == t[1] and a == t[0]:
        return ("missed the double", t)
    if edit["tag"] == "replace" and len(a) == 2 and a[0] == a[1] and t == a[0]:
        return ("doubled a letter that stays single", a)
    return None


def _same_sound_swap(edit, target, attempt):
    """Did she swap one legal spelling of a sound for another? Widen for context."""
    for pad in (0, 1, 2):
        ts = target[max(0, edit["at"] - pad):edit["end"] + pad]
        as_ = attempt[max(0, edit["j"] - pad):edit["jend"] + pad]
        if not ts or not as_ or ts == as_:
            continue
        if sound_key(ts) == sound_key(as_):
            return (target[edit["at"]:edit["end"]] or ts, attempt[edit["j"]:edit["jend"]] or as_)
    return None


def _suffix_swap(target, attempt):
    for a, b in SUFFIX_PAIRS:
        for x, y in ((a, b), (b, a)):
            if target.endswith(x) and attempt.endswith(y) and target[:-len(x)] == attempt[:-len(y)]:
                return (x, y)
    return None


def classify(attempt, entry):
    """Diagnose one attempt at one word."""
    target = normalise(entry["word"])
    raw = (attempt or "").strip()
    attempt = normalise(raw)
    letters_right = target == attempt
    penalty = mark_scheme_penalty(raw, entry["word"]) if letters_right else None
    r = {"word": entry["word"], "attempt": attempt, "raw": raw,
         "correct": letters_right and penalty is None,
         "type": None, "detail": "", "edits": [], "patterns": [],
         "sounds_right": letters_right, "trap": None, "mark_scheme": penalty}
    if r["correct"]:
        r["type"] = "correct"
        return r
    if letters_right:
        # Every letter is right. We still mark it wrong, because the test would.
        # No pattern is at fault, so nothing is charged to the pattern layer.
        return out_penalty(r, penalty)

    r["edits"] = _edits(target, attempt)
    r["sounds_right"] = sound_key(target) == sound_key(attempt)
    single = r["edits"][0] if len(r["edits"]) == 1 else None
    r["trap"] = _trap_at(entry, r["edits"][0]["at"], r["edits"][-1]["end"])
    pats = entry["patterns"]

    def out(kind, detail, patterns):
        r.update(type=kind, detail=detail, patterns=patterns)
        return r

    # 2. transposition
    trans = _is_transposition(target, attempt)
    if trans:
        return out("transposition", f"letters swapped around '{trans}'", ["sequencing"])
    if sorted(target) == sorted(attempt):
        # An anagram whose every difference is vowel-for-vowel is a schwa error, not a
        # sequencing one. Checked after the adjacent-swap rule above so that the classic
        # 'freind' for 'friend' stays a transposition, which is what it is.
        if _vowels_only_swap(target, attempt):
            swaps = ", ".join(f"'{a}' for '{t}'"
                              for t, a in zip(target, attempt) if t != a)
            return out("vowel-choice", f"right consonants, wrong vowel: {swaps}",
                       [p for p in pats if p == "schwa"] or ["schwa"])
        return out("transposition", "every letter is right, the order is not", ["sequencing"])

    # 3. doubling
    for e in r["edits"]:
        d = _doubling(e, target, attempt)
        if d:
            kind, letters = d
            return out("doubling", f"{kind}: '{letters}'",
                       [p for p in pats if "doubl" in p] or ["double-consonant"])

    # 4. suffix choice
    swap = _suffix_swap(target, attempt)
    if swap:
        right, wrong = swap
        return out("suffix-choice", f"wrote -{wrong}, needs -{right}",
                   [p for p in pats if p.startswith("suffix")] or ["suffix-choice"])

    # 5. base change, only when a single letter is added or dropped
    if "base-change" in pats and single and single["tag"] in ("insert", "delete"):
        return out("base-change", "kept the base word whole instead of changing it",
                   ["base-change"])

    # 6. same sound, different letters
    for e in r["edits"]:
        sw = _same_sound_swap(e, target, attempt)
        if sw:
            t, a = sw
            return out("grapheme-choice", f"wrote '{a}' where English wants '{t}'",
                       [p for p in pats if p in ("greek-marker", "sh-spelling",
                                                 "soft-c-g", "ie-ei", "ou-spelling")]
                       or ["grapheme-choice"])

    # 7. silent letter dropped
    dropped = [e for e in r["edits"] if e["tag"] == "delete"]
    if dropped and "silent-letter" in pats:
        letters = "".join(e["target"] for e in dropped)
        where = f" from the '{r['trap']}'" if r["trap"] else ""
        return out("silent-letter", f"dropped the silent '{letters}'{where}", ["silent-letter"])

    # 8. plain omission or addition
    if single and single["tag"] in ("delete", "insert"):
        letters = single["target"] or single["attempt"]
        verb = "left out" if single["tag"] == "delete" else "added an extra"
        where = f", inside the '{r['trap']}'" if r["trap"] else ""
        kind = "omission" if single["tag"] == "delete" else "addition"
        return out(kind, f"{verb} '{letters}'{where}",
                   [p for p in pats if p in ("schwa", "silent-letter")] or ["letter-level"])

    # 9. vowel choice under a schwa
    if frame_key(target) == frame_key(attempt):
        wrong = ", ".join(f"'{e['attempt'] or '-'}' for '{e['target'] or '-'}'" for e in r["edits"])
        return out("vowel-choice", f"right consonants, wrong vowel: {wrong}", ["schwa"])

    # 10. a straight letter swap we cannot pin to a rule
    if all(e["tag"] == "replace" for e in r["edits"]):
        wrong = ", ".join(f"'{e['attempt']}' where the word needs '{e['target']}'" for e in r["edits"])
        where = f" (inside the '{r['trap']}')" if r["trap"] else ""
        return out("letter-swap", wrong + where,
                   [p for p in pats if p in ("schwa", "greek-marker", "sh-spelling",
                                             "soft-c-g", "ie-ei")] or ["grapheme-choice"])

    # 11. more than one thing went wrong: say so, show the diff
    return out("multiple-errors",
               "; ".join(f"{e['tag']} '{e['target']}'->'{e['attempt']}'" for e in r["edits"]),
               pats[:1])


def out_penalty(r, penalty):
    r.update(type="mark-scheme", detail=penalty, patterns=[])
    return r


HEADLINES = {
    "mark-scheme": "Every letter is right. The test would still mark this wrong.",
    "transposition": "The letters are all right, the order slipped.",
    "doubling": "This is a doubling decision, not a sound.",
    "suffix-choice": "The ending is the decision point.",
    "base-change": "The base word changes when the ending goes on.",
    "grapheme-choice": "You spelled the sound correctly. English chose other letters.",
    "silent-letter": "There is a letter here you cannot hear.",
    "omission": "One letter went missing.",
    "addition": "One letter too many.",
    "vowel-choice": "You heard it right. The lazy vowel is the trap.",
    "letter-swap": "One letter is standing in for another.",
    "multiple-errors": "More than one thing slipped here. Take it syllable by syllable.",
}


def feedback(diagnosis, entry):
    """The four things a learner should see, in this order."""
    if diagnosis["correct"]:
        return {"headline": "Correct.", "why": entry["why"], "practise": []}
    return {
        "headline": HEADLINES[diagnosis["type"]],
        "detail": diagnosis["detail"],
        "structure": entry["morph"],
        "origin": f"{entry['lang']}: {entry['root']}, {entry['gloss']}",
        "why": entry["why"],
        "practise": entry["family"][:3],
    }
