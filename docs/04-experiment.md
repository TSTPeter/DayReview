# Learning what works, without fooling ourselves

The ambition is right: log enough to know when a method works and when it does not. The
danger is that an adaptive app that changes method on failure will *always* look like the
new method worked, because of regression to the mean. Design for that from the first commit.

## The question, stated so it can be answered

> For error type Z, does teaching method A produce more correct spellings at a delayed test
> than method B, holding word difficulty and practice spacing constant?

Unit of analysis is **word x method x child**, not child. That is what makes this tractable:
one child generates hundreds of word-level observations, not one.

## Design: alternating treatments, randomised within matched pairs

Single-case alternating treatments designs are an established way to compare interventions
within one learner, and were included in the spelling meta-analysis alongside group designs.
[ATD in spelling](https://www.researchgate.net/publication/15995382_Increasing_spelling_achievement_an_analysis_of_treatment_procedures_utilizing_an_alternating_treatments_design) ·
[Design guidance](https://bookdown.org/dorothy_bishop/Evaluating-What-Works/Single.html)

Procedure:

1. Take all words currently failing for one error type.
2. Pair them by pattern and by prior accuracy, so pairs are matched on difficulty.
3. **Randomly** assign one of each pair to method A, the other to method B.
4. Hold the practice schedule identical across both arms.
5. Score at the delayed test, not at the immediate re-attempt.

Randomisation is the whole trick. Without it, the app assigns the harder words to the fancier
method and then congratulates itself.

## Five confounds, and what kills each

| Confound | How it fools you | Control |
|---|---|---|
| Regression to the mean | Method B is only ever used after failure, so it always looks better | Randomise assignment, do not trigger on failure |
| Spacing | Method B arrives later, so gets more spacing | Equalise the interval for both arms explicitly |
| Item difficulty | Rules differ hugely in difficulty | Match pairs within a pattern, not across |
| Order and fatigue | Late-session items score worse | Counterbalance position within the session |
| Novelty | Anything new works for a fortnight | Compare at 8 weeks as well as at 1 week |
| Input medium | Typed attempts inflate orthographic errors, the class we care about most | Run delayed tests on paper, and never compare a typed arm against a handwritten one |

Novelty is not hypothetical: gamified engagement is documented to decline after initial
exposure.
[Novelty effect](https://onlinelibrary.wiley.com/doi/abs/10.1111/jcal.12385)

## What to log

Every attempt, one row, immutable. Never overwrite; the history is the dataset.

```
attempt_id, child_id, word, session_id, ts,
prompt_mode        (audio_sentence | audio_word | text_cloze)
attempt_text, correct, error_type, error_detail, patterns[], sounds_right,
method_shown       (which rung of the ladder was used, or none)
arm                (A | B | none)   -- experiment arm, if this word is in a comparison
box_before, box_after, days_since_last_seen, position_in_session,
latency_ms, keystroke_count, edits_before_submit
```

`latency_ms` and `edits_before_submit` are the cheap proxies for confidence. A word spelled
correctly, fast, with no edits, is known. A word spelled correctly after four edits is not
yet known, and should not be promoted a box on that evidence alone.

## Analysis

Mixed-effects logistic regression:

```
correct_at_delayed_test ~ method * error_type + days_since_last_seen + position_in_session
                          + (1 | child) + (1 | word)
```

Random intercepts for child and word, because words differ in difficulty and children differ
in everything.

**Be honest about power.** For one child, this will not reach significance on a method x
error-type interaction in a term. Use it to *choose* for her, not to *prove* for anyone.
The design only becomes a study at cohort scale. Build the logging now so that the study is
possible later without a rewrite.

## Pre-registration, in the repo

Before collecting a single row for a comparison, commit a short pre-registration to
`experiments/`: the question, the two methods, the assignment rule, the outcome measure, the
stop rule, and the analysis. Then do not change it mid-flight.

The stop rule matters most. Without it, the temptation is to look, see a gap, and switch
everything to the winner. That is how you get a product built on noise.

## The dashboard that matters

Not "words practised" or "minutes". Four numbers, per child, over time:

1. **Phonological reliance index**, falling. She is moving from sound to orthography.
2. **Delayed-test accuracy** at 7 days and at 28 days, rising.
3. **Pattern strength**, per rule, so you can see which rules are cracked.
4. **Transfer**: accuracy on off-list words using the same pattern. This is the number the
   interleaving study says will lag, and the one that tells you whether she learned the rule
   or the word.
