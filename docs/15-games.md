# The welcome page and the learning games

Written 28 September 2026. Peter asked for a welcome page that greets her by name and
encourages her to come more often, and for "a series of learning games ... to give
points to then unlock a daily quiz". He listed a syllable jigsaw, an etymology match
with swirly lines, hangman, Wheel of Fortune, Jeopardy, and a game with coloured bits
of words. Three of those asks cut across `docs/11`, so he was asked first, and chose:

- **The welcome page encourages her with what is ready today, not with her visit count.**
- **The daily quiz is the dictation, and it never locks. Points open a bonus round.**
- **Build the jigsaw, the root match, the pattern sort and a game-show board.**

## What was asked, and what was built

| Asked for | Built | Why the difference |
|---|---|---|
| A welcome page that calls her by name | **As asked** | The name is typed once in the grown-up view and stays on the iPad. It is never synced or exported and is not part of her learning record (`docs/06` standard 8) |
| Measure how often she visits | **Already measured**, in the grown-up view's calendar | `docs/11`: shown to an adult a visit count is information; shown to a child it is a streak |
| Encourage her to come more regularly | **"What's ready today"** | "3 words are ready for another go, and 7 are new." A word is ready because its spacing interval has come round, which is exactly when practising it helps. Spacing is the largest effect this app rests on (`docs/01`) |
| A syllable jigsaw | **A word-part jigsaw** | Syllables hide the decision these lists turn on. *ob-ser-vant* splits the *-ant*; *observ + ant* puts the choice on its own piece |
| Etymology matching with swirly lines | **As asked: root match** | Rests on less than it looks (below). Built as a meaning game and labelled as one |
| Hangman, Wheel of Fortune | **Not built** | Guessing a letter at a time practises guessing letters, not recalling spellings, and fills the screen with wrong letters. Judgement, not a finding |
| Jeopardy | **The bonus round** | Every square is a typed spelling, marked by the real classifier |
| Coloured bits of words making a pattern | **The pattern sort**, and one colour code in every game | See below |
| Points that unlock a daily quiz | **Points open the bonus round** | Locking the dictation behind games would mean a games-only day had no dictation at all, and dictation is the part with the strongest evidence behind it |

## The four games, and what each rests on

### Word jigsaw

The clue is the word's meaning; the pieces are its parts, prefix, root and ending,
cut the way the word is built. Where the list turns on a choice there is one decoy:
*ent* beside *observ* and *ant*, *vise* beside *ad* and *vice*. The jigsaw shape is a
real hint, as it is on a real jigsaw: a flat left edge starts a word, and a decoy is
cut to the shape of the piece it could replace, so the shape never gives the choice away.

