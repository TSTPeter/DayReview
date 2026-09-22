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
- **One list at a time.** Saving a new list replaces the old one; the words
  stay in the scheduler and keep their boxes, but the previous list's coverage
  view is gone. Fine for one child, wrong the moment two lists overlap.
