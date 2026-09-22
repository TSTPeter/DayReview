# This week's spellings

Every week the school sends home a list and tests it on Friday. This is how
the app takes that seriously without abandoning everything it is for.

## The tension, stated plainly

A Friday deadline wants **massed** practice. Everything else in this product is
built on the opposite: spacing beat massing by about 10.6 percentage points
across 254 studies and 14,811 participants, and it is the largest effect the
whole thing rests on ([Cepeda et al. 2006](https://augmentingcognition.com/assets/Cepeda2006.pdf)).

Both are right, on different horizons, so the week is split:

| When | What a session looks like |
|---|---|
| Before the test | ~2 words in 3 from this week's list, the rest statutory words that are due |
| After the test | the ordinary due queue — which now contains this week's words, on their own Leitner schedule |

The second row is the point, and it is the part a weekly-list app usually
skips. `docs/00`'s first success criterion is spelling the word correctly in a
dictated test **a week or more after practice**, and its second is spelling it
in her own writing, which is the KS2 teacher-assessment standard. A list that
vanishes on Friday can teach a child to pass Friday. That is not what anyone
wants.

## "Folding in" does not happen by itself

Once the test is past, this week's ten words are ten among a hundred and odd,
and `Scheduler.session()` breaks ties alphabetically, so *tomorrow* waits
behind *accommodate* and the 1-2-4-8-16 day intervals never land on the day
they say. The spacing that is the entire reason for folding them in would be
delivered by accident of the alphabet, or not at all.

So for three weeks after the test, words from that list **that are due** get
first call on a third of the session. Due is the operative word: this does not
re-drill them, it lets the interval arrive on time. Measured on a simulated
week — four words she kept missing, six she knew:

```
+1 day   wednesday, necessary, rhythm, conscience   (the four she missed, box 1)
+3 days  the same four, interval doubling as she gets them right
+7 days  the same four
+15 days the same four
+16 days separate, business, definitely, embarrass  (the six she knew, box 5)
+17 days occurred, tomorrow
```

After three weeks the boost expires and they are ordinary words with real box
positions.

## Words the app has never seen

A school list is mostly not the DfE statutory list. `engine/words.py` has
hand-curated data for its 103 words — syllables, morphemes, origin, root,
gloss, the one-line why, the word family — and *tomorrow* has none of that.

**What still works with no curation at all.** The classifier needs only the
letters: transposition, omission, addition, doubling, the marked-up diff and
the phonological-plausibility test all run on any string. Verified before any
of this was built.

**What is derived.** `engine/derive.py` infers the PATTERN from the spelling —
doubling, assimilated prefixes, suffix families, silent letters, Greek markers,
the /sh/ spellings, ie/ei, ough, French endings. The pattern is what makes the
app teach rather than merely mark: without one, a miss tells the scheduler
nothing and the rule card has nothing to show.

**What is not derived, and never guessed.** Origin, root, gloss, morphemes and
word family are knowledge *about* a word, not properties of its letters. A
guessed root told to a child is worse than a missing one, so those fields stay
empty and the reveal screen hides that card rather than printing `Latin: , `.
She still gets the marking, the named error and the rule.

The list-entry screen says which is which before she starts:

> 6 words · 2 already known in full (necessary, rhythm) · 4 read from the
> spelling — she'll get the rule but not the word history

A word curated anywhere — the statutory list or the off-list transfer set —
keeps its full entry and is merely prioritised this week.

## What the first real list broke

The first list from school was not a tidy column of words. It was this:

```
Noun/verb pairs (N = noun, V = verb):
advice (N) / advise (V) / device (N) / devise (V) / licence (N) / license (V)
/ practice (N) / practise (V) / prophecy (N) / prophesy (V)
Plain list:
ancient, apparent, appreciate, attached, available
```

Pasted into the app as it then stood, that produced **twenty** words. Five of
them were `noun`, `verb`, `pairs`, `plain` and `list`. Beatrix would have been
asked to spell *pairs*.

The second defect was worse, and it was not a parsing bug. Ten of the fifteen
words are `-ce`/`-se` noun-verb pairs, and eight of those ten are exact
homophones. The dictation script says the word, then a sentence, then the word
again. For these it said:

> The word is licence. *(no sentence: derived words have none)* The word is licence.

There is no question in that. `licence` and `license` are the same sound; a
child cannot get it right except by guessing, and a wrong answer records an
error type that describes nothing. An impossible item is worse than a missing
one, because it shows up in the data as a miss.

Both are fixed, and the fixes generalise rather than special-casing this list:

**Headings are skipped.** A line ending in a colon is a heading. (`HEADING` in
`engine/weekly.py`.)

**Word-class tags are read, not discarded.** `advice (N)`, `queue [noun]`,
`hollow (adjective)`. The line is split on `/ , ;` first, so a tag attaches to
the word it follows rather than to the next one. A tag that is not a word class
— `rhythm (x3)` — is dropped without becoming either a hint or a word.

**The ten pairs are known without any tag at all**, because a hurried retype is
the normal case. `derive.NOUN_VERB_PAIRS` is a closed set: in English there are
only these five pairs. A tag the school supplied wins over the table, in case a
school teaches one of them the other way round.

**The word class is spoken as part of the prompt**, which is what a teacher
dictating these actually does:

> The word is advice, the noun. She gave me some good advice about the test.
> The word is advice, the noun.

**All ten now have sentences**, written so the *grammar* rules the partner out
rather than merely making it unlikely — a determiner or adjective in front of
the noun, an auxiliary or `to` in front of the verb. `tests/test_derive.py`
asserts that, word by word, and asserts that no sentence contains its partner.
This is the job `docs/07` gives the sentence in the KS2 script, and
`engine/sentences.py` already flagged `practice`/`practise` as a case to get
right.

**The tag stays on screen while she types**, but only after the audio has
finished. Mayer's redundancy effect is about a spoken and a written channel
carrying the same words *at the same moment*; once the dictation has stopped
there is no second channel, and she needs the tag in front of her or the item
is unanswerable again. In the no-audio cloze mode it appears immediately, for
the same reason.

**The rule card teaches the rule.** The generic `homophone-trap` card says "a
real word sits next door and sounds the same", which for these is true and
useless. This is one of the few completely regular spelling rules in English,
so it is stated: *the noun has a c, the verb has an s — advice is a thing, like
ice; advise is something you do.* (`prophecy`/`prophesy` end `-cy`/`-sy`, which
is why the rule is worded about the consonant and not the last two letters.)

One thing to listen to on the device before she uses it: `prophecy` and
`prophesy` are **not** homophones in British English — the endings are *-see*
and *-sigh* — so the voice getting them right is the difference between a fair
item and an unfair one. Both are on `sentences.PRONUNCIATION_WATCHLIST`.

## How good is the derivation, actually

Measured against the 103 hand-curated words, which are the only ground truth
available. `tests/test_derive.py` pins these as floors.

| | |
|---|---|
| Precision | **78%** — of the patterns it claims, 78% match curation |
| Recall | **77%** — of the derivable curated patterns, it finds 77% |
| Words with at least one correct pattern | **84%** |

Per-pattern precision drove which rules survived. The first version scored 50%
precision because it claimed everything present rather than what was worth
teaching. Patterns are now ranked by specificity and capped at three, matching
what curation does.

**Three patterns were cut for being unreliable, and one of those is worth
naming.** `schwa` is the honest failure. A schwa trap is an *unstressed* vowel
whose letter cannot be recovered from its sound — the `a` in *separate*, the
`i` in *definite*. Stress is a property of the spoken word, so no rule over the
letters can tell *separate* (schwa is the whole lesson) from *communicate* (it
is not). A positional rule found 17 of the curated schwa words and claimed 51
more that curation rejects: **25% precision**. It would have fired on roughly
half the statutory list, sent her to the schwa rule card constantly, and made
pattern strength meaningless. `soft-c-g` (20%) and `ou-spelling` (20%) went the
same way. A pronunciation dictionary with stress marks would fix this properly;
CMUdict is American, which `docs/05` already rules out.

Curated statutory words still carry all three by hand. Only derivation refuses
to guess them.

## Where it lives

| File | What it does |
|---|---|
| `engine/derive.py` | patterns and traps from a bare spelling |
| `engine/weekly.py` | parsing, test dates, the session mix, the afterglow |
| `web/js/engine/derive.js` | mechanical port — lists are typed on the tablet |
| `web/js/engine/weekly.js` | ditto |
| `tests/test_derive.py` | scored against the curated words, floors pinned |
| `tests/test_weekly.py` | parsing, dates, mix, and what happens after Friday |
| `tests/test_weekly_parity.py` | both implementations agree, word for word and session for session |
| `tests/browser/run.mjs` | the real list end to end, including what the dictation says out loud |

`weekly.compose()` is a composer *over* `Scheduler`, not a change to it. The
scheduler is ported to JavaScript and held to a golden-file replay by two
parity tests; rewriting its selection would mean regenerating that file and
re-proving the port for a feature that does not need it.

## Still open

- **Nothing reads the list off a photo.** Retyping ten words takes a minute;
  OCR would take a dependency and a permission prompt. Worth revisiting if the
  minute turns out to be the thing that stops it being used.
- **The test result is not recorded.** The app knows what she practised, not
  what she scored on Friday. Marking the paper test in the app would make the
  weekly list a measurement as well as a target — and `prompt_mode =
  dictation_paper` already exists for exactly that shape of thing.
- **Only noun/verb ambiguity is solved; the rest is only flagged.**
  `derive.HOMOPHONES` names 54 words that sound like another word.
  Ten are the `-ce`/`-se` pairs and are now fully handled. The other 44 —
  `stationary`/`stationery`, `principal`/`principle`, `desert`/`dessert` — are
  none of them on the statutory list, so none has a curated sentence, and a
  word class cannot separate a pair that is two nouns anyway. Writing 44
  sentences would be the right fix; shipping 44 *unreviewed* sentences to a
  child would break `docs/05` decision 2, so the list-entry screen warns the
  adult instead and suggests a bracketed tag:

  > ⚠ stationery sounds like another word and the app has no sentence to tell
  > them apart — add the word class in brackets, like "stationery (noun)"

  That is honest rather than fixed. The proper fix is a reviewed sentence per
  homophone, and it is the next content job.
- **One list at a time.** Saving a new list replaces the old one; the words
  stay in the scheduler and keep their boxes, but the previous list's coverage
  view is gone. Fine for one child, wrong the moment two lists overlap.
