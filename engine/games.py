"""
Content for the learning games, for every word on the autumn 2026 term's lists.

WHAT IS HERE, AND WHAT IT RESTS ON.

  ENTRIES   the curated fields for the 52 term words that have no curated entry in
            words.py: morphemes, origin, one line of why, a word family. With these
            the reveal screen can show "How it is built" for a school word instead
            of hiding the card (docs/12 hid it because a GUESSED root told to a child
            is worse than none; these are not guessed, see SOURCES).
  MEANINGS  one plain definition per word, for the jigsaw and the game-show clues.
            None contains the word, or its root spelled out, or the definition
            would hand over the spelling.
  CLUES     the national curriculum's rule for each pattern word, quoted where the
            curriculum states it, and "learn it" where it says no rule helps.
  ROOTS     the root-match pairs, per week.
  SORTS     the pattern-sort decks, per week.

Evidence, briefly (docs/15-games.md has the full account):
  * Word parts (the jigsaw, the sort): morphological instruction benefits spelling,
    more for less able readers. Bowers, Kirby and Deacon 2010, 22 studies.
  * Origins (the root match): a hook with almost no controlled evidence for
    spelling. docs/01 Tier 4. It is here for meaning and interest, and says so.

SOURCES. The -ant/-ent and hyphen rules are quoted from the DfE's English
Appendix 1 (spelling), Years 5 and 6, pages 19 and 20; "man eating shark versus
man-eating shark" is Appendix 2, Year 6. Origins follow the standard dictionary
etymologies. Thirteen were checked against a source on 28 September 2026:
frantic, obstinate, hesitate, device and devise, calamity, decent, prophecy,
hostile, innocent, confident, evaluate and tolerate against etymonline.com, and
green-eyed against the Folger text of Othello (3.3). All matched except the date
for pig-headed ('stubborn' is from the 1780s; the 1610s sense was literal), now
corrected. The rest have not been checked one by one. Where a history is
disputed it is left out rather than simplified into something false.

REVIEW. Like the sentences, these were written offline and are waiting for an
adult to read them before a child does. docs/05 decision 2.
"""

# The rules, as the curriculum words them (Appendix 1, Years 5 and 6).
RULE_ANT = ("Use -ant, -ance or -ancy if a related word has an 'a' sound in the right "
            "place: -ation endings are often a clue.")
RULE_ENT = ("Use -ent, -ence or -ency after a soft c (an 's' sound), a soft g or qu, "
            "or if a related word has a clear 'e' sound in the right place.")
RULE_LEARN = "The curriculum says some of these just have to be learnt, and this is one."
RULE_HYPHEN_PREFIX = ("A hyphen can join a prefix to a word, especially when the prefix "
                      "ends in a vowel and the word starts with one: co-operate, re-enter.")
RULE_HYPHEN_COMPOUND = ("Two words that team up to describe something are joined by a "
                        "hyphen: a man-eating shark is not a man eating a shark.")
RULE_NOUN_VERB = "The noun has a c, the verb has an s. Advice is a thing; advise is doing."

