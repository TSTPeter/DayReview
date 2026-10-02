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
- **The first real list from school broke the parser and exposed an unanswerable
  item.** Headings ending in a colon were parsed as spellings, so a list of 15 words
  became 20 and Beatrix would have been asked to spell *pairs*. Worse, ten of the
  fifteen were `-ce`/`-se` noun-verb pairs: the dictation said "The word is licence"
  twice, with no sentence, which cannot be answered except by guessing. An impossible
  item is worse than a missing one, because it records as a miss. Both fixed; see
  `docs/12`. Found by pasting the actual list in, not by reading the code.

## What to distrust

**Read the 122 sentences in `engine/sentences.py` before she does.** They were written
for this build and have had no second pair of eyes. `docs/05` decision 2 says nothing
unreviewed is shown to a child; this is the outstanding item. Check two things: that no
sentence gives the spelling away or leans on a homophone, and that each one disambiguates
its word, which is the job the KS2 script gives it.

**Listen to the pronunciation watchlist on the actual device.** 18 words are flagged in
`engine/sentences.py` with a respelling. None have been heard, because this was built in
a container with no audio. A wrong model of the word teaches the wrong spelling, so this
is a correctness task, not polish.

**The dictation voice has not been listened to.** Every curated line is now rendered
once in one ElevenLabs voice (`docs/14`), which is what finally makes "listen to every
word by hand" a finishable job. It has not been done, and until `tools/render_audio.py`
is run nothing is rendered at all: the app uses the device voice exactly as before.
Start with `prophecy` and `prophesy`.

**44 homophones on a school list are still undictatable.** `derive.HOMOPHONES` names
54 words that sound like another word. The ten `-ce`/`-se` pairs now carry a word class
and a sentence. The other 44 — *stationary*/*stationery*, *principal*/*principle* — have
neither, and a word class cannot separate a pair that is two nouns. The list-entry screen
warns the adult rather than failing quietly at dictation, which is honest, not fixed. The
real fix is a reviewed sentence per homophone.

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

## 28 September 2026: the term, the welcome page and the games

Built: the autumn term's six lists, loading by date (`docs/12`); hyphenated words end to
end; a welcome page that greets her by name and says what is ready today; four learning
games with points and a bonus round (`docs/15`). Two existing faults were found on the
way and fixed: practice crashed once an earlier list's word came due, and the transfer
measure counted school words as untaught.

What to distrust, in the order to deal with it:

- **Read `engine/games.py` before she sees it.** It was written in this build and has not
  been reviewed. Thirteen origins were checked against a source and one was wrong
  (corrected); the rest were not checked one by one. It ships as soon as this is deployed.
  The 42 new sentences were reviewed by Peter on 28 September and wait to be rendered.
- **Hear `co-own` first.** Nine words were added to the pronunciation watchlist, and read
  as one word *co-own* comes out as a different and unkind word.
- **Nobody has played the games on an iPad.** Tapping is tested in Chromium at both iPad
  sizes; dragging is written for touch but has only been tried with a mouse.
- **The points economy is guessed.** 50 points to a bonus round, 5 to 15 an answer.
  Watch the grown-up view's count of game rounds against dictation sessions: if games
  crowd out dictation, `docs/11` predicted it, and the games should give way.
- **After 23 October the term's last list stays live.** The next sheet goes in
  `engine/term.py`.

## 30 September 2026: hangman and hidden words

Built: two more games, hangman with a paper flower that loses a petal for each wrong
letter, and a block of hidden words traced letter by letter (`docs/15`, section of this
date). Both have a hint, and a hint halves the word's points. The blocks come from a
new generator, `engine/wordblocks.py`, and ship in `web/data/games.json`: 36 blocks,
about 29 KB. The export now writes lists of numbers on one line, which kept the file
from doubling.

What to distrust:

- **Nobody has played either on an iPad.** Tapping and the keyboard are tested in
  Chromium at both iPad sizes; sliding a finger through the letters has only been
  tried with a mouse.
- **The blocks may be too hard.** Bending paths were Peter's choice over straight
  lines, and whether a ten-year-old finishes them without hints is unknown. The grown-up
  view's game log records which words were hinted.
- **A route that would strand the other words is accepted and moved.** That keeps a
  right spelling from ever being marked wrong, but the colours landing on letters she
  did not touch may puzzle her. Most blocks have a few such routes; the near-twin weeks
  of 21 September and 5 October have up to 18 in a block.