Rests on **morphological instruction**, which benefits spelling, and more so for less
able readers (Bowers, Kirby and Deacon 2010, 22 studies;
[link](https://journals.sagepub.com/doi/10.3102/0034654309359353)). A wrong piece goes
straight back to the tray, so no misspelling is ever left on screen as something to
look at. That is `docs/01`'s rule, and the reason it rejects DysEggxia's
correct-the-error exercise.

### Root match

Tap a part, tap what it means, and a curly line joins them. *toler* means "bear, put
up with", from Latin *tolerare*. After a match the part shows the words it builds, and
the meaning shows where it came from.

**This rests on less than it looks.** `docs/01` puts etymology in Tier 4: a strong
theoretical case, almost no controlled evidence that it improves spelling
([EEF](https://educationendowmentfoundation.org.uk/news/eef-blog-getting-to-the-root-of-vocabulary-instruction)).
It is here for meaning and delight, which `docs/02` counts as a real source of fun,
and it is not claimed as spelling practice.

### Pattern sort

One card at a time, the word with its decision left as a gap: *observ _ nt*,
*co _ operate*, *a man _ eating shark*, and for the noun/verb week the whole sentence,
*She gave me some good advi _ e*. Two bins. A miss gets the curriculum's rule, not a
buzzer. At the end every card sits in its bin, so the pattern is the picture.

| Week | The sort | The rule, from the curriculum |
|---|---|---|
| 21 Sep | c or s | the noun takes c, the verb s |
| 28 Sep, 5 Oct | -ant or -ent | a related word ending *-ation* points to *-ant*; a soft *c* or a clear *e* sound points to *-ent*; some "just have to be learnt" |
| 12 Oct | hyphen or not | a hyphen joins a prefix ending in a vowel to a root starting with one; *return* needs none |
| 19 Oct | hyphen or space | *a man-eating shark* versus *a man eating chips* |

The two *-ant*/*-ent* weeks sort together, because a deck of only *-ant* words has
nothing to decide. The rules are quoted from the DfE's
[English Appendix 1](https://assets.publishing.service.gov.uk/government/uploads/system/uploads/attachment_data/file/239784/English_Appendix_1_-_Spelling.pdf)
(Years 5 and 6, pages 19 and 20) and, for *man-eating*,
[Appendix 2](https://assets.publishing.service.gov.uk/government/uploads/system/uploads/attachment_data/file/335190/English_Appendix_2_-_Vocabulary_grammar_and_punctuation.pdf)
(Year 6). *relevant* and *excellent* are marked "learn it", because the curriculum
says some words have no clue and those two do not. Rests on the morphology finding,
plus judgement.

### Bonus round

A game-show board: this week's list, last week's and the week before's, worth 5, 10
and 15. The clue is the meaning, the first letter and the length. She **types** the
word, the real classifier marks it, and a miss shows her attempt against the word with
the rule, exactly as the reveal does.

This is the one game that is retrieval practice, which `docs/01` supports for spelling
in this age group ([Memory 2023](https://www.tandfonline.com/doi/abs/10.1080/09658211.2023.2248420)).
Older weeks are on the board on purpose: a round is spaced retrieval of the term so far.

## Points

- **Earned only for an answer right at the first go.** That is performance-contingent,
  the least harmful of the expected-reward classes in Deci, Koestner and Ryan
  (d = -0.28, against -0.40 for engagement-contingent; `docs/02`). Nothing is given
  for turning up, finishing, or time spent.
- **Every 50 opens one bonus round.** A jigsaw word is 10, a match or a sort card 5,
  a bonus square 5, 10 or 15. The number 50, about one game's worth, is a guess.
- **Bonus-round points count too.** A good bonus round can earn the next one. The
  loop points at typed recall, the most useful practice after dictation. Judgement.
- **Points never go down.** A wrong answer earns nothing and costs nothing.
- **They live on the games screens only.** The browser suite sweeps every practice
  screen for points language, and does it again after she has earned some.

`docs/11` recorded "no points" on 10 September, and this is a deliberate change to it,
made by Peter. See the note added there.

## Rules every game keeps

- **No misspelling stays on screen.** A wrong jigsaw piece goes back; a sort card
  shows a gap, never a wrong letter.
- **A miss is information.** It gets the rule and the "not yet" sound, never a buzzer
  (Shute 2008).
- **One colour per word part, everywhere:** prefix teal, root coral, ending plum,
  hyphen mustard, a whole joined word sage.
- **Nothing touches the scheduler or the attempt log.** The games are extra practice.
  The fixed sequence stays the default, which is `CLAUDE.md`'s rule.
- **The games follow the term's calendar,** because their content is written per week.

## The content, and who has checked it

`engine/games.py` holds all of it and `tests/test_games.py` holds it to its own rules:
every piece joins back into its word, no meaning contains its word or a long piece of
it, no two words share a meaning (a game-show clue would have two right answers), and
every sort card completes to exactly its full text.

It also gives the 52 term words that have no curated entry a written-up one: parts,
origin, one line of why, a word family. That lets the reveal show "How it is built" for
this week's words instead of hiding the card. Origins follow the standard dictionary
etymologies. Thirteen were checked against a source (etymonline.com, and the Folger
text of *Othello* for *green-eyed*); twelve matched, and the thirteenth, the date for
*pig-headed*, was wrong and is corrected. The rest have not been checked one by one.

**None of it has been reviewed.** Nor have the 42 new sentences in
`engine/sentences.py`. `docs/05` decision 2 says nothing unreviewed reaches a child, so
read `engine/games.py` and the sentences before deploying this. The sentences are
already held back from rendering until they are marked reviewed (`docs/14`).

## What is measured

Every round is logged on the device (`game_log`: game, week, each word, first go or
not, points). The grown-up view shows the last seven days of rounds beside the number
of dictation sessions, because the real risk is that games crowd out dictation. The
games are not in the attempt log, so they cannot contaminate `docs/04`'s analyses.

That makes a comparison possible, whether words she met in games did better on
Friday, but not a controlled one. `docs/04`'s design would randomise which words go
into games. Worth doing if the games prove popular.

## Still open

- **Nobody has played it on an iPad.** Tapping is tested in Chromium; dragging a
  piece is written for touch but has only been tried with a mouse.
- **The content and 42 sentences are unreviewed.** See above.
- **Novelty.** Gamified engagement is documented to decline after the first weeks
  ([link](https://onlinelibrary.wiley.com/doi/abs/10.1111/jcal.12385)). Judge the
  games at eight weeks, not at one.
- **After 23 October the games stay on the last week's list.** The next term's sheet
  goes in `engine/term.py`.
