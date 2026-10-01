# Pre-registration: which support helps after a miss

Registered 1 October 2026, before a single row is collected, as `docs/04` requires.
Do not edit this after the start date. Add dated amendments at the bottom instead.

## The question

For this learner, after she gets a word wrong, which of these leads to more correct
spellings of that word at her next dictation of it, a day or more later:

- where the word comes from (**etymology**),
- the word in use in a real book (**story**),
- saying it aloud the way it is spelt (**say**),
- or all three together (**blend**)?

## The arms

Every arm keeps the baseline, which is a non-negotiable in `CLAUDE.md`: her attempt
marked against the word, the error named, the rule, and how the word is built (its
parts and its one line of why). Each arm adds one thing.

| Arm | What it adds after a miss |
|---|---|
| `etymology` | The language, root and meaning it comes from, and two or three words of the same family |
| `story` | A real sentence from a classic book that uses the word, with the author, book and year. Where no good one was found, a short use written for her, labelled as written |
| `say` | "Say it the way it is spelt": the word in its parts, the tricky part in capitals. In the pattern game the microphone listens for her voice, if an adult has switched it on |
| `blend` | All three, kept short |

There is no rule-only control. Every arm keeps the rule, so the question is which
addition helps most, not whether any addition helps at all.

## The words

The 103 statutory words in `engine/words.py` and the 52 school words written up in
`engine/games.py`: 155 in all. Excluded:

- the 8 off-list words, which measure transfer and must stay untaught;
- any word typed into a custom list, which has no content to show.

## Assignment

- One arm per word, for the whole experiment.
- Balanced random assignment within each pattern group. Words are grouped by their
  first pattern, shuffled with a seed the device makes the first time it needs one,
  and dealt round the four arms in a shuffled order. Each group splits as evenly as
  its size allows.
- The seed and every assignment are kept on the device and included in the export.
- Assignment never looks at her answers.

## Exposure

A support is shown only after a miss:

- on the dictation answer screen;
- for a wrong pattern-sort card;
- for a wrong jigsaw check;
- for a hangman word that runs out of petals;
- for a wrong bonus-round answer.

Every showing is logged: the word, its arm, where, when, and, when the microphone is
on, whether she was heard saying it.

## Outcome

**Primary.** For each word that has had at least one support shown, the first typed
dictation attempt at that word made at least 20 hours after the first showing,
marked correct or not by the classifier.

**Secondary.**

- The same on paper (`dictation_paper`), whenever a paper session happens. Typing
  inflates exactly the errors these words are about (`docs/04`).
- The first attempt made 7 or more days after the first showing.

The scheduler sets the practice spacing, and the arm has no effect on it.

## Analysis

For each arm: *n*, the words with a primary outcome, and *k*, how many of them were right.

- A Beta(1 + *k*, 1 + *n* − *k*) posterior for each arm, and the probability that each
  arm is best, by simulation.
- Shown in the grown-up view, which says "too few to tell" until every arm has at
  least 10 outcomes.
- At the stop date, on the export, a logistic model with prior accuracy on the word
  and days since it was last seen as covariates.

**Power, honestly.** One child and about 39 words per arm, of which only the words she
misses enter. This chooses for her. It proves nothing for anyone else.

## Stop rule

The experiment runs from the deploy that marks the quotations reviewed to
**6 November 2026**, two weeks after the last list is tested, so that the last words
can reach an outcome.

The arms do not change before then, whatever the grown-up view shows along the way.

At the stop date:

- If one arm's probability of being best is above 0.9, it becomes her support after
  a miss. That switch is recorded as a new phase with its own dated entry here.
- Otherwise the blend stays, because it contains everything. The experiment can run
  again on the next term's words.

## Confounds, from `docs/04`'s table

| Confound | Why it does not decide the answer here |
|---|---|
| Regression to the mean | Every arm is shown only after a miss, so it applies to all four equally |
| Spacing | The scheduler treats every word alike; the arm does not touch it |
| Item difficulty | Balanced within pattern groups |
| Order and fatigue | Supports do not change the order of anything |
| Novelty | Compare the first half of the period with the second |
| Input medium | The primary outcome is typed, and paper is the secondary |

## Content review

The quotations and written uses are drafted by Claude and checked by Peter before
the experiment starts (`docs/05` decision 2). Until then the app behaves as it did
before: no arms are assigned and nothing is logged as an exposure.

## Amendments

None yet.
