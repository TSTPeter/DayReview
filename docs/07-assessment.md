# What KS2 actually measures, and what that forces

The goal is "knowing their spellings, confident in exams and writing, demonstrated in class
tests and KS2". Those are three different assessments with three different rules. Design to
the real ones.

## 1. The GPS test, Paper 2: spelling

Still statutory in 2026. Taken 11 May 2026.
[Assessment and reporting arrangements](https://www.gov.uk/government/publications/key-stage-2-assessment-and-reporting-arrangements-ara/2025-key-stage-2-assessment-and-reporting-arrangements)

- **20 words, 20 marks**, roughly 15 minutes, not strictly timed.
- Paper 1 (questions) is 50 marks. Combined raw score out of 70 converts to one scaled score,
  80 to 120, with **100 as the expected standard**. In 2026 a raw 34-36 converts to 100.
  [Conversion tables](https://www.gov.uk/government/publications/key-stage-2-tests-2026-scaled-scores/2026-key-stage-2-scaled-score-conversion-tables)
- **Spelling is only about 29% of the GPS mark.** Worth knowing before over-indexing on it.

**Administration is a fixed four-step script per word**, with at least 12 seconds between
spellings, and administrators told not to overemphasise the spelling:

> Spelling 7: The word is *passed*. They **passed** a bridge on their way to school.
> The word is *passed*.

[Administering Paper 2](https://assets.publishing.service.gov.uk/media/682dc258a599d03a16bff383/2025_KS2_English_GPS_administering_Paper2_spelling.pdf)

**Build the practice prompt in exactly this shape.** Word, sentence, word again, then a pause.
It costs nothing, it is what she will meet in May, and it happens to match the evidence for
dictation-in-context anyway.

**Marking is unforgiving.** One mark per word, exact letter sequence. Case is free, mixed case
is accepted. But a correct sequence scores **zero** if an apostrophe or hyphen is wrongly
inserted, or if letters are split into clearly divided components. Multiple attempts score
nothing unless the intended answer is clear. No credit for phonetic approximations.
[2026 mark schemes](https://assets.publishing.service.gov.uk/media/6a0af15cc510c3913d826736/2026_KS2_English_GPS_mark_schemes.pdf)

Two design consequences:

- Score exactly as the mark scheme does. Do not be generous. Being kinder than the test
  teaches a false model of where she stands.
- The "clearly divided components" rule means **handwriting matters**. See below.

## 2. The writing teacher assessment, which is the harder target

Writing is teacher-assessed, not tested. The framework has one spelling statement at the
expected standard:

> "spell correctly most words from the year 5 / year 6 spelling list, and use a dictionary to
> check the spelling of uncommon or more ambitious vocabulary"

There are **no additional spelling statements at greater depth**.
[Teacher assessment frameworks](https://www.gov.uk/government/publications/teacher-assessment-frameworks-at-the-end-of-key-stage-2)

So the statutory list matters twice: indirectly in the test, and **by name** in the writing
judgement. DfE does not define "most" numerically.

This is why the headline outcome measure in `docs/04-experiment.md` is delayed-test accuracy
and transfer, not session score. The teacher judgement is made on her independent writing
over time, which is the closest thing to a real-world transfer test.

## 3. The word list itself

100 words, English Appendix 1: Spelling. The lists for Years 3-4 and 5-6 are explicitly
statutory, and are described as "a mixture of words pupils frequently use in their writing
and those which they often misspell".
[English Appendix 1: Spelling](https://assets.publishing.service.gov.uk/media/5a7ccc06ed915d63cc65ce61/English_Appendix_1_-_Spelling.pdf)

`engine/words.py` models all 103 word forms of that list, since *immediate(ly)*,
*sincere(ly)* and *equip(ped)* appear as bracketed pairs.

## The handwriting question, answered, with a sting

Both real assessments are handwritten. The app takes typed input.

For **learning**, typed practice is defensible. Handwriting's advantage concentrates on
acquiring new symbols: novel alphabets, novel orthographies, early letter formation. For older
children spelling in a script they already know, it largely disappears, and the narrative-task
comparison at Grades 4 to 7 found no accuracy difference at all.

For **measurement**, it is not. Broc et al.'s replication found the keyboard penalty was
carried specifically by **orthographic errors**: 0.01 per word on paper against 0.06 on
keyboard. Phonological errors moved far less. Orthographic choice is the exact construct this
product diagnoses and treats, so a typed measurement overstates it.

**So the rule splits by purpose. Practise typed, measure on paper.** The baseline probe and
both delayed tests run on paper. Everyday practice can stay on the keyboard.

Paper also rehearses three things a keyboard cannot:

- The 12-second gap, writing under time pressure, with no backspace.
- Letter formation, which the mark scheme penalises via the "clearly divided components" rule.
- Handwriting stamina across 20 words.

**Keep one session in five on paper.** The app dictates, the child writes, the adult marks in
the app against the same taxonomy. `prompt_mode = dictation_paper` exists for this. It also
yields a clean typed-versus-handwritten comparison on the same words, which is worth logging.

## Typing fluency is a confound, and must be measured

Pre-existing keyboard skill constrained or facilitated learning in the typing condition, with
no equivalent effect for printing (Ouellette & Tims 2014). A child hunting for keys is being
assessed on typing, not spelling.

**Build requirement:** capture inter-keystroke latency on every attempt and derive a fluency
estimate. If median inter-key latency is high, the app should shift the balance toward paper
rounds and letter-tile input, and the analysis in `docs/04-experiment.md` should carry fluency
as a covariate.

The opposite case matters too. Children with impaired fine motor skills learned decoding best
by typing (Suggate et al. 2023). If handwriting is effortful for a given child, push the ratio
the other way and treat paper purely as exam rehearsal.
