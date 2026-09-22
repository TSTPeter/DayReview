"""
Infer spelling patterns from a bare word.

WHY THIS EXISTS. Every week the school sends home a list. Those words are not
on the DfE statutory list and have no curated entry in words.py, so nothing in
this app knows anything about them beyond their letters.

The classifier already copes: transposition, omission, addition and the
phonological-plausibility test all work on any string. What it loses without
curation is the PATTERN — and the pattern is what makes this app teach rather
than merely mark. Without one, a miss tells the scheduler nothing, the rule
card has nothing to show, and 'necessary' spelled 'neccessary' is reported as
a bare mistake instead of a doubling decision.

So this module derives what can honestly be derived from the spelling itself.
It does NOT invent etymology: origin, root, gloss, morphemes and word family
are knowledge about a word, not properties of its letters, and a guessed root
told to a child is worse than a missing one. Those stay absent and the reveal
screen hides those cards. See docs/12-weekly-lists.md.

PRECISION OVER RECALL, DELIBERATELY. A pattern claimed wrongly sends the child
to the wrong rule card and poisons the pattern-strength number in the
grown-up view. A pattern missed just leaves her where she already was. Every
rule below is therefore written to fire only on clear evidence, and
tests/test_derive.py measures the result against the 103 hand-curated words
rather than asserting it works.
"""

import re

VOWELS = "aeiou"
DOUBLES = ["bb", "cc", "dd", "ff", "gg", "ll", "mm", "nn",
           "pp", "rr", "ss", "tt", "zz"]

# Prefixes that assimilate to the following consonant: ad+com -> accom.
ASSIMILATED = [
    ("ac", "c"), ("af", "f"), ("ag", "g"), ("al", "l"), ("an", "n"),
    ("ap", "p"), ("ar", "r"), ("as", "s"), ("at", "t"),
    ("com", "m"), ("col", "l"), ("cor", "r"), ("il", "l"), ("im", "m"),
    ("ir", "r"), ("sup", "p"), ("suf", "f"), ("sug", "g"),
]

# Letters you cannot hear.
#
# Only unambiguous markers survive here. A looser set — 'ght', 'gu', 'sc'
# before e/i, 'lk', 'alm', 'ould', 'que' — scored 27% against the curated
# words: it fired on plenty of words where a silent letter exists but is not
# the thing to teach. These are the ones where the silent letter IS the story.
SILENT = [
    (r"^kn", "kn"), (r"^wr", "wr"), (r"^gn", "gn"), (r"^ps", "ps"),
    (r"^rh", "rh"), (r"^hon", "ho"), (r"^hour", "hou"),
    (r"mb$", "mb"), (r"mn$", "mn"), (r"gn$", "gn"),
    (r"stle", "stl"), (r"sten", "ste"), (r"ften", "fte"),
    (r"^sword", "sw"), (r"^answ", "nsw"), (r"dnes", "dne"),
    (r"bt$", "bt"), (r"scle$", "scl"), (r"eipt$", "eipt"),
    (r"^exh", "xh"), (r"pb", "pb"),
]

# Greek loan markers. 'ch' is only claimed where it is followed by a consonant
# or sits in a word that also carries another Greek marker, because 'ch' is far
# more often the ordinary /tʃ/ of 'chair'.
GREEK_CH = re.compile(r"ch(?=[^aeiou]|$)")

# /sh/ spelled with something other than sh.
SH_SPELLINGS = ["tion", "sion", "cious", "tious", "cial", "tial",
                "cient", "cience", "ciate", "tiate", "ssion", "cian"]

SUFFIXES = [
    ("suffix-ance-ence", ["ance", "ence", "ancy", "ency"]),
    ("suffix-ary-ery",   ["ary", "ery", "ory"]),
    ("suffix-able-ible", ["able", "ible"]),
    ("suffix-ant-ent",   ["ant", "ent"]),
]

FRENCH_ENDINGS = ["eur", "eau", "oir", "ette", "esque", "et", "que"]

