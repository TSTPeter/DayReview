# Spelling app: project brief for Claude Code

Read this first. Then read `docs/` in order. Do not start writing application code until you
have read `docs/01-evidence.md` and `docs/06-data-protection.md`, because both constrain the
build in ways that are expensive to retrofit.

## What this is

A web app that teaches the DfE Year 5/6 statutory spelling list to children aged 9 to 11.
It diagnoses *which layer* of a word a child gets wrong, teaches at that layer, schedules
practice over weeks, and records enough data to learn which teaching method works for which
kind of error.

Built by Peter Fotheringham, initially for his own daughter, with a plausible path to
classroom use. The scope decision matters legally: see `docs/06-data-protection.md`.

## Success, defined

Not engagement. Not streak length. Three outcomes, in order:

1. She spells the words correctly in a **dictated test**, a week or more after practice.
2. She spells them correctly **in her own writing**, which is the KS2 teacher assessment
   standard and the harder target.
3. She approaches unfamiliar words with a **strategy** rather than a guess.

Everything the app measures should ladder up to one of those three.

## Non-negotiables

These come from the evidence, not from taste. Each is defended in `docs/`.

| Rule | Why |
|---|---|
| Free-typed recall is the default input | Retrieval beats recognition and copying |
| Feedback shows the attempt against the target, marked, plus the rule | High-information feedback d ≈ 0.99 vs d ≈ 0.24 for "correct/wrong" |
| Practice items are dictated **in a sentence** | Mirrors the KS2 GPS paper administration exactly |
| The scheduler ships before the reward system | Spacing is worth ~10.6 percentage points, rewards are not established |
| No streaks | Engagement-contingent rewards carry the largest overjustification penalty in children, and sit close to the ICO Children's Code nudge prohibition |
| No decorative motion or music on the practice screen | Coherence and seductive-detail is the largest reliable multimedia effect |
| Audio is a mode, not an overlay on displayed text | Simultaneous audio plus text hindered both dyslexic and typical readers |
| No dyslexia font or coloured overlay claims | Both refuted. Offer as comfort preferences only |
| Method is chosen by **error type**, never by "learner type" | Learning styles has no supporting evidence. See `docs/01-evidence.md` |
| **Measurement sessions run on paper** | Typing inflates orthographic errors specifically, which is the exact class we diagnose |
| **The fixed sequence is the default. Adaptivity is the experiment** | The one trial that isolated adaptivity found no advantage over a well-built fixed app |

## Architecture in one line

Azure App Service running a Python API and a vanilla JS front end, Postgres for state,
Application Insights for telemetry, Anthropic API for content generation offline rather
than in the request path. Details and the reasoning in `docs/05-architecture.md`.

## What already exists

`engine/` holds a working, tested word model and error classifier. 103 words, 21 patterns,
99.7% of 293 curated misspellings land in a named category. Run `python3 engine/demo.py`.
Treat it as the domain core. The API wraps it; the front end never reimplements it.

## Document map

| Doc | What it settles |
|---|---|
| `docs/01-evidence.md` | What the learning science supports, with effect sizes and links |
| `docs/02-ux-evidence.md` | What the EdTech UX evidence supports, and three popular ideas it kills |
| `docs/03-diagnostic.md` | How we find out what strategy a child currently uses |
| `docs/04-experiment.md` | How we learn which method works, without fooling ourselves |
| `docs/05-architecture.md` | Azure, Postgres, telemetry, the LLM boundary |
| `docs/06-data-protection.md` | What changes the moment a second child uses it |
| `docs/07-assessment.md` | How KS2 actually tests spelling, and what that forces |
| `docs/08-build-plan.md` | Milestones, in order, with what "done" means |
| `docs/09-open-questions.md` | Where the science is thin and what to go and read |

## Working style

Peter prefers Python, vanilla JavaScript and CSS. No framework unless it earns its place.
He wants scepticism, source links, and the reasoning shown. When you make a design decision
that touches learning or motivation, say which finding it rests on, or say plainly that it
rests on judgement.