- **The rude-word screen is a list, and only straight lines are screened.**
- **Hangman is still mostly letter guessing.** The typed answer is the part with
  evidence behind it.

## 1 October 2026: a quicker pattern sort, an experiment, Firebase and sharing

Built:

- **The pattern sort.** No note on a right answer; a pause to reflect after a miss,
  with the rule and the word's support; say it aloud, with an on-device voice-level
  detector; run sounds at 3, 5, 7, 9 and polyphony from 11; a white-on-white background
  that grows with a run (`docs/15`, `docs/11`).
- **An experiment, pre-registered** (`experiments/2026-10-support-types.md`): which
  support helps after a miss. Its content is `engine/supports.py`: 133 quotations from
  39 British public-domain books, each checked word for word against its Project
  Gutenberg text, and 22 written uses. It does not start until Peter has read them.
- **Firebase**, for her tablet only: the config is pasted on the tablet, sign-in is
  anonymous, and rules enforce the allowlist on the server (`docs/13`).
- **Share the game**: a QR code of the address, nothing more. The DPIA draft is
  `docs/16-dpia.md`, and `web/privacy.html` is a notice for families.
- **`db/schema.sql`** now names arms rather than lettering them A and B, and records
  `support_shown`, because the first registered experiment has four arms.

Fixed on the way:

- **Pasting the Firebase console's snippet failed.** It opens with
  `import { initializeApp } from "firebase/app";`, and the parser took the first
  brace it saw. It now takes the object around `apiKey`; the test pastes the
  console's whole snippet.
- **Leaving the sort during a pause and coming straight back left the bins locked**,
  and a timer from the old round could move the new one on. Each card now carries a
  token that stale timers check. A browser check reproduces both, and fails without
  the fix.

What to distrust:

- **The quotations are unreviewed.** They were filtered, chosen one by one and verified
  word for word, but nobody but Claude has read them yet. The experiment waits on that.
- **The voice detector has never heard a child.** Its thresholds come from typical
  microphone levels and were tested in Chromium with a synthetic tone, not on an iPad.
- **Check the sounds on her iPad with the microphone on.** iOS may move audio to a
  call-style route while the microphone is open, which could make the run sounds
  quieter. Unverified either way.
- **The pause length (3.5 seconds) and the background's subtlety are guesses.**
- **The experiment is small.** One child and about 39 words per arm. It can choose
  for her; it cannot prove anything.
- **Firebase is untested end to end.** The code, the rules and their generator are
  tested; a real project has not been connected, because that needs Peter's account.

## 1 October 2026, evening: live, but not on the phone

Peter could not see the pattern sort changes, and could not play hangman or hidden words
on his Android phone.

What was checked:

- **The live site:** all 361 files, byte for byte against the merge.
- **The live files played on two emulated Android phones** (Pixel 7, 412 px wide; Galaxy
  S8, 360 px), by touch: hangman letters, hidden words by taps and by a finger slide, and
  the sort's new behaviour. All of it worked, with no errors.
- **A returning phone**, using the three versions in ProductionSite's history. A phone that
  last opened the game on 28 September showed the 28 September version on its first open
  after the deploys (no hangman, no hidden words) and the new one only on the open after
  that. A tab left open never updated at all.

The cause: the service worker serves the saved version first, and nothing reloaded the
page once the new one had arrived (`docs/13`, "How an update reaches a device").

Fixed:

- The page reloads into a new version on the welcome page, and checks for one whenever
  it comes back to the screen.
- The grown-up view says which version the device has.
- The pattern sort's background was painting its dots over the title bar.

New tests:

- `tests/browser/update.mjs` fails without the fix: the phone stays on the first version
  through three deploys.
- `tests/browser/phone.mjs` plays the games by touch at phone sizes. Every earlier browser
  check used a mouse at iPad sizes.
- `tests/test_deploy.py` checks the version file against the service worker's stamp.

What to distrust:

- **Emulation is not a phone.** The touch path is Chromium's own, but Peter's phone, browser
  and settings are unknown. If hangman or hidden words still cannot be played once his
  phone shows this version, there is a real bug I have not reproduced.
- **The first update after this change still needs the old way**: open, wait, close fully,
  open again.
- **Hidden-word letters are 36 px across on a 360 px phone**, below the 44 px the iPad
  checks require. They worked by tap and by slide in emulation, but may feel tight to a
  child on a small phone.
