# The welcome page and the learning games

Written 28 September 2026. Peter asked for a welcome page that greets her by name and
encourages her to come more often, and for "a series of learning games ... to give
points to then unlock a daily quiz". He listed a syllable jigsaw, an etymology match
with swirly lines, hangman, Wheel of Fortune, Jeopardy, and a game with coloured bits
of words. Three of those asks cut across `docs/11`, so he was asked first, and chose:

- **The welcome page encourages her with what is ready today, not with her visit count.**
- **The daily quiz is the dictation, and it never locks. Points open a bonus round.**
- **Build the jigsaw, the root match, the pattern sort and a game-show board.**

On 30 September he asked for two more, hangman and a block of hidden words. See the
section of that date below.

## What was asked, and what was built

| Asked for | Built | Why the difference |
|---|---|---|
| A welcome page that calls her by name | **As asked** | The name is typed once in the grown-up view and stays on the iPad. It is never synced or exported and is not part of her learning record (`docs/06` standard 8) |
| Measure how often she visits | **Already measured**, in the grown-up view's calendar | `docs/11`: shown to an adult a visit count is information; shown to a child it is a streak |
| Encourage her to come more regularly | **"What's ready today"** | "3 words are ready for another go, and 7 are new." A word is ready because its spacing interval has come round, which is exactly when practising it helps. Spacing is the largest effect this app rests on (`docs/01`) |
| A syllable jigsaw | **A word-part jigsaw** | Syllables hide the decision these lists turn on. *ob-ser-vant* splits the *-ant*; *observ + ant* puts the choice on its own piece |
| Etymology matching with swirly lines | **As asked: root match** | Rests on less than it looks (below). Built as a meaning game and labelled as one |
| Hangman, Wheel of Fortune | **Not built** on 28 September. Hangman **built on 30 September**, when Peter asked for it again | Guessing a letter at a time practises guessing letters, not recalling spellings. That was judgement, not a finding, so his second ask wins, and the design below meets the objection part way |
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
  a bonus square 5, 10 or 15, a hangman or hidden word 10. The number 50, about one
  game's worth, is a guess.
- **Hangman and hidden words pay for the word, not the first go.** Misses are part of
  hangman and searching is the whole of hidden words, so a word solved or found earns
  10, and a hint halves it to 5. Still performance-contingent.
- **Bonus-round points count too.** A good bonus round can earn the next one. The
  loop points at typed recall, the most useful practice after dictation. Judgement.
- **Points never go down.** A wrong answer earns nothing and costs nothing.
- **They live on the games screens only.** The browser suite sweeps every practice
  screen for points language, and does it again after she has earned some.

`docs/11` recorded "no points" on 10 September, and this is a deliberate change to it,
made by Peter. See the note added there.

## Rules every game keeps

- **No misspelling stays on screen.** A wrong jigsaw piece goes back; a sort card
  shows a gap, never a wrong letter; a wrong hangman letter is only a crossed-out key,
  and a typed guess is cleared at once; a hidden-words block is made of nothing but
  correct spellings.
- **A miss is information.** It gets the rule and the "not yet" sound, never a buzzer
  (Shute 2008).
- **One colour per word part, everywhere:** prefix teal, root coral, ending plum,
  hyphen mustard, a whole joined word sage. A found hidden word takes them letter by
  letter, and a trace in progress is ink, which no part uses.
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