ENTRIES = {
    # --- w/c 7 September: strong describing words --------------------------
    "hostile": dict(
        morph="host+ile", lang="Latin", root="hostis", gloss="an enemy, a stranger",
        why="From the Latin for an enemy. The ending is -ile, as in fragile.",
        family=["fragile", "futile", "agile"], meaning="Unfriendly and ready to fight."),
    "obstinate": dict(
        morph="obstin+ate", lang="Latin", root="obstinare", gloss="to stand firm, to persist",
        why="Someone who stands their ground. The ending says 'nut' but is spelt -ate.",
        family=["fortunate", "desperate", "delicate"],
        meaning="Refusing to change your mind, however hard others try."),
    "frantic": dict(
        morph="frant+ic", lang="Greek", root="phren", gloss="the mind",
        why="From a Greek word for a mind in a frenzy, as in frenzy itself.",
        family=["hectic", "panic", "fantastic"], meaning="Wild with worry or hurry."),
    "calamitous": dict(
        morph="calamit+ous", lang="Latin", root="calamitas", gloss="damage, a disaster",
        why="Calamity plus -ous: the y changes to i before the ending.",
        family=["disastrous", "glorious", "furious"], meaning="Causing terrible damage."),
    "spectacular": dict(
        morph="spectacul+ar", lang="Latin", root="spectare", gloss="to watch",
        why="Something worth watching: spectacle, spectator, inspect.",
        family=["spectator", "inspect", "spectacle"],
        meaning="Amazing to look at."),
    # --- w/c 21 September: nouns with c, verbs with s ----------------------
    "advice": dict(
        morph="ad+vice", lang="Latin", root="ad + videre", gloss="to see",
        why="How someone sees it. The noun has a c, like ice.",
        family=["device", "practice", "licence"],
        meaning="Words that help someone decide what to do (a thing)."),
    "advise": dict(
        morph="ad+vise", lang="Latin", root="ad + videre", gloss="to see",
        why="The verb, so it takes s: I advise you.",
        family=["devise", "practise", "license"],
        meaning="To tell someone what you think they should do (doing)."),
    "device": dict(
        morph="de+vice", lang="Latin", root="dividere", gloss="to divide",
        why="Once meant a plan worked out; now a gadget. The noun has a c.",
        family=["advice", "practice", "licence"],
        meaning="A gadget made to do a job (a thing)."),
    "devise": dict(
        morph="de+vise", lang="Latin", root="dividere", gloss="to divide",
        why="To work out a plan. The verb takes s.",
        family=["advise", "practise", "license"],
        meaning="To think up a plan or an idea (doing)."),
    "licence": dict(
        morph="lic+ence", lang="Latin", root="licere", gloss="to be allowed",
        why="A permission you can hold. The noun has a c.",
        family=["advice", "device", "practice"],
        meaning="A document that allows you to do something (a thing)."),
    "license": dict(
        morph="lic+ense", lang="Latin", root="licere", gloss="to be allowed",
        why="To give permission. The verb takes s.",
        family=["advise", "devise", "practise"],
        meaning="To give official permission (doing)."),
    "practice": dict(
        morph="pract+ice", lang="Greek", root="prassein", gloss="to do",
        why="Doing something again and again. The noun has a c.",
        family=["advice", "device", "licence"],
        meaning="Time spent doing something to get better at it (a thing)."),
    "practise": dict(
        morph="pract+ise", lang="Greek", root="prassein", gloss="to do",
        why="The verb, so it takes s: you practise the piano.",
        family=["advise", "devise", "license"],
        meaning="To do something again and again to get better (doing)."),
    "prophecy": dict(
        morph="pro+phe+cy", lang="Greek", root="pro + phanai", gloss="to speak before",
        why="Spoken before it happens. The noun ends -cy, said 'see'.",
        family=["advice", "device", "practice"],
        meaning="A statement of what will happen in the future (a thing)."),
    "prophesy": dict(
        morph="pro+phe+sy", lang="Greek", root="pro + phanai", gloss="to speak before",
        why="The verb ends -sy, said 'sigh'. Say it out loud to hear the difference.",
        family=["advise", "devise", "practise"],
        meaning="To say what will happen in the future (doing)."),
    # --- w/c 28 September: -ant, -ance and -ancy ---------------------------
    "observant": dict(
        morph="observ+ant", lang="Latin", root="observare", gloss="to watch over",
        why="Observation has -ation, so the ending is -ant.",
        family=["observance", "observation", "observe"],
        meaning="Good at noticing things."),
    "observance": dict(
        morph="observ+ance", lang="Latin", root="observare", gloss="to watch over",
        why="Observation has -ation, so the ending is -ance.",
        family=["observant", "observation", "observe"],
        meaning="Keeping to a rule or a custom."),
    "expectant": dict(
        morph="expect+ant", lang="Latin", root="ex + spectare", gloss="to look out for",
        why="Expectation has -ation, so the ending is -ant.",
        family=["expectancy", "expectation", "expect"],
        meaning="Waiting eagerly for something to happen."),
    "expectancy": dict(
        morph="expect+ancy", lang="Latin", root="ex + spectare", gloss="to look out for",
        why="Expectation has -ation, so the ending is -ancy.",
        family=["expectant", "expectation", "expect"],
        meaning="The feeling that something is about to happen."),
    "hesitant": dict(
        morph="hesit+ant", lang="Latin", root="haesitare", gloss="to stick, to hold back",
        why="Hesitation has -ation, so the ending is -ant.",
        family=["hesitancy", "hesitation", "hesitate"],
        meaning="Unsure, and slow to act or speak."),
    "hesitancy": dict(
        morph="hesit+ancy", lang="Latin", root="haesitare", gloss="to stick, to hold back",
        why="Hesitation has -ation, so the ending is -ancy.",
        family=["hesitant", "hesitation", "hesitate"],
        meaning="Being slow to act because you are unsure."),
    "tolerant": dict(
        morph="toler+ant", lang="Latin", root="tolerare", gloss="to bear, to put up with",
        why="Toleration has -ation, so the ending is -ant.",
        family=["tolerance", "toleration", "tolerate"],
        meaning="Willing to accept people and ideas that differ from yours."),
    "tolerance": dict(
        morph="toler+ance", lang="Latin", root="tolerare", gloss="to bear, to put up with",
        why="Toleration has -ation, so the ending is -ance.",
        family=["tolerant", "toleration", "tolerate"],
        meaning="Being able to put up with something."),
    "relevance": dict(
        morph="relev+ance", lang="Latin", root="re + levare", gloss="to lift up",
        why="No related word gives the a away: relevance just has to be learnt.",
        family=["relevant", "irrelevant"],
        meaning="How closely something is connected to what matters."),
    # --- w/c 5 October: -ent, -ence and -ency ------------------------------
    "innocent": dict(
        morph="in+noc+ent", lang="Latin", root="in + nocere", gloss="not harming",
        why="The c says 's' before the ending, so it is -ent.",
        family=["innocence", "decent", "magnificent"],
        meaning="Not guilty of doing anything wrong."),
    "innocence": dict(
        morph="in+noc+ence", lang="Latin", root="in + nocere", gloss="not harming",
        why="The c says 's' before the ending, so it is -ence.",
        family=["innocent", "decency", "magnificence"],
        meaning="Being free from guilt, or not knowing about bad things."),
    "decent": dict(
        morph="dec+ent", lang="Latin", root="decere", gloss="to be fitting",
        why="The c says 's' before the ending, so it is -ent.",
        family=["decency", "innocent", "recent"],
        meaning="Good, kind and fair."),
    "decency": dict(
        morph="dec+ency", lang="Latin", root="decere", gloss="to be fitting",
        why="The c says 's' before the ending, so it is -ency.",
        family=["decent", "innocence", "urgency"],
        meaning="Behaving in a good, kind and fair way."),
    "excellence": dict(
        morph="ex+cell+ence", lang="Latin", root="ex + cellere", gloss="to rise above",
        why="No rule gives the e away: excellence just has to be learnt. Think excel.",
        family=["excellent", "excel"],
        meaning="Being very, very good at something."),
    "confident": dict(
        morph="con+fid+ent", lang="Latin", root="con + fidere", gloss="to trust fully",
        why="You can hear the e in confidential, so the ending is -ent.",
        family=["confidence", "confidential", "confide"],
        meaning="Sure that you can do something."),
    "confidence": dict(
        morph="con+fid+ence", lang="Latin", root="con + fidere", gloss="to trust fully",
        why="You can hear the e in confidential, so the ending is -ence.",
        family=["confident", "confidential", "confide"],
        meaning="The feeling of being sure you can do something."),
    "existent": dict(
        morph="ex+ist+ent", lang="Latin", root="ex + sistere", gloss="to stand out",
        why="You can hear the e in existential, so the ending is -ent.",
        family=["existence", "exist", "non-existent"],
        meaning="Real, and still there."),
    # --- w/c 12 October: hyphens after co- and re- -------------------------
    "co-operate": dict(
        morph="co+operate", lang="Latin", root="co + operari", gloss="to work together",
        why="co ends in o and operate starts with o: the hyphen keeps them apart.",
        family=["co-ordinate", "co-own", "co-author"],
        meaning="To work together with others."),
    "co-ordinate": dict(
        morph="co+ordinate", lang="Latin", root="co + ordinare", gloss="to put in order together",
        why="co ends in o and ordinate starts with o, so a hyphen goes between.",
        family=["co-operate", "co-own", "co-author"],
        meaning="To make different parts work together smoothly."),
    "co-own": dict(
        morph="co+own", lang="English", root="co + own", gloss="to have together",
        why="Without the hyphen it would look like coown. The hyphen keeps co and own apart.",
        family=["co-operate", "co-ordinate", "co-author"],
        meaning="To have something together with someone else."),
    "co-author": dict(
        morph="co+author", lang="Latin", root="co + auctor", gloss="a maker, together",
        why="co ends in a vowel and author starts with one, so a hyphen joins them.",
        family=["co-operate", "co-ordinate", "co-own"],
        meaning="To write something together with someone else."),
    "re-enter": dict(
        morph="re+enter", lang="Latin", root="re + intrare", gloss="to go in again",
        why="re ends in e and enter starts with e: the hyphen keeps both.",
        family=["re-examine", "re-educate", "re-elect"],
        meaning="To go back in."),
    "re-educate": dict(
        morph="re+educate", lang="Latin", root="re + educare", gloss="to bring up again",
        why="re ends in e and educate starts with e, so a hyphen goes between.",
        family=["re-enter", "re-examine", "re-evaluate"],
        meaning="To teach someone again, or teach them a new way."),
    "re-examine": dict(
        morph="re+examine", lang="Latin", root="re + examinare", gloss="to weigh up again",
        why="re ends in e and examine starts with e: the hyphen keeps both.",
        family=["re-enter", "re-educate", "re-evaluate"],
        meaning="To look at something carefully again."),
    "re-evaluate": dict(
        morph="re+evaluate", lang="French", root="re + evaluer", gloss="to judge the worth again",
        why="re ends in e and evaluate starts with e, so a hyphen goes between.",
        family=["re-examine", "re-energise", "re-elect"],
        meaning="To think again about how good or useful something is."),
    "re-energise": dict(
        morph="re+energise", lang="Greek", root="re + energeia", gloss="activity, once more",
        why="re ends in e and energise starts with e: the hyphen keeps both.",
        family=["re-enter", "re-elect", "re-evaluate"],
        meaning="To give someone back their get-up-and-go."),
    "re-elect": dict(
        morph="re+elect", lang="Latin", root="re + eligere", gloss="to pick out again",
        why="re ends in e and elect starts with e, so a hyphen goes between.",
        family=["re-enter", "re-educate", "re-energise"],
        meaning="To choose the same person again in a vote."),
    # --- w/c 19 October: hyphens that join two words ----------------------
    "man-eating": dict(
        morph="man+eating", lang="English", root="man + eating", gloss="that eats people",
        why="Man and eating team up to describe the shark, so they are joined.",
        family=["little-used", "rock-bottom", "wide-eyed"],
        meaning="Describes a shark or a tiger that hunts people for food."),
    "little-used": dict(
        morph="little+used", lang="English", root="little + used", gloss="hardly ever used",
        why="Joined, it means hardly used. A little used car is a small second-hand one.",
        family=["man-eating", "rock-bottom", "wide-eyed"],
        meaning="Rarely needed, rarely visited."),
    "rock-bottom": dict(
        morph="rock+bottom", lang="English", root="rock + bottom", gloss="the very lowest",
        why="Two words working as one describing word before 'prices'.",
        family=["man-eating", "little-used", "wide-eyed"],
        meaning="As low as it can possibly go."),
    "wide-eyed": dict(
        morph="wide+eyed", lang="English", root="wide + eyed", gloss="with eyes wide open",
        why="One of a family: wide-eyed, green-eyed, pig-headed, cold-hearted.",
        family=["green-eyed", "pig-headed", "cold-hearted"],
        meaning="Looking amazed and full of wonder."),
    "pig-headed": dict(
        morph="pig+headed", lang="English", root="pig + headed", gloss="stubborn",
        why="Joined, it means stubborn. 'A pig headed for the mud' is a pig going somewhere.",
        family=["wide-eyed", "cold-hearted", "stone-faced"],
        meaning="Stubborn, refusing to change your mind."),
    "tight-fisted": dict(
        morph="tight+fisted", lang="English", root="tight + fisted", gloss="mean with money",
        why="A hand clenched round its money: two words making one describing word.",
        family=["cold-hearted", "stone-faced", "short-tempered"],
        meaning="Not willing to spend or share money."),
    "cold-hearted": dict(
        morph="cold+hearted", lang="English", root="cold + hearted", gloss="unkind, unfeeling",
        why="Cold and hearted team up to describe a person, so they are joined.",
        family=["wide-eyed", "pig-headed", "tight-fisted"],
        meaning="Unkind, without any warm feelings."),
    "stone-faced": dict(
        morph="stone+faced", lang="English", root="stone + faced", gloss="showing no feeling",
        why="A face as still as stone. Joined, because together they describe the guard.",
        family=["cold-hearted", "pig-headed", "wide-eyed"],
        meaning="Showing no feelings at all, as still as a statue."),
    "green-eyed": dict(
        morph="green+eyed", lang="English", root="green + eyed", gloss="jealous",
        why="Shakespeare called jealousy 'the green-eyed monster' in Othello.",
        family=["wide-eyed", "pig-headed", "cold-hearted"],
        meaning="Jealous. Shakespeare gave jealousy a monster with eyes this colour."),
    "short-tempered": dict(
        morph="short+tempered", lang="English", root="short + tempered",
        gloss="quick to get angry",
        why="A temper with a short fuse. Two words joined into one describing word.",
        family=["tight-fisted", "cold-hearted", "stone-faced"],
        meaning="Quick to get angry."),
}

