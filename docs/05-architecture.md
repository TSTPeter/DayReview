# Architecture

Target stack is the existing TST infrastructure: Azure App Service, Postgres, Application
Insights, Anthropic API. Nothing here needs anything else.

```
Browser (vanilla JS, service worker)
   |  HTTPS, session cookie
Azure App Service  --  Python API (FastAPI)
   |                      |
   |                      +-- engine/  (word model, classifier, scheduler: pure Python, no I/O)
   |
   +-- Azure Database for PostgreSQL flexible server   (learning data, the dataset)
   +-- Azure Blob Storage + CDN                        (pre-generated audio)
   +-- Application Insights                            (operational telemetry ONLY)

Offline, not in the request path:
   Anthropic API  -->  content generation  -->  human review  -->  Postgres content tables
   Azure Speech   -->  audio files         -->  Blob Storage
```

## Six decisions, with reasons

**1. The engine is pure Python with no I/O.**
`engine/` already works and is tested. The API imports it, offline jobs import it, tests
import it. The front end never reimplements classification, because two implementations
drift and the dataset becomes uninterpretable.

**2. The LLM is nowhere near the request path.**
Sentences, explanations, distractors and rule cards are generated in a batch job, reviewed by
a human, and stored in Postgres. Four reasons, in order of weight:

- Safeguarding and data protection: no child's writing ever leaves our tenancy. See `docs/06`.
- Determinism: the same child sees the same explanation twice, which matters for learning.
- Latency: a spelling attempt must feel instant.
- Cost: 103 words times a handful of assets is a one-off spend, not a per-attempt one. For
  scale, SPIRE reports roughly $0.70 and eight model calls per single word inquiry. Live
  generation for a class would cost more than the rest of the stack combined.

If generation is ever needed live, send the *target word and error type* only. Never the
child's free text, never an identifier.

**3. Audio is pre-generated, not synthesised in the browser.**
Browser `SpeechSynthesis` voices vary by device and OS, and get British English words wrong
inconsistently. Generate once per word and per sentence, store in Blob, serve via CDN. Voice
type is not a significant moderator of TTS effectiveness, so use Azure Speech in a UK region
rather than paying for a premium voice.
[Wood et al. 2018](https://pmc.ncbi.nlm.nih.gov/articles/PMC5494021/)

Check all 103 pronunciations by hand. British TTS mishandles *controversy*, *privilege* and
*schedule* often enough to matter, and a wrong model of the word teaches the wrong spelling.

**4. Learning data goes to Postgres. Telemetry goes to App Insights. Never mix them.**
App Insights holds request traces, errors, and performance. It does not hold attempts,
children, or anything that could identify a child. Two reasons: App Insights retention and
geography are the wrong controls for children's data, and the learning dataset needs
relational queries that telemetry stores do badly.

**5. Children are pseudonymous by construction.**
No child name, no email, no date of birth, no school in the child table. A child is a row
with a generated id and a display nickname chosen by the adult. The mapping from nickname to
real child lives with the adult, not in the database. This is data minimisation done at the
schema level rather than in a policy document, and it materially shrinks the DPIA.

**6. Offline first.**
Service worker caches the session queue and audio, attempts are written to IndexedDB and
flushed on reconnect. Home broadband and school networks both fail, and a spelling session
interrupted mid-word is a session that does not get finished.

## Auth

- Adult signs in with Entra ID (external identities for non-TST adults later).
- Child gets a session by tapping their nickname on the adult's device, or via a short-lived
  code. No child account, no child credential, no child email.
- Everything a child touches is scoped by the adult's tenancy.

## Testing

- `engine/` unit tests: the classifier against the curated misspelling corpus, currently 293
  cases at 99.7% classified. Any drop is a regression.
- Golden-file test on the scheduler: fixed seed, fixed dates, asserted queue.
- API contract tests.
- One end-to-end: dictation to reveal to next-session scheduling.

## What not to build yet

No multi-tenant school model, no leaderboards, no parent messaging, no LLM tutor chat.
Each of those adds a DPIA question. Add them when a school asks, not before.