**The game content has not been reviewed.** `docs/05` decision 2 says nothing
unreviewed reaches a child, so read `engine/games.py` before deploying this. The 42 new
sentences that go with it were reviewed by Peter on 28 September.

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
- **The game content is unreviewed.** See above. The sentences are reviewed.
- **Novelty.** Gamified engagement is documented to decline after the first weeks
  ([link](https://onlinelibrary.wiley.com/doi/abs/10.1111/jcal.12385)). Judge the
  games at eight weeks, not at one.
- **After 23 October the games stay on the last week's list.** The next term's sheet
  goes in `engine/term.py`.
- **Is a bending-path block too hard at ten?** Nobody knows yet. Watch how often she
  needs a hint. Easier blocks, four words or smaller shapes, are a small change in
  `engine/wordblocks.py`.
- **Sliding through the letters** is written for touch and tested with a mouse.

## 30 September 2026: hangman and hidden words

Peter asked for "a hangman game using spelling words of the week", and for "four or
five words ... hidden inside of a block", found by highlighting "the letters one after
another", without being told what the words are. Both should have a hint that gives "a
starting place for one of the letters". Asked, he chose:

- **Bending paths** for the block, over straight lines.
- **A flower that loses its petals** for hangman, over the gallows.
- **A hint halves the word's points**, over hints being free or earning nothing.

### Hangman

Five of this week's words, one at a time. A paper flower has eight petals and each
wrong letter drops one, so eight misses lose the word. The keys are the alphabet and a
hyphen, and the hyphen key is there every week, including weeks with no hyphenated
words, so its presence never gives a hyphen away. In the weeks of 12 and 19 October the
hyphen is the decision the whole list is about, and here she has to make it.

The objection on 28 September was that guessing a letter at a time practises guessing
letters, not recalling spellings. That was judgement, not a finding, and the design
meets it part way:

- **She can type the whole word at any point**, and typing it is the way to finish
  early. That is free recall, the practice `docs/01` supports. A wrong typed guess
  costs a petal and is cleared at once, so her misspelling never stays on screen.
- **A wrong letter is only a crossed-out key.** The word only ever shows right letters.
- **Every word ends shown in its parts, with the line that explains it,** solved or
  not. A lost word is information, not a buzzer (Shute 2008).
- **The hint is the first hidden letter, never the hyphen,** and there is one a word.

What hangman still is: mostly guessing letters. It is here because she will enjoy it,
and the typed answer is the only part of it with evidence behind it.

### Hidden words

A block of letters, five to eight a side, holds four or five of this week's words. Each
word bends through touching letters, across, down or diagonally, and every letter in
the block belongs to one of them, so nothing on screen is anything but a correct
spelling. She taps the letters one after another, or slides a finger through them;
tapping the last letter again takes it back. A found word takes the colours of its
parts, letter by letter, so a finished block shows the week's pattern: every *-ance*
in plum.

The blocks are built offline by `engine/wordblocks.py`, and `tests/test_wordblocks.py`
checks every one that ships:

- the words fill the block exactly, and the generator's own paths never cross on a
  diagonal;
- no hidden word is the start of another, or the game would find the short one first;
- no other word on the week's list can be traced anywhere in it, so she can never
  spell a list word correctly and be told it is not there;
- no word on a screening list reads in a straight line, in any of the eight
  directions. Bending paths are not screened. The question put to Peter said "nothing
  rude can turn up by chance", which was too strong on its own; this screen is what
  makes it nearly true.

Six blocks a week cover all fifteen words, and she gets them in order.

**A word can often be traced more than one way.** Some routes spell a hidden word
correctly but would leave the other words unable to fit. Most blocks have a few; the
weeks of near-twins (*advice, advise, device, devise*; *decent, decency*) have up to 18
in a block. Turning such a route away would tell a
child who spelled the word right that she was wrong, so any correct route counts: the
word is accepted, and its colours move to the nearest route that fits, with "In this
block it fits here." The export carries every route and every way the routes fill the
block, so on the tablet this is a lookup, not a search. Whether the move puzzles her is
not known; the alternative is to turn the route away with a reason.

Rests on judgement. Tracing a word in order, letter by letter, is spelling it out; this
build found no controlled evidence either way on word searches and spelling.

### Hints

Both give what Peter asked for, a starting place. In hangman the first letter still
hidden fills in. In hidden words the first letter of a word she has not found is
ringed, and asking again rings the next letter, which shows the way it goes, but never
the whole word.

A hint halves the word's points, 10 to 5. Learners often do not use on-demand help
well, although using it well goes with learning more (Aleven, Stahl, Schworm, Fischer
and Wallace 2003,
[link](https://journals.sagepub.com/doi/10.3102/00346543073003277)). Half is a guess at
a middle way: cheap enough that she asks rather than stays stuck, dear enough that she
tries first. Judgement.

### Points and what is logged

| Game | A word | With a hint |
|---|---|---|
| Hangman | 10 if solved, nothing if the petals run out | 5 |
| Hidden words | 10 | 5 |

A perfect round of either is 50, one bonus round, the same as a perfect jigsaw round.
Both log every round to `game_log`: for hangman each word, whether it was solved, the
hint, the misses and whether it was typed; for hidden words each word and whether it
was hinted. The grown-up view counts both beside the dictation sessions.

## 1 October 2026: the pattern sort, quick when right, slow when not

Peter: the sort works because it is quick, so keep it quick, but build stronger links
to the conventions. What changed, and what each part rests on:

| Change | What it rests on |
|---|---|
| **No note on a right answer.** The gap fills, a sound plays, and the next card comes in two thirds of a second | Judgement. The note was teaching what she had just shown she knew |
| **A miss gets a moment to reflect.** The bins rest for three and a half seconds while she reads the rule and the word's support. Nothing counts down | Elaborated feedback after an error (Shute 2008); the pause makes sure she reads it. The length is a guess |
| **The support after a miss** is the word's arm in the experiment: where it comes from, a real sentence that uses it, saying it aloud, or all three. Before the experiment starts, it is where it comes from plus saying it aloud | `experiments/2026-10-support-types.md` |
| **Say it aloud.** If the support includes it and an adult has switched the microphone on, the game listens for her voice and ends the pause when it hears her | The production effect: words said aloud are remembered better than words read silently, but only when some are said and others are not ([MacLeod et al. 2010](https://pubmed.ncbi.nlm.nih.gov/20438265/)). Saying a word as it is spelt helps children spell it ([Hilte and Reitsma 2006](https://www.researchgate.net/publication/5991727_Spelling_pronunciation_and_visual_preview_both_facilitate_learning_to_spell_irregular_words)). Both are recognition and spelling studies, not studies of this game |
| **Run sounds** for right answers in a row at the first go, at 3, 5, 7 and 9, and polyphony from 11 | Performance-contingent reward (d = -0.28), the least harmful expected class. Peter's call; see `docs/11` |
| **A background that grows** white on white with the run, and steps back two levels on a miss | Judgement, kept subtle because of `docs/02`'s coherence finding. See `docs/11` |

**Beatrix's three-in-a-row sound did not exist.** The special sound she noticed was
the unlock sting, three rising notes, which plays when her points pass a multiple of
50 and a bonus round opens. A first-go card is worth 5, so it can land after any run.
The run sounds are new.

**The microphone never records.** `web/js/voice.js` computes how loud the room is,
on the tablet, and nothing else. Browser speech recognition was rejected because it
can send audio away to be transcribed (`docs/06`, `docs/16`).

**The other games get the support too.** A wrong jigsaw check (once per word), a
hangman word that runs out of petals, and a wrong bonus answer all show the word's
support. Hidden words and root match have no wrong answer on a word to attach it to.
