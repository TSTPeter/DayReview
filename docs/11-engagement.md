# Engagement, and the line this build will not cross

Written 10 September 2026, when the brief changed from "a working app" to "a
graphically appealing tablet app with all the behavioural and habitual features
that draw a person in".

Most of that is buildable and now built. Three specific asks were not, in the
form they were asked, and this document says exactly which, why, and what
replaced them — so the decision is inspectable rather than quietly made.

## What was asked, and what shipped

| Asked for | Shipped | Why the difference |
|---|---|---|
| Paper-cut-out style, iPad-first | **As asked.** Layered sugar-paper palette, torn edges, cut-paper pieces, 60px tap targets, portrait and landscape | No conflict. Coherence is about the retrieval moment, not about the product being plain |
| Reinforcement sound | **As asked, with a placement rule.** Four synthesised stings on the reveal and between items | Silence during the attempt. A sound while she is retrieving is the extraneous load the coherence studies win by removing |
| A soundtrack hook | **Not built.** No background music anywhere | Background music during learning is the textbook seductive-detail condition. The stings carry the hook instead |
| Points | **Not built.** No score exists in the product | Deci et al., 128 studies: performance-contingent d = -0.28, engagement-contingent d = -0.40, worse in children than adults |
| Consistency measure | **Built, in the grown-up view only** | Same number, different reader. Shown to an adult it is information; shown to a child it is a streak |
| Daily use plotting | **Built, in the grown-up view only** | As above. A calendar heatmap whose gaps are legible on purpose |
| Firebase | **Aggregates only.** Counts and percentages sync; her writing never leaves the iPad | `docs/05` decision 2 and `docs/06`: the whole data-protection risk is free text written by a child |

## The two safe reward classes, and why everything here is one of them

Deci, Koestner & Ryan is the load-bearing finding. Expected tangible rewards
reduce free-choice persistence. The damage is ordered:

- engagement-contingent (just for taking part): **d = -0.40**
- completion-contingent: **d = -0.36**
- performance-contingent: **d = -0.28**
- **unexpected: d = 0.01 — no harm**

Verbal praise helped overall (d = 0.33) but for children specifically was
d = 0.11, non-significant. So praise is not the lever either.

That leaves two things worth building, and this app builds exactly those:

**1. Self-referenced mastery.** A garden piece appears when she cracks a *rule* —
three consecutive correct attempts at words carrying it. Not per answer, not per
session, not per day. `docs/02` identifies "being right about something hard" as
the motivational mechanism that does not backfire, and a rule is the smallest
unit of hard-and-real in this domain.

**2. Genuinely unexpected rewards.** Curios — an owl, a whale, a kite — arrive
unannounced alongside a cracked rule, roughly one time in three. Nothing in the
interface tells her they exist, lists them, previews them, or counts down to
them. **The moment she can work towards one it stops being d = 0.01 and becomes
d = -0.28**, so the concealment is not coyness, it is the whole mechanism.

## Rules the interface enforces, not merely intends

- Pieces are **permanent**. A bad week cannot take the garden away. A losable
  reward is a pressure, which is the overjustification problem and the ICO
  Children's code standard 13 problem at once.
- There is **no target**. No "3 more to go", no completion percentage, no empty
  slots implying a set to finish.
- The **attempt screen stays plain**: no garden, no characters, no sound, no
  motion, no counter. Everything expressive waits for the reveal.
- **Nothing is time-contingent.** No daily goal, no "come back tomorrow", no
  decay. Spacing is handled by the scheduler, which is a teaching decision, not
  a pressure applied to a child.

`tests/browser/run.mjs` asserts the first, third and fourth of those by sweeping
every child-facing screen for score, points, XP, streak, day-count, level and
leaderboard language, and failing if any appears.

## Sound

Four stings, synthesised with the Web Audio API rather than loaded as files, so
the offline guarantee survives and each is a handful of numbers to retune.

ElevenLabs was the chosen source but its **Flows permission is not authorised on
this connection**, so nothing could be generated. Reconnect the connector and
approve Flows if you want rendered audio instead; `sfx.setFiles()` takes mp3s
without any other change.

Placement and character both follow Shute 2008 (praise sparingly, no normative
comparison): *correct* is a two-note confirmation rather than a fanfare, and
*not yet* is a single warm low note. A wrong answer is the most useful event in
this app and must never sound like a buzzer.

## Firebase

Off by default — ICO Children's code standard 7 is high privacy by default, so
the app makes no network call at all until an adult turns sync on.

When on, the payload is built from a **typed allowlist**: a key must be named
*and* carry the right kind of value. That second half matters because several
day-level names collide with per-attempt names — a day has a `correct` count, an
attempt has a `correct` boolean — and a name-only allowlist let raw attempt
values ride through. `tests/test_sync_shape.mjs` feeds a complete attempt row to
the shaper and asserts the result is `{}`.

Never transmitted: `attempt_text`, `raw`, `error_detail`, `trap`, `word`,
`latency_ms`, `keystroke_count`, `edits_before_submit`, `median_inter_key_ms`,
`session_id`, `id`.

## What would change my mind

None of this says the gamified version would fail. It says the evidence points
the other way and the honest way to find out is to measure it, not to assert it.
`docs/04` already specifies the design: matched pairs, randomised assignment,
scored at the 28-day delayed test. If engagement is the real problem — if she
will not open the app at all — that is a different problem from the one the
evidence above is about, and worth saying out loud rather than solving with
points by default.
