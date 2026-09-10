"""
The baseline diagnostic probe. See docs/03-diagnostic.md.

24 words, dictated in sentences, no feedback, roughly 8 minutes. Framed as a challenge
and explicitly one-off: "this tells the app what to teach you."

  16 on-list   two words from each of the eight commonest pattern groups.
               Two, not one, because docs/03 is blunt about it: one word is an anecdote.
   8 off-list  one word per group, NOT on the statutory list, using the same pattern.

The off-list slice is the transfer measure, and it is the one docs/04 predicts will lag.
The 2025 interleaving trial found gains on trained words and no transfer to untrained
ones, so a probe that only samples the taught list cannot tell "learned the rule" from
"learned the word". These eight exist to catch exactly that.

RUN IT ON PAPER. Broc et al.'s replication found typing inflated orthographic errors
sixfold on the same task (0.06 errors per word against 0.01) while phonological errors
barely moved. Orthographic choice is precisely what this probe measures, so a typed
probe overstates the weakness it exists to detect. The app dictates; the child writes;
the adult types the attempts back in. See docs/01 and docs/07.
"""

from words import WORDS

# The eight commonest pattern groups in the statutory list, most frequent first.
PROBE_PATTERNS = ["double-consonant", "schwa", "assimilated-prefix", "sh-spelling",
                  "silent-letter", "single-consonant", "base-change", "greek-marker"]


def _W(word, syll, lang, root, gloss, morph, traps, patterns, errors, why, family):
    return {"word": word, "syll": syll, "lang": lang, "root": root, "gloss": gloss,
            "morph": morph, "traps": traps, "patterns": patterns, "errors": errors,
            "why": why, "family": family, "on_list": False}


# Not on the DfE list. Same patterns, so a child who has the rule should get these too.
OFF_LIST = [
_W("possession","pos-ses-sion","Latin","possidere","to have as one's own","possess+ion",
   ["ss","ss"],["double-consonant","sh-spelling"],["posession","possesion","posesion"],
   "Two lots of double s, one in possess and one before -ion.",
   ["possess","obsession","profession","session"]),
_W("separate","sep-a-rate","Latin","se + parare","to prepare apart","separ+ate",
   ["a"],["schwa"],["seperate","seperete","saperate"],
   "There is a rat in separate. The middle a is a lazy 'uh', so it has to be remembered.",
   ["separation","prepare","apparatus","parade"]),
_W("irregular","ir-reg-u-lar","Latin","in + regula","not by the rule","ir+regul+ar",
   ["rr"],["assimilated-prefix","double-consonant"],["iregular","inregular","irrregular"],
   "The prefix in- turns into ir- before an r, so two r's meet.",
   ["regular","irrational","irresponsible","rule"]),
_W("delicious","de-li-cious","Latin","delicere","to entice away","delici+ous",
   ["cious"],["sh-spelling"],["delicous","delishous","deliceous"],
   "The /sh/ is spelled ci, the same trick as in ancient and precious.",
   ["precious","suspicious","ferocious","delight"]),
_W("knowledge","know-ledge","Old English","cnawan","to know","know+ledge",
   ["kn","dge"],["silent-letter","soft-c-g"],["nowledge","knowlege","knolwedge"],
   "Know is hiding inside it, silent k and all. Then -ledge, not -lege.",
   ["know","acknowledge","knight","edge"]),
_W("useful","use-ful","Latin","usus","a using","use+ful",
   ["ful"],["single-consonant","keep-e"],["usefull","usful","usefil"],
   "The suffix is -ful, one l, always. Full has two, -ful never does.",
   ["careful","helpful","beautiful","hopeful"]),
_W("beautiful","beau-ti-ful","French","beau","fine, handsome","beauti+ful",
   ["eau","i"],["base-change","french-ending","single-consonant"],
   ["beautyful","beatiful","beutiful"],
   "Beauty swaps its y for an i before the suffix. The eau is French and stays whole.",
   ["beauty","beautify","plentiful","bureau"]),
_W("chemistry","chem-is-try","Greek","khemia","transmutation","chemist+ry",
   ["ch","y"],["greek-marker"],["kemistry","chemestry","chemistary"],
   "Greek gives ch for /k/ and y for short i, the same as in scheme and physics.",
   ["chemical","chemist","scheme","architect"]),
]

BY_PATTERN_OFFLIST = {w["patterns"][0]: w for w in OFF_LIST}


def on_list_candidates(pattern):
    """Statutory words whose PRIMARY pattern is this one, in list order."""
    return [w for w in WORDS if w["patterns"] and w["patterns"][0] == pattern]


def build(run=0, per_pattern=2):
    """
    The 24-item probe for a given run.

    `run` rotates the sample so the half-termly re-run uses different words without
    any randomness: the same run number always yields the same probe, which is what
    makes two probes comparable. docs/03 asks for a different sample each half term.
    """
    items = []
    for pattern in PROBE_PATTERNS:
        pool = on_list_candidates(pattern)
        if not pool:
            continue
        for i in range(per_pattern):
            entry = pool[(run * per_pattern + i) % len(pool)]
            if entry["word"] not in [it["word"] for it in items]:
                items.append({**entry, "on_list": True, "probe_pattern": pattern})
    for pattern in PROBE_PATTERNS:
        off = BY_PATTERN_OFFLIST.get(pattern)
        if off:
            items.append({**off, "probe_pattern": pattern})
    return items


def split(items):
    on = [i for i in items if i.get("on_list")]
    off = [i for i in items if not i.get("on_list")]
    return on, off
