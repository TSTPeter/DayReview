# Build log: what was built, what changed, and what to distrust

Written 9 September 2026. Read the last section before letting Beatrix use this.

## The four decisions this build rests on

| Question | Answer taken | Consequence |
|---|---|---|
| Scope | **Beatrix only** | `docs/06` stays background reading. No DPIA blocker, no accounts, no auth, no server. The moment a second child uses it, that changes and a DPIA becomes legally mandatory before launch |
| Stack | **Local-first, no server** | Vanilla JS, IndexedDB, service worker. `docs/05`'s Azure/Postgres design is untouched and still correct for later; `db/schema.sql` is the target and the IndexedDB rows already match it field for field |
| Audio | **Browser speech synthesis** | Free, offline, no Azure key. Voice type is not a significant moderator of TTS effectiveness (Wood et al.), so the quality argument for paid audio is weak. The *correctness* argument stands: see the pronunciation watchlist below |
| Ladder | **Off** | `docs/08` M5. The fixed sequence is the product; adaptivity is the hypothesis M7 tests |

## What was already here, and what it is worth

`engine/` arrived working. The headline claim was **103 words, 21 patterns, 99.7% of 293
curated misspellings classified**. That was verified rather than taken on trust, and it
held: 292 of 293 landed in a named error category.

The missing 0.3% was not a classifier miss. It was a data bug: `individual` listed
itself as one of its own curated misspellings, which quietly inflated the `correct`
bucket. Fixed, so the figure is now **293/293**. `tests/test_words.py` has a regression
test for it, because it is the kind of typo that reappears.

## Changes to the engine, each measured before it was kept

**1. The mark scheme was too kind.** `docs/07` says score exactly as the KS2 GPS Paper 2
mark scheme scores, and do not be generous, because being kinder than the test teaches a
false model of where she stands. `normalise()` strips everything outside `[a-z]`, so
`govern-ment`, `govern'ment` and `govern ment` all scored a mark. The real mark scheme
awards **zero** for a wrongly inserted apostrophe or hyphen and for letters split into
clearly divided components, while case is free and mixed case is accepted.

Added `mark_scheme_penalty()` and a `mark-scheme` diagnosis type. Deliberately kept out
of `normalise()`, which also feeds the diff aligner and must not care about punctuation.
A mark-scheme zero charges **no** pattern, because she knows the spelling and blaming a
spelling rule would corrupt the pattern-strength number.

**2. `si` was being read as /sh/ everywhere.** The contextual rule already handled `si`
before a vowel (*pension*), but `si` also sat in the blanket /sh/ grapheme list, so
`simbol` and `sincere` were keyed as if they began *shim-*, *shin-*. Removing it fixed
two false negatives in the phonological-plausibility count (95 → 97 of 293) and changed
**no** classification. Dropping `ci` and `ti` as well was tested and rejected: it cost
specificity, moving three cases out of `grapheme-choice` and `letter-swap` into the
vaguer `vowel-choice`.

**3. Vowel-only anagrams were called sequencing errors.** `saperate` and `relavent` are
anagrams of their targets, so the anagram rule claimed them as transpositions. For a
schwa word that is the wrong teaching: she heard an unstressed vowel and reached for the
wrong letter. They now fall to `vowel-choice`. Checked **after** the adjacent-swap rule,
so the classic `freind` for `friend` stays a transposition, which is what it is. Genuine
reorderings move consonants too, so `yatch`, `restaraunt` and `amature` are untouched.
`multiple-errors` stayed at 1, so nothing was pushed into the catch-all.

## What was added

| Piece | What it does |
|---|---|
| `engine/probe.py` | The 24-item baseline probe: 16 on-list, two from each of the eight commonest pattern groups, plus **8 off-list transfer words** that did not exist before. Deterministic per run number, so the half-termly re-run differs but is reproducible |
| `engine/profile.py` | Phonological reliance, orthographic choice rate, error mix, pattern strength, transfer, confidence, and `narrate()` for the grown-up view |
| `engine/ladder.py` | The `docs/03` escalation ladder, **default off** |
| `engine/sentences.py` | 111 context sentences and a 16-word pronunciation watchlist |
| `engine/export.py` | Emits `web/data/*.json` for the front end |
| `tests/` | 92 Python tests, a golden-file scheduler replay, and two cross-language parity suites |
| `web/` | The six screens from `docs/02`, offline-capable |
| `tests/browser/run.mjs` | Drives the real app in Chromium and asserts the `docs/02` guarantees |

