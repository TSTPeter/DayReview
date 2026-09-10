"""
The escalation ladder. See docs/03-diagnostic.md for the table, docs/08 M5 for the flag.

DEFAULT OFF, AND THAT IS THE POINT.

Solheim et al. randomised 13 Norwegian schools and 744 children and found an adaptive
app did not beat a well-built fixed one: word reading p = .227, sentence reading p = .121,
spelling p = .670, with the fixed condition's effect sizes against control actually
larger (0.58-0.75 against 0.38-0.64). So the fixed sequence is the product and this
module is the hypothesis. Turning it on without running the M7 comparison would be
assuming the answer to the question the app exists to ask.

SPIRE's expert panel scored pedagogical reasoning at 4.90/5 with 74.7% perfect agreement
but instructional action at 4.32 with only 26.7%, and the disagreement was about ORDER.
So the rung ordering below is not merely untested; there is no expert consensus to copy.
It is reasoned from the component effect sizes in Chandler et al. and nothing stronger.

Rung 3 is whole-word study for the hard cases on purpose: g = 0.56, the largest single
component effect for spelling outcomes, and the honest answer for a word like 'yacht'
where no rule will save you.

Method is chosen by ERROR TYPE, never by learner type. The meshing hypothesis failed
its own test (Pashler et al. 2008): the same child gets a morphological treatment for a
suffix error and a whole-word treatment for a French loanword, in one session.
"""

ENABLED = False          # docs/08 M5. Flip only inside the M7 experiment.
FAIL_TO_ESCALATE = 2     # a word that fails twice at one rung moves up

LADDER = {
    "doubling": [
        ("state-the-rule", "State the rule, with one worked example."),
        ("build-from-morphemes", "Build the word from its morphemes and decide, at the join, whether to double."),
        ("contrast-pair", "Contrast-pair drill: equip, equipped, equipment."),
    ],
    "suffix-choice": [
        ("show-the-root", "Show the Latin root that sets the ending."),
        ("sort-six", "Sort six words into -ance and -ence."),
        ("generate-noun", "Generate the noun from the verb, three times."),
    ],
    "grapheme-choice": [
        ("name-the-marker", "Name the origin marker: Greek ph, ch, y."),
        ("choose-from-three", "Choose the right grapheme from three legal options."),
        ("spot-the-greek", "Spot the Greek word among five."),
    ],
    "vowel-choice": [
        ("exaggerate-syllables", "Say it in exaggerated syllables."),
        ("syllable-by-syllable", "Type it syllable by syllable."),
        ("stressed-relative", "Link it to a relative where the vowel is stressed: definite from finish."),
    ],
    "silent-letter": [
        ("heard-relative", "Show the relative where the letter is heard: sign, signature."),
        ("history-line", "Trace the word's history in one line."),
        ("whole-word-study", "Whole-word study: look, cover, write, check."),
    ],
    "transposition": [
        ("slow-input", "Slow the input down, one grapheme at a time."),
        ("chunk-morphemes", "Chunk it into morphemes."),
        ("whole-word-study", "Whole-word study: look, cover, write, check."),
    ],
    "omission": [
        ("syllable-count", "Count the syllables first, then spell."),
        ("syllable-separators", "Type it with the syllable separators shown."),
        ("whole-word-study", "Whole-word study: look, cover, write, check."),
    ],
    "addition": [
        ("syllable-count", "Count the syllables first, then spell."),
        ("syllable-separators", "Type it with the syllable separators shown."),
        ("whole-word-study", "Whole-word study: look, cover, write, check."),
    ],
}

# Error types with no ladder of their own fall back to a related one.
FALLBACK = {
    "letter-swap": "grapheme-choice",
    "base-change": "suffix-choice",
    "multiple-errors": "omission",
}

# A mark-scheme zero is not a spelling failure, so it never escalates anything.
NO_LADDER = {"correct", "mark-scheme"}


def ladder_for(error_type):
    if error_type in NO_LADDER:
        return []
    return LADDER.get(FALLBACK.get(error_type, error_type), [])


def rung_for(error_type, rung=1):
    """The method to show, 1-indexed. Returns None when the ladder is off or absent."""
    if not ENABLED:
        return None
    rungs = ladder_for(error_type)
    if not rungs:
        return None
    index = max(1, min(rung, len(rungs))) - 1
    key, instruction = rungs[index]
    return {"method": key, "instruction": instruction,
            "rung": index + 1, "of": len(rungs), "error_type": error_type}


def next_rung(error_type, rung, fails_at_rung):
    """Where the child goes after this attempt. Never escalates past the top rung."""
    rungs = ladder_for(error_type)
    if not rungs:
        return rung, 0
    if fails_at_rung + 1 >= FAIL_TO_ESCALATE and rung < len(rungs):
        return rung + 1, 0
    return rung, fails_at_rung + 1


def method_shown(error_type, rung=1):
    """The value written to attempts.method_shown. None when the fixed sequence is running."""
    step = rung_for(error_type, rung)
    return step["method"] if step else None
