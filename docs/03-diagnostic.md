# Diagnostic: what spelling system is this child actually using?

Yes, this can be done, and it is the strongest idea in the brief. It is also the part with
the clearest published method behind it.

## Two layers, weighted very differently

**Layer 1, error profiling. Objective, trustworthy, do this properly.**

Take a dictation probe, classify every error, and build a profile. This is exactly the method
used on 267 children with literacy difficulties in
[Frontiers in Education 2025](https://www.frontiersin.org/journals/education/articles/10.3389/feduc.2025.1641126/full),
which produced the two numbers worth reproducing per child:

- **Phonological reliance index**: share of errors that read aloud correctly. Their cohort
  ran at ~84%. Our classifier computes this directly via `sounds_right`.
- **Orthographic choice rate**: share of *correct* spellings that required choosing between
  several legal spellings of one sound. Their cohort ran under 14%.

A child with high phonological reliance and low orthographic choice is not failing at
phonics. They have finished phonics and stalled before orthography. That is a different
teaching problem, and it is the one this app is for.

**Layer 2, strategy self-report. Weak signal. Use it, do not lean on it.**

Children can report spelling strategies, and the construct is studied, but ten-year-olds are
noisy reporters and the act of asking adds load.
[Self-reported spelling strategies, children with and without difficulties](https://ejournals.epublishing.ekt.gr/index.php/psychology/article/view/30831) ·
[Individual differences in reading and spelling strategies](https://www.sciencedirect.com/science/article/abs/pii/S1041608013001295)

Rules: ask after at most one item in five, never after a failure, four options, one tap.

> How did you work that out?
> I sounded it out · It looked right · I thought about the parts · I just knew it

Those map to phonological, visual, morphological, and retrieval. Store it, cross it against
the error data, and trust the error data when they disagree.

## The baseline probe

24 words, dictated in sentences, no feedback, roughly 8 minutes. Framed as a challenge, not
a test, and explicitly one-off: "this tells the app what to teach you".

**Run it on paper, not on the keyboard.** In Broc et al.'s replication, typing inflated
orthographic errors sixfold against handwriting on the same task, 0.06 errors per word against
0.01, while phonological errors barely moved. Orthographic choice is precisely what this probe
measures, so a typed probe would overstate the weakness it exists to detect. The app dictates,
the child writes, the adult photographs or types the attempts back in. See
`docs/01-evidence.md` for the numbers and the caveats.

| Slice | Count | Purpose |
|---|---|---|
| Statutory list, spanning the pattern space | 16 | Where she is on the actual target |
| Off-list words using the same patterns | 8 | Whether the pattern generalises, which the interleaving study warns it may not |

Select the 16 by taking the highest-frequency pattern groups from `engine/words.py` and
sampling across them, so no pattern is represented by only one word. One word is an anecdote.

Re-run every half term with a different sample. Store every run: the change over time is the
progress measure that matters, not session scores.

## Output: the profile

```json
{
  "phonological_reliance": 0.78,
  "orthographic_choice_rate": 0.19,
  "error_mix": {"doubling": 0.31, "vowel-choice": 0.24, "grapheme-choice": 0.18, ...},
  "pattern_strength": {"doubling-1-1-1": 0.2, "suffix-ance-ence": 0.6, ...},
  "strategy_self_report": {"sounded-out": 0.5, "looked-right": 0.3, ...},
  "confidence": "low | medium | high"
}
```

`confidence` is a function of items attempted. Below 24 items it is "low" and the app should
say so rather than presenting a profile as fact.

## The method-switching rule, done defensibly

The brief was: find spellings a child is not retaining through one method, and try another.

**Switching by learner type is not supported.** The meshing hypothesis, that instruction
should match a visual, auditory or kinaesthetic preference, fails on the evidence: Pashler
and colleagues found almost no studies with an adequate crossover design, and those that did
found results contradicting it.
[Pashler et al. 2008](https://journals.sagepub.com/doi/10.1111/j.1539-6053.2009.01038.x)

**Switching by error type is supported**, because the underlying components have different
effect sizes for different outcomes: whole-word study g = 0.56 for spelling, phonemic
approaches g = 0.45 for transfer to word reading.
[Chandler et al. 2025](https://journals.sagepub.com/doi/10.1177/00222194251364836)

So the rule is: **the diagnosis picks the method, not the child.** The same child gets a
morphological treatment for a suffix error and a whole-word treatment for a French loanword,
in the same session.

## The escalation ladder

Each error type has an ordered ladder. A word that fails twice at one rung moves up.
Movement is triggered by the error, and logged, so `docs/04-experiment.md` can test whether
the ladder order is right.

| Error type | Rung 1 | Rung 2 | Rung 3 |
|---|---|---|---|
| doubling | State the rule, one worked example | Build the word from morphemes, choose to double or not | Contrast pair drill: equip/equipped/equipment |
| suffix-choice | Show the Latin root that sets the ending | Sort six words into -ance and -ence | Generate the noun from the verb, three times |
| grapheme-choice | Name the origin marker: Greek ph, ch, y | Choose the right grapheme from three legal options | Spot the Greek word among five |
| vowel-choice, schwa | Say it in exaggerated syllables | Type it syllable by syllable | Link to a stressed relative: *definite* from *finish* |
| silent-letter | Show the relative where the letter is heard: sign, signature | Trace the word's history in one line | Whole-word study: look, cover, write, check |
| transposition | Slow the input, one grapheme at a time | Chunk into morphemes | Whole-word study |
| omission, addition | Syllable count first, then spell | Type with syllable separators shown | Whole-word study |

Rung 3 is deliberately whole-word study for the hard cases. It has the largest single effect
size for spelling outcomes in the meta-analysis, and it is the honest answer for a word like
*yacht* where no rule will save you.