# The -ce/-se noun-verb pairs. A closed set in English, and one of the few
# spelling rules that is genuinely regular: the NOUN takes c, the VERB takes s.
# 'Advice' is a noun and has ice in it. Note prophecy/prophesy end -cy/-sy, so
# the rule is about the consonant, not the last two letters.
#
# These matter more than an ordinary homophone because dictation alone cannot
# ask for one. 'The word is practice' does not tell a child which of the two
# words is wanted, so an item with no hint is not hard, it is impossible.
# weekly.py uses this table to supply the missing half of the prompt.
NOUN_VERB_PAIRS = {
    "advice": "noun",    "advise": "verb",
    "device": "noun",    "devise": "verb",
    "licence": "noun",   "license": "verb",
    "practice": "noun",  "practise": "verb",
    "prophecy": "noun",  "prophesy": "verb",
}


# One rule covers all ten. The generic 'homophone-trap' card says only that a
# word sounds the same as another, which for these is true and useless: this is
# one of the few English spelling rules that is completely regular, so say it.
PAIR_RULE = (
    "The noun has a c, the verb has an s. "
    "Advice is a thing, like ice. Advise is something you do."
)


def hint_for(word):
    """The disambiguating tag an item needs, or None. See NOUN_VERB_PAIRS."""
    return NOUN_VERB_PAIRS.get(normalise(word))


# Homophones and near-homophones a Year 6 list actually trips over. A pattern
# here means "another real word sounds the same", which is only knowable from
# a lexicon, so this is a list rather than a rule.
HOMOPHONES = {
    "accept", "except", "affect", "effect", "aloud", "allowed", "altar", "alter",
    "ascent", "assent", "bough", "bow", "brake", "break", "cereal", "serial",
    "compliment", "complement", "desert", "dessert", "draft", "draught",
    "farther", "father", "guessed", "guest", "heard", "herd", "led", "lead",
    "licence", "license", "morning", "mourning", "past", "passed", "practice",
    "practise", "precede", "proceed", "principal", "principle", "profit",
    "prophet", "stationary", "stationery", "steal", "steel", "wary", "weary",
    "whose", "who's", "your", "you're", "their", "there", "they're",
    "advice", "advise", "device", "devise", "council", "counsel",
}


def normalise(text):
    return re.sub(r"[^a-z]", "", (text or "").lower())


def _syllable_groups(word):
    """Vowel groups, as a rough stand-in for syllables. Good enough to tell a
    middle vowel from a first or last one, which is all the schwa rule needs."""
    return [m.span() for m in re.finditer(r"[aeiouy]+", word)]


# How teachable a pattern is, most first. Nearly every long English word
# contains a schwa and a soft c; saying so is true and useless. Curation names
# the ONE thing worth teaching about a word, so derivation ranks by specificity
# and keeps only the top few. Without this the schwa rule fired on half the
# statutory list and would have swamped the pattern-strength number in the
# grown-up view and sent her to the same rule card every time.
SPECIFICITY = [
    "homophone-trap",      # needs a lexicon; always the point when it applies
    "ough",
    "assimilated-prefix",  # explains WHY the double is there
    "doubling-1-1-1",
    "greek-marker",
    "silent-letter",
    "sh-spelling",
    "french-ending",
    "suffix-ance-ence", "suffix-ant-ent", "suffix-able-ible", "suffix-ary-ery",
    "keep-e",
    "ie-ei",
    "ou-spelling",
    "double-consonant",    # common, but a real decision
    "unique",
]
RANK = {p: i for i, p in enumerate(SPECIFICITY)}

# Curated entries carry one to three patterns. Match that.
MAX_PATTERNS = 3