# One plain definition for each term word that already has a curated entry.
MEANINGS = {
    "aggressive": "Ready to attack or fight.",
    "awkward": "Clumsy, or uncomfortable and embarrassing.",
    "desperate": "Willing to try anything because things are so bad.",
    "disastrous": "Going terribly wrong.",
    "marvellous": "Wonderful.",
    "accommodate": "To have enough room for people or things.",
    "accompany": "To go somewhere with someone.",
    "according": "As someone or something says.",
    "achieve": "To succeed in doing something through effort.",
    "amateur": "Someone who does something for fun rather than as a job.",
    "ancient": "Very, very old.",
    "apparent": "Clear to see or understand.",
    "appreciate": "To be grateful for something.",
    "attached": "Fixed or joined on to something.",
    "available": "Free to be used or had.",
    "relevant": "Connected to what is being talked about.",
    "average": "Normal or usual; not special.",
    "bargain": "Something bought for less than it is worth.",
    "bruise": "A dark mark on the skin from a bump.",
    "category": "A group of things that are alike.",
    "excellent": "Extremely good.",
    "existence": "Being real, or being alive.",
    "cemetery": "A place where people are buried.",
    "committee": "A group of people chosen to make decisions.",
    "communicate": "To share information or ideas.",
    "community": "The people living in one place.",
    "competition": "A contest to see who is best.",
    "conscience": "The feeling inside that tells you right from wrong.",
    "conscious": "Awake and aware.",
    "controversy": "A big disagreement about something.",
    "convenience": "Being easy and useful.",
    "correspond": "To write letters to each other.",
    "criticise": "To say what is wrong with something.",
    "curiosity": "Wanting to know or learn about things.",
    "definite": "Certain and fixed.",
    "determined": "Having decided firmly to do something.",
}

