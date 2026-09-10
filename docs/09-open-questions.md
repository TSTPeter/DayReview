# Where the science is thin

Updated 9 September 2026, after reading four papers in full. Three of the original questions
are answered. One answer changed the build.

## Answered: does adaptivity beat a fixed sequence?

**No, in the one trial that isolated it.** Solheim et al. randomised 13 Norwegian schools, 744
Grade 1 children, and varied only whether the computer application adapted to performance. Both
interventions beat control; neither beat the other. Adapt versus Fixed contrasts: word reading
p = .227, sentence reading p = .121, spelling p = .670. Effect sizes against control were
0.38-0.64 for Adapt and 0.58-0.75 for Fixed.

Caveats matter here: the computer element was 10 minutes of a 40-minute teacher-led session,
the adaptivity was *difficulty* selection rather than *method* selection, and the two apps
differed on more than adaptivity despite the paper's framing.

**Changed:** M5 now ships the fixed sequence by default with the escalation ladder behind a
flag. Adaptivity is the hypothesis M7 tests, not the feature the product assumes.

## Answered: is error-based instruction established?

**Partly, against a weak control, in Spanish.** Rello et al., 43 children analysed, eight-week
crossover against a word-search game. Errors per word p = 0.029 (r = 0.29) and errors per
incorrect word p = 0.011 (r = 0.35). **Words with errors, the most intuitive measure, was not
significant (p = 0.355).** Reading did not improve. Subjective confidence did not improve.

**Changed:** `docs/01-evidence.md` now quotes the table rather than the abstract, and flags
their choice to display misspellings to the learner as one we do not copy in the main loop.

## Answered: is there prior art for the per-child engine?

**Yes, and it has no efficacy data.** SPIRE was evaluated by 10 experts rating 50 simulated
transcripts, plus 7 children in usability sessions. No learning outcomes.

Two useful by-products. First, experts scored the *reasoning* at 4.90 of 5 with 74.7% perfect
agreement, but *instructional action* at 4.32 with only **26.7% perfect agreement**, disagreeing
mainly about ordering. There is no expert consensus sequence to copy, which makes our ladder
ordering a genuine research question rather than an oversight. Second, roughly **$0.70 and
eight model calls per word inquiry**, which settles the offline-generation argument.

## Answered, and it bites: handwriting versus typing

Broc et al., 305 students, Grades 4 to 7. Copying task, both media.

- Children copied roughly **twice as many words** on paper (42.09 vs 20.09, eta-sq 0.58).
- Replication spelling accuracy: paper 0.95 vs keyboard 0.89, eta-sq 0.13.
- The medium-by-error-type interaction was significant in both studies, and in the replication
  the keyboard penalty was carried specifically by **orthographic errors**: 0.01 per word on
  paper against 0.06 on keyboard, t(166) = -10.42.

**Typing inflates the exact error class this product exists to diagnose and treat.**

**Changed:** the baseline probe and both delayed tests move to paper. Everyday practice stays
typed. `docs/03-diagnostic.md`, `docs/04-experiment.md`, `docs/07-assessment.md` and
`docs/08-build-plan.md` all updated.

**Note for anyone citing this paper:** its abstract states no significant differences in error
types between conditions. Its results section reports significant medium-by-error-type
interactions in both studies. Trust the tables.

## Still wanted

| Paper | What I need | Decision it changes |
|---|---|---|
| [Ouellette & Tims 2014](https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2014.00117/full) | The typing-proficiency interaction, ideally a threshold | Becomes a literal constant: below it, prefer paper and letter tiles |
| [Suggate et al. 2023](https://www.sciencedirect.com/science/article/pii/S0022096523000504) | The fine-motor cut-off used | Same constant, from the other direction |
| [Chandler et al. 2025, JLD](https://journals.sagepub.com/doi/10.1177/00222194251364836) | The moderator analysis | The ordering of every escalation ladder, which SPIRE shows experts dispute |
| [Colenbrander et al. 2022, RRQ](https://ila.onlinelibrary.wiley.com/doi/10.1002/rrq.399) | Effect sizes by outcome, and fidelity data | Whether an app that removes delivery variance is a real test of SWI |
| [Memory 2023, retrieval and spelling](https://www.tandfonline.com/doi/abs/10.1080/09658211.2023.2248420) | Free recall or cued recall? | The default input mode |
| Treiman on unstressed vowels | Any intervention evidence at all | Rung 1 of the vowel-choice ladder, currently convention |
| Broc et al. full text, dictation sub-analysis | Whether the orthographic inflation holds for **dictation**, not just copying | How hard the paper-only measurement rule needs to be |

That last row is the most valuable remaining question. Copying and typing split visual
attention between screen and keyboard in a way dictation may not. If the orthographic inflation
is a copying artefact, typed measurement is rescued and the build gets simpler.

## Lower value, do not spend time on

- **Li 2025**, Chinese-English reinforcement learning. Different population and task.
- **Chinese character typing versus handwriting.** Logographic; the orthography-meaning split
  does not map to English.
- **Vocabuild 2025.** Two citations, no efficacy data, and its central mechanic animates the
  wrong spelling the child produced. Borrow the reframing of error as discovery. Do not borrow
  the animation.
- **Watters 2023.** Excellent history, no evidential weight. Keep the 1886 spelling-machine
  patent for the introduction of any pitch.

## Still asserted from convention, not evidence

- Session length. No credible evidence for any figure.
- The escalation ladder ordering. Reasoned from component effect sizes, and now known to be
  something experts themselves disagree about.
- Leitner intervals of 1, 2, 4, 8, 16 days. Consistent with the spacing literature, not derived
  from it.
- Latency and edit count as confidence proxies. Plausible, untested here.