def derive(word, limit=MAX_PATTERNS):
    """
    Return {"patterns": [...], "traps": [...]} for a bare spelling.

    Patterns come back ranked by teachability and capped, because classify()
    takes the first match when narrowing a diagnosis and the rule card shows
    the first one.
    """
    w = normalise(word)
    patterns, traps = [], []

    def add(pattern, trap=None):
        if pattern not in patterns:
            patterns.append(pattern)
        if trap and trap not in traps:
            traps.append(trap)

    if not w:
        return {"patterns": [], "traps": []}

    # --- doubling ---------------------------------------------------------
    doubled = [d for d in DOUBLES if d in w]
    for d in doubled:
        add("double-consonant", d)

    # A double at a prefix join is an assimilated prefix, which is the more
    # useful thing to teach: it explains WHY the double is there.
    for prefix, letter in ASSIMILATED:
        if w.startswith(prefix) and w[len(prefix):len(prefix) + 1] == letter:
            add("assimilated-prefix", prefix[-1] + letter)
            break

    # A double immediately before a vowel suffix is the 1-1-1 rule.
    m = re.search(r"([bcdfghjklmnpqrstvwxz])\1(ed|ing|er|est|en)$", w)
    if m:
        add("doubling-1-1-1", m.group(1) * 2)

    # --- suffix families --------------------------------------------------
    for pattern, endings in SUFFIXES:
        for e in endings:
            if w.endswith(e) and len(w) > len(e) + 2:
                add(pattern, e)
                break
        else:
            continue
        break

    if w.endswith("ely") and len(w) > 5:
        add("keep-e", "ely")

    for e in FRENCH_ENDINGS:
        if w.endswith(e) and len(w) > len(e) + 2:
            add("french-ending", e)
            break

    # --- sounds spelled unexpectedly --------------------------------------
    for s in SH_SPELLINGS:
        if s in w:
            add("sh-spelling", s)
            break

    # NOT DERIVED: soft-c-g and ou-spelling.
    #
    # Both are almost always PRESENT and almost never the lesson. Measured
    # against the curated words they scored 20%: four wrong claims for every
    # right one. A wrong pattern sends her to the wrong rule card and corrupts
    # the pattern-strength number, so silence is the better answer. Curated
    # statutory words still carry them by hand.

    if "ough" in w:
        add("ough", "ough")

    # The i-before-e decision, but not the inflections '-ies', '-ied', '-ier',
    # '-iest': those are the plural and comparative rules wearing the same
    # letters, and claiming them here scored badly against curation.
    ie = re.search(r"ie|ei", w)
    if ie and not re.search(r"i(es|ed|er|est)$", w):
        add("ie-ei", ie.group(0))

    # --- Greek markers ----------------------------------------------------
    greek = []
    if "ph" in w:
        greek.append("ph")
    if w.startswith("rh") or "rhy" in w:
        greek.append("rh")
    if w.startswith("ps"):
        greek.append("ps")
    # y as a vowel inside the word, not the ordinary -y ending.
    ym = re.search(r"[^aeiou]y[^aeiou]", w)
    if ym:
        greek.append("y")
    if GREEK_CH.search(w) and greek:
        greek.append("ch")
    for g in greek:
        add("greek-marker", g)

    # --- silent letters ---------------------------------------------------
    for rx, trap in SILENT:
        if re.search(rx, w):
            add("silent-letter", trap)
            break

    # --- NOT DERIVED: schwa -----------------------------------------------
    #
    # This one is the honest failure, and worth stating plainly rather than
    # shipping a rule that looks clever.
    #
    # A schwa trap is an UNSTRESSED vowel whose letter cannot be recovered
    # from its sound: the 'a' in 'separate', the 'i' in 'definite'. Stress is
    # a property of the spoken word, not of its letters, so no rule over the
    # spelling can tell 'separate' (schwa is the whole lesson) from
    # 'communicate' (it is not).
    #
    # Measured: a positional rule found 17 of the curated schwa words and
    # claimed 51 more that curation rejects — 25% precision. It would have
    # fired on roughly half the statutory list, sent her to the schwa rule
    # card constantly, and made pattern strength meaningless.
    #
    # If a schwa word needs teaching as such, curate it by hand in words.py or
    # note it on the list. A pronunciation dictionary with stress marks would
    # solve this properly; CMUdict is American, which docs/05 already rules out.

    # --- lexical ----------------------------------------------------------
    if w in HOMOPHONES or w in NOUN_VERB_PAIRS:
        add("homophone-trap", w)

    if not patterns:
        add("unique")

    # Rank, then cap. Traps are filtered to those belonging to a surviving
    # pattern would be neater, but a trap is a place in the word worth looking
    # at regardless of which rule won, so they are all kept.
    patterns.sort(key=lambda p: RANK.get(p, len(SPECIFICITY)))
    return {"patterns": patterns[:limit], "traps": traps}


def make_entry(word, source="weekly"):
    """
    Build an entry the rest of the engine can consume.

    The curated fields are left EMPTY rather than guessed. feedback() and the
    reveal screen check for them and omit those cards; see docs/12. `derived`
    marks the entry so the dataset can always tell a school word from a
    statutory one, which matters for any later analysis.
    """
    w = normalise(word)
    d = derive(w)
    return {
        "word": w,
        "syll": "", "lang": "", "root": "", "gloss": "",
        "morph": "-", "why": "", "family": [], "errors": [],
        "traps": d["traps"], "patterns": d["patterns"],
        "on_list": False, "derived": True, "source": source,
    }