# The pattern word each curriculum rule applies to, with the related word that
# gives it away where the curriculum says there is one.
CLUES = {
    "observant": ("ant", "observation"), "observance": ("ant", "observation"),
    "expectant": ("ant", "expectation"), "expectancy": ("ant", "expectation"),
    "hesitant": ("ant", "hesitation"), "hesitancy": ("ant", "hesitation"),
    "tolerant": ("ant", "toleration"), "tolerance": ("ant", "toleration"),
    "relevant": ("learn", None), "relevance": ("learn", None),
    "innocent": ("soft-c", None), "innocence": ("soft-c", None),
    "decent": ("soft-c", None), "decency": ("soft-c", None),
    "excellent": ("learn", None), "excellence": ("learn", None),
    "confident": ("clear-e", "confidential"), "confidence": ("clear-e", "confidential"),
    "existent": ("clear-e", "existential"), "existence": ("clear-e", "existential"),
}

# Root match: a word part, what it means, and where it comes from. Per week, in
# the order they appear on the sheet. The game draws five at a time.
ROOTS = {
    "week-2026-09-07": [
        ("gress", "step", "Latin gradi", ["aggressive"]),
        ("host", "enemy, stranger", "Latin hostis", ["hostile"]),
        ("awk", "turned the wrong way", "Old Norse afugr", ["awkward"]),
        ("obstin", "stand firm", "Latin obstinare", ["obstinate"]),
        ("sper", "hope", "Latin sperare", ["desperate"]),
        ("frant", "the mind", "Greek phren", ["frantic"]),
        ("astr", "star", "Latin astrum", ["disastrous"]),
        ("calamit", "damage, disaster", "Latin calamitas", ["calamitous"]),
        ("marvel", "wonderful things", "French, from Latin mirabilia", ["marvellous"]),
        ("spect", "watch", "Latin spectare", ["spectacular"]),
        ("mod", "measure, fit", "Latin modus", ["accommodate"]),
        ("cord", "heart", "Latin cor, cordis", ["according"]),
        ("amat", "love", "Latin amare", ["amateur"]),
    ],
    "week-2026-09-21": [
        # Whole pairs, not parts: advice and device share -vice by accident of
        # history (one is 'see', one is 'divide'), which is a trap, not a lesson.
        ("advice, advise", "a way of seeing", "Latin videre", ["advice", "advise"]),
        ("device, devise", "a plan worked out", "Latin dividere", ["device", "devise"]),
        ("licence, license", "being allowed", "Latin licere", ["licence", "license"]),
        ("practice, practise", "doing", "Greek prassein", ["practice", "practise"]),
        ("prophecy, prophesy", "speaking before", "Greek phanai", ["prophecy", "prophesy"]),
        ("anci", "before", "Latin ante", ["ancient"]),
        ("par", "appear", "Latin parere", ["apparent"]),
        ("preci", "price", "Latin pretium", ["appreciate"]),
        ("tach", "fasten", "Old French atachier", ["attached"]),
        ("vail", "be strong, be worth", "Latin valere", ["available"]),
    ],
    "week-2026-09-28": [
        ("observ", "watch over", "Latin observare", ["observant", "observance"]),
        ("expect", "look out for", "Latin exspectare", ["expectant", "expectancy"]),
        ("hesit", "stick, hold back", "Latin haesitare", ["hesitant", "hesitancy"]),
        ("toler", "bear, put up with", "Latin tolerare", ["tolerant", "tolerance"]),
        ("relev", "lift up", "Latin relevare", ["relevant", "relevance"]),
        ("aver", "damage to cargo", "Arabic awar", ["average"]),
        ("bargain", "haggle", "Old French bargaignier", ["bargain"]),
        ("bruise", "crush", "Old English brysan", ["bruise"]),
        ("categor", "a statement", "Greek kategoria", ["category"]),
        ("awk", "turned the wrong way", "Old Norse afugr", ["awkward"]),
    ],
    "week-2026-10-05": [
        ("noc", "harm", "Latin nocere", ["innocent", "innocence"]),
        ("dec", "be fitting", "Latin decere", ["decent", "decency"]),
        ("cell", "rise above", "Latin excellere", ["excellent", "excellence"]),
        ("fid", "trust", "Latin fidere", ["confident", "confidence"]),
        ("sist", "stand", "Latin sistere", ["existent", "existence"]),
        ("cemeter", "a sleeping place", "Greek koimeterion", ["cemetery"]),
        ("mitt", "send", "Latin mittere", ["committee"]),
        ("commun", "shared by all", "Latin communis", ["communicate", "community"]),
        ("pet", "seek", "Latin petere", ["competition"]),
    ],
    "week-2026-10-12": [
        ("co-", "together, with", "Latin com", ["co-operate", "co-ordinate", "co-own", "co-author"]),
        ("re-", "again", "Latin re", ["re-enter", "re-educate", "re-examine", "re-evaluate",
                                     "re-energise", "re-elect"]),
        ("operate", "work", "Latin operari", ["co-operate"]),
        ("ordinate", "put in order", "Latin ordinare", ["co-ordinate"]),
        ("author", "a maker, a writer", "Latin auctor", ["co-author"]),
        ("enter", "go in", "Latin intrare", ["re-enter"]),
        ("educate", "bring up, teach", "Latin educare", ["re-educate"]),
        ("examine", "weigh up", "Latin examinare", ["re-examine"]),
        ("elect", "pick out, choose", "Latin eligere", ["re-elect"]),
        ("energise", "fill with energy", "Greek energeia", ["re-energise"]),
        ("sci", "know", "Latin scire", ["conscience", "conscious"]),
        ("vers", "turn", "Latin vertere", ["controversy"]),
        ("veni", "come", "Latin venire", ["convenience"]),
        ("respond", "answer", "Latin respondere", ["correspond"]),
    ],
    "week-2026-10-19": [
        ("pig-headed", "stubborn", "English, in this sense since the 1780s", ["pig-headed"]),
        ("tight-fisted", "mean with money", "English", ["tight-fisted"]),
        ("cold-hearted", "unkind, unfeeling", "English", ["cold-hearted"]),
        ("stone-faced", "showing no feeling", "English", ["stone-faced"]),
        ("green-eyed", "jealous", "Shakespeare, Othello", ["green-eyed"]),
        ("short-tempered", "quick to get angry", "English", ["short-tempered"]),
        ("wide-eyed", "amazed", "English", ["wide-eyed"]),
        ("rock-bottom", "the very lowest", "English", ["rock-bottom"]),
        ("little-used", "hardly ever used", "English", ["little-used"]),
        ("man-eating", "that eats people", "English", ["man-eating"]),
        ("crit", "judge", "Greek kritikos", ["criticise"]),
        ("cur", "care", "Latin cura", ["curiosity"]),
        ("fin", "boundary, end", "Latin finis", ["definite"]),
        ("termin", "limit", "Latin terminus", ["determined"]),
    ],
}