The off-list words are `possession`, `separate`, `irregular`, `delicious`, `knowledge`,
`useful`, `beautiful`, `chemistry` — one per probe pattern. They are the transfer
measure, which `docs/04` predicts will lag and which is the number that separates
"learned the rule" from "learned the word".

## The one architectural rule this build breaks

`docs/05` decision 1: *the front end never reimplements the engine, because two
implementations drift and the dataset becomes uninterpretable.*

Running with no server means the classifier must execute in the browser. There is no way
round it short of shipping Pyodide. So `web/js/engine/classify.js` and `schedule.js` are
**mechanical ports**, and the price is paid in tests:

- `tests/test_parity.py` runs both implementations over every curated misspelling, every
  correct spelling, the mark-scheme edge cases and **2,275 generated mutations** —
  roughly 2,800 cases — and fails on the first disagreement.
- `tests/test_schedule_parity.py` replays the Python golden-file session through the
  browser scheduler and demands an identical queue.

Both pass. If either goes red, browser-collected data cannot be pooled with anything
scored in Python, so treat it as a build blocker, not a warning. `difflib.SequenceMatcher`
is ported faithfully including its tie-breaking; only the autojunk path is omitted, which
needs sequences of 200+ elements and the longest word here is 13 characters.

## Bugs found by running the thing rather than reasoning about it

- `el()` used `Object.assign` on `dataset`, a read-only accessor. ES modules are strict,
  so it threw and the entire paper-entry screen never rendered. Silent.
- A single Backspace counted as **two** edits, once from the keydown and once from the
  shortened value, which would have made every typed attempt look twice as hesitant as
  it was. `edits_before_submit` is a confidence proxy in `docs/04`, so this mattered.
- Speech synthesis could hang forever. Some engines fire neither `onend` nor `onerror`.
  The prompt is the whole screen, so a hang is a child staring at a dead box. There is
  now a 15-second timeout, and the utterance always resolves.
- A device with **no installed voice** got silence and no explanation, which makes an
  audio-only prompt unusable. It now degrades to a cloze: the sentence with the word
  blanked. Still free-typed retrieval, still never shows the spelling, and it records
  `prompt_mode = text_cloze` so the two are never pooled in analysis.

## What to distrust

**Read the 111 sentences in `engine/sentences.py` before she does.** They were written
for this build and have had no second pair of eyes. `docs/05` decision 2 says nothing
unreviewed is shown to a child; this is the outstanding item. Check two things: that no
sentence gives the spelling away or leans on a homophone, and that each one disambiguates
its word, which is the job the KS2 script gives it.

**Listen to the pronunciation watchlist on the actual device.** 16 words are flagged in
`engine/sentences.py` with a respelling. None have been heard, because this was built in
a container with no audio. A wrong model of the word teaches the wrong spelling, so this
is a correctness task, not polish.

**`equip` is missing from the word list.** English Appendix 1 reads `equip (–ped, –ment)`,
so the statutory forms are *equip*, *equipped* and *equipment*. `words.py` carries the
last two. `CLAUDE.md` explains the count as treating `equip(ped)` as a pair, so the base
form fell through the gap. Fixing it makes the list 104 and changes a number published
across the docs, so it was left alone. The sentence for it is already written.

**`orthographic_choice_rate` is our definition, not the study's.** The Northern Ireland
cohort judged each correct spelling by expert inspection. We approximate it structurally:
a word demanded orthographic choice if it carries a pattern where several graphemes spell
one sound. That currently catches 64 of 103 words. **Do not compare our number with their
14%.** The trend across probes is the part worth reading. The definition is one editable
constant, `ORTHOGRAPHIC_CHOICE_PATTERNS`, so argue with it.

**Cold-start order is alphabetical.** On day one every word is in box 1 with no errors,
so the tie-break falls through to the word itself and she meets *accommodate*, one of the
hardest words on the list, first. Interleaving still breaks up pattern runs. Worth
changing, but it is a product decision about what a first session should feel like.

**Latency and edit count are recorded and not acted on.** `docs/04` proposes them as
confidence proxies and `docs/09` lists them as plausible but untested. A correct-but-slow
answer still promotes a box. Deliberate: acting on an untested proxy would bake it in.

**The delayed test is measured, not scheduled.** The grown-up view computes accuracy at
7 and 28 days from attempt history, so `docs/06` M6's dashboard number exists. What does
not exist is automatic scheduling of the delayed test sessions themselves. Half of M6.

**No experiment is running.** Every attempt row carries `arm: null` and
`method_shown: null`. `docs/04` requires a pre-registration committed to `experiments/`
before a single row is collected for a comparison, and none has been written.
