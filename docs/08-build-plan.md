# Build plan

Ordered so that the thing that teaches ships before the thing that decorates, and so that the
data model is right before there is data in it.

## M0: decisions, before code

- [ ] **Scope**: your daughter only, or other children too? Changes `docs/06` from background
      reading to a launch blocker.
- [ ] **Handwriting**: is the real target the written test? If yes, the paper round in
      `docs/07` is a milestone, not an extra.
- [ ] Confirm Azure subscription, region (UK South), and Postgres tier.

## M1: engine to service (1-2 days)

The engine works. Wrap it.

- [ ] Seed Postgres from `engine/words.json`: words, patterns, word_patterns.
- [ ] FastAPI: `POST /attempt` returns diagnosis plus feedback payload; `GET /session`
      returns the interleaved queue; `POST /session/end`.
- [ ] Port `schedule.py` state to `scheduler_state` and `pattern_state` tables.
- [ ] Every attempt writes an immutable row. Verify by replaying a session from the table.

**Done when** a curl script can run a full session and the attempts table reconstructs it.

## M2: content generation, offline (1 day)

- [ ] Batch job: for each of 103 words, generate a context sentence in the exact GPS four-step
      shape, a rule card, and three plausible distractors. Anthropic API, one run, cached.
- [ ] Human review pass. Nothing shows to a child until `word_content.active` is true.
- [ ] Azure Speech: render word audio and sentence audio to Blob Storage.
- [ ] **Listen to all 103.** Fix the ones British TTS gets wrong.

**Done when** every word has a reviewed sentence and correct audio.

## M3: the six screens (3-5 days)

Draft in Claude Design first, build in vanilla JS second. Screen inventory is in
`docs/02-ux-evidence.md`.

- [ ] Attempt screen: audio, free-type input, nothing else, no motion.
- [ ] Reveal screen: attempt marked against target, error named, morphemes, one line of why,
      three sibling words.
- [ ] Rule card.
- [ ] Session end: self-referenced progress only. No streak, no days, no leaderboard.
- [ ] Service worker, IndexedDB queue, offline flush.
- [ ] **Keystroke timing capture.** Inter-key latency per attempt, and a rolling typing
      fluency estimate. Typing skill moderates learning in the typed condition, so an
      unmeasured slow typist makes every other number uninterpretable.

**Done when** she can do a full session on a phone with the wifi off.

## M4: diagnostic (2 days)

- [ ] 24-word baseline probe, sampled across the pattern space, 16 on-list and 8 off-list.
- [ ] Profile computation: phonological reliance, orthographic choice rate, error mix,
      pattern strength, confidence.
- [ ] Strategy probe, at most one item in five, never after a failure.
- [ ] Grown-up view of the profile, in English, with what to do about it.

**Done when** a profile from a real probe changes what the next session contains.

## M5: the escalation ladder (2 days)

**Ship the fixed sequence first.** The only trial that isolated adaptivity found no advantage
over a well-built fixed app, so adaptivity is now a hypothesis to test rather than a feature to
assume. Build the ladder behind a flag, default off, and turn it on inside M7's experiment.

- [ ] Implement the per-error-type ladder from `docs/03-diagnostic.md`, behind a feature flag.
- [ ] `pattern_state.rung` advances on repeated failure at a rung.
- [ ] Log `method_shown` on every attempt.

**Done when** two children with different error profiles get visibly different teaching for
the same word.

## M6: measurement (2 days)

- [ ] Delayed-test sessions at 7 and 28 days, scheduled automatically, **on paper**, scored to
      the GPS mark scheme exactly. Typed delayed tests would bias the orthographic measure.
- [ ] The four-number dashboard: phonological reliance falling, delayed accuracy rising,
      pattern strength, transfer to off-list words.
- [ ] Paper round mode: app dictates, adult marks, `prompt_mode = dictation_paper`.

**Done when** you can answer "is this working?" with a number that is not session score.

## M7: first experiment (1 day plus the run)

- [ ] Pre-register in `experiments/`, committed before data collection.
- [ ] Matched-pair randomised assignment, arm stamped at assignment.
- [ ] Analysis notebook, mixed-effects logistic model.

**The question has moved**, now that the prior art is clearer. Error-based exercises have
already beaten a word-search control, and corpus-level error exercises already exist. The
untested claim in this build is per-child adaptivity, which is also the expensive part.

> Does **per-child adaptive** method selection, driven by the diagnosed error type, beat a
> **fixed** error-based sequence at the 28-day delayed test?

That is the same shape as the Solheim adaptive-versus-fixed reading trial, at word level. If
adaptivity does not beat fixed, the escalation ladder is complexity without payoff, and the
product is simpler and better without it. Worth knowing early.

Second question, cheaper, still useful:

> For doubling errors, does stating the rule with a worked example beat whole-word study at
> the 28-day delayed test?

## M8: only if scope widens

- [ ] DPIA, before launch, shaping the design.
- [ ] Data export and hard delete.
- [ ] Adult onboarding, DPA template, sub-processor list.

## Deliberately not on this list

Leaderboards, streaks, avatars, an LLM tutor chat, multi-tenant school accounts. Each is
either weakly evidenced, a data protection question, or both. Add them when something real
demands them.