def _vowel_gap(word):
    """'observant' -> ('observ', 'a', 'nt'): the one letter the -ant/-ent choice is."""
    for ending in ("ancy", "ency", "ance", "ence", "ant", "ent"):
        if word.endswith(ending):
            stem = word[: -len(ending)]
            return stem, ending[0], ending[1:]
    raise ValueError(word)


def _ant_ent_card(word):
    stem, letter, rest = _vowel_gap(word)
    kind, related = CLUES[word]
    explain = {
        "ant": f"{related} has -ation, so it is -a{rest}.",
        "soft-c": f"the c says 's' before the ending, so it is -e{rest}.",
        "clear-e": f"you can hear the e in {related}, so it is -e{rest}.",
        "learn": f"no rule helps with {word}: it just has to be learnt.",
    }[kind]
    return {"word": word, "show": [stem, rest], "answer": letter, "full": word,
            "explain": explain}


# Pattern sort decks. Each card shows the word with the decision left out, and
# every bin is a real choice the list turns on. The -ant and -ent weeks sort
# together: a deck of only -ant words has nothing to decide.
ANT_ENT = list(CLUES)
# re- before a consonant: no hyphen. Deliberately not re- before a vowel without
# one (reopen, react): real, but they would contradict the rule being taught.
NO_HYPHEN = [("re", "turn"), ("re", "wind"), ("re", "build"), ("re", "play"), ("re", "cycle")]

SORTS = {
    "week-2026-09-21": {
        "title": "c or s?", "cards": "noun-verb",
        "bins": [{"key": "c", "label": "c", "note": "a thing (noun)"},
                 {"key": "s", "label": "s", "note": "doing (verb)"}]},
    "week-2026-09-28": {
        "title": "-ant or -ent?", "cards": "ant-ent",
        "bins": [{"key": "a", "label": "a", "note": "-ant, -ance, -ancy"},
                 {"key": "e", "label": "e", "note": "-ent, -ence, -ency"}]},
    "week-2026-10-05": {
        "title": "-ent or -ant?", "cards": "ant-ent",
        "bins": [{"key": "a", "label": "a", "note": "-ant, -ance, -ancy"},
                 {"key": "e", "label": "e", "note": "-ent, -ence, -ency"}]},
    "week-2026-10-12": {
        "title": "Hyphen or not?", "cards": "hyphen-prefix",
        "bins": [{"key": "hyphen", "label": "hyphen", "note": "vowel meets vowel"},
                 {"key": "none", "label": "no hyphen", "note": "starts with a consonant"}]},
    "week-2026-10-19": {
        "title": "Hyphen or space?", "cards": "hyphen-compound",
        "bins": [{"key": "hyphen", "label": "hyphen", "note": "one describing word"},
                 {"key": "space", "label": "space", "note": "two separate words"}]},
}

# For the compound week: the same two words, joined and not. The curriculum's own
# example is this kind of pair (Appendix 2, Year 6: man eating shark versus
# man-eating shark).
COMPOUND_PHRASES = [
    ("a man", "eating", "shark", "hyphen", "man-eating", "man and eating describe the shark together."),
    ("a man", "eating", "chips", "space", None, "here a man is eating: two separate words."),
    ("a pig", "headed", "boy", "hyphen", "pig-headed", "joined, pig-headed means stubborn."),
    ("a pig", "headed", "for the mud", "space", None, "here the pig is going somewhere."),
    ("a little", "used", "path", "hyphen", "little-used", "joined, it means hardly ever used."),
    ("a little", "used", "car", "space", None, "a small car that someone has used before."),
    ("a wide", "eyed", "puppy", "hyphen", "wide-eyed", "wide and eyed describe the puppy together."),
    ("a green", "eyed", "cat", "hyphen", "green-eyed", "green and eyed describe the cat together."),
    ("a cold", "hearted", "giant", "hyphen", "cold-hearted", "cold and hearted describe the giant together."),
    ("a stone", "faced", "guard", "hyphen", "stone-faced", "stone and faced describe the guard together."),
    ("a tight", "fisted", "king", "hyphen", "tight-fisted", "tight and fisted describe the king together."),
    ("a short", "tempered", "chef", "hyphen", "short-tempered", "short and tempered describe the chef together."),
    ("rock", "bottom", "prices", "hyphen", "rock-bottom", "rock and bottom describe the prices together."),
]


def sort_deck(week_id, term_weeks, sentences, noun_verb_pairs):
    """The cards for one week's sort, or None if that week has no binary rule."""
    spec = SORTS.get(week_id)
    if not spec:
        return None
    kind = spec["cards"]
    if kind == "ant-ent":
        cards = [_ant_ent_card(w) for w in ANT_ENT]
    elif kind == "noun-verb":
        cards = []
        for w in noun_verb_pairs:
            s = sentences[w]
            i = s.lower().index(w)
            # The c or s is the second-last letter of every one of the ten.
            cut = i + len(w) - 2
            letter = w[-2]
            cards.append({"word": w, "show": [s[:cut], s[cut + 1:]], "answer": letter,
                          "full": s,
                          "explain": f"{w} is a "
                                     f"{'thing (noun)' if letter == 'c' else 'doing word (verb)'}"
                                     f", so it takes {letter}."})
    elif kind == "hyphen-prefix":
        week = next(w for w in term_weeks if w["id"] == week_id)
        cards = []
        for w in week["pattern"]:
            head, tail = w.split("-", 1)
            cards.append({"word": w, "show": [head, tail], "answer": "hyphen", "full": w,
                          "explain": f"{head} ends in a vowel and {tail} starts with one, "
                                     f"so a hyphen keeps them apart."})
        for head, tail in NO_HYPHEN:
            cards.append({"word": None, "show": [head, tail], "answer": "none",
                          "full": head + tail,
                          "explain": f"{tail} starts with a consonant, so {head}{tail} "
                                     f"needs no hyphen."})
    elif kind == "hyphen-compound":
        cards = []
        for a, b, noun, answer, word, why in COMPOUND_PHRASES:
            sep = "-" if answer == "hyphen" else " "
            cards.append({"word": word, "show": [a, f"{b} {noun}"], "answer": answer,
                          "full": f"{a}{sep}{b} {noun}", "explain": why})
    else:
        raise ValueError(kind)
    return {"title": spec["title"], "bins": spec["bins"], "cards": cards}


# --------------------------------------------------------------------------
# Building the shipped data (engine/export.py writes it to web/data/games.json)

PREFIXES = {"a", "ac", "ad", "ag", "ap", "at", "co", "com", "con", "contro", "cor",
            "de", "dis", "ex", "in", "ob", "pro", "re"}
SUFFIXES = {"ant", "ance", "ancy", "ent", "ence", "ency", "ense", "ice", "ise", "ate",
            "ive", "ile", "ic", "ous", "lous", "ar", "y", "ity", "ition", "ed", "ing",
            "able", "age", "ee", "ward", "eur", "ite", "cy", "sy"}

# The one wrong piece a jigsaw offers, where the list turns on a real choice.
# Never more than one: the game is about the decision, not about searching.
DECOYS = {"ant": "ent", "ent": "ant", "ance": "ence", "ence": "ance",
          "ancy": "ency", "ency": "ancy", "ense": "ence", "ice": "ise", "ise": "ice",
          "vice": "vise", "vise": "vice", "cy": "sy", "sy": "cy", "able": "ible",
          "ite": "ate"}


def parts_for(word, morph):
    """Jigsaw pieces: the morphemes, with a hyphen as a piece of its own."""
    texts = [p for p in morph.split("+") if p] if morph and morph != "-" else [word.replace("-", "")]
    compound = "-" in word and "hyphen-compound" in _derived_patterns(word)
    kinds = []
    for i, t in enumerate(texts):
        last = i == len(texts) - 1
        if compound:
            kinds.append("word")
        elif not last and all(texts[j] in PREFIXES for j in range(i + 1)):
            kinds.append("prefix")
        elif last and len(texts) > 1 and t in SUFFIXES:
            kinds.append("suffix")
        else:
            kinds.append("root")
    pieces, at = [], 0
    letters = word.replace("-", "")
    hyphen_at = {len(h.replace("-", "")) for h in _prefixes_of(word)}
    for t, k in zip(texts, kinds):
        if at in hyphen_at and at:
            pieces.append({"text": "-", "kind": "hyphen"})
        pieces.append({"text": t, "kind": k})
        at += len(t)
    if "".join(p["text"] for p in pieces) != word or at != len(letters):
        raise ValueError(f"the parts of {word} do not join back up: {pieces}")
    return pieces


def _prefixes_of(word):
    """Every prefix of the word that ends just before one of its hyphens."""
    return [word[:i] for i, ch in enumerate(word) if ch == "-"]


def _derived_patterns(word):
    import derive
    return derive.derive(word, limit=99)["patterns"]


def decoys_for(pieces):
    last = pieces[-1]
    if last["kind"] in ("suffix", "root") and last["text"] in DECOYS and len(pieces) > 1:
        return [{"text": DECOYS[last["text"]], "kind": last["kind"]}]
    return []


def term_entries():
    """The 52 authored entries, as full engine entries with derived patterns."""
    import derive
    out = []
    for word, fields in ENTRIES.items():
        e = derive.make_entry(word, source="term")
        e.update({k: v for k, v in fields.items() if k != "meaning"})
        e["authored"] = True
        out.append(e)
    return out


def build(weeks, curated, sentences, noun_verb_pairs):
    words = {}
    for week in weeks:
        for w in week["words"]:
            if w in words:
                continue
            entry = curated.get(w) or ENTRIES[w]
            pieces = parts_for(w, entry["morph"])
            words[w] = {
                "parts": pieces,
                "decoys": decoys_for(pieces),
                "meaning": MEANINGS.get(w) or ENTRIES[w]["meaning"],
                "why": entry["why"],
                "origin": {"lang": entry["lang"], "root": entry["root"], "gloss": entry["gloss"]},
            }
    per_week = {}
    for week in weeks:
        per_week[week["id"]] = {
            "roots": [{"part": part, "means": means, "from": source, "words": ws}
                      for part, means, source, ws in ROOTS.get(week["id"], [])],
            "sort": sort_deck(week["id"], weeks, sentences, noun_verb_pairs),
        }
    return {
        "generated_by": "engine/games.py",
        "review_note": "Written offline. Read these before a child does. See engine/games.py.",
        "rules": {"ant": RULE_ANT, "ent": RULE_ENT, "learn": RULE_LEARN,
                  "hyphen-prefix": RULE_HYPHEN_PREFIX, "hyphen-compound": RULE_HYPHEN_COMPOUND,
                  "noun-verb": RULE_NOUN_VERB},
        "words": words,
        "weeks": per_week,
    }
