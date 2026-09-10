# Spelling

A spelling app for the DfE Year 5/6 statutory list, built on the evidence rather than on
edtech convention. It diagnoses *which layer* of a word a child gets wrong, teaches at
that layer, schedules practice over weeks, and records enough to learn which method works
for which kind of error.

**Start with [`CLAUDE.md`](CLAUDE.md).** It carries the brief, the non-negotiables and the
document map. Then read `docs/` in order. [`docs/10-build-log.md`](docs/10-build-log.md)
says what is actually built and what to distrust.

## Run it

```bash
python3 engine/export.py     # regenerate web/data/*.json from the word model
python3 serve.py             # then open http://localhost:8000
```

A server is needed only because ES modules and service workers refuse to run from
`file://`. There is no API and no database: everything the child types stays in her
browser's IndexedDB on that device.

## Run the tests

```bash
python3 -m unittest discover -s tests -t .     # 92 tests, no dependencies
python3 engine/demo.py                          # classifier coverage over the corpus
```

The browser suite drives the real app in Chromium and asserts the `docs/02`
guarantees — that the target word is never on screen while she types, that the
session-end screen has no streak or day count, that the paper probe records
`dictation_paper`, and that a session survives losing the network:

```bash
npm install && npx playwright install chromium
python3 serve.py --port 8137 &
node tests/browser/run.mjs
```

`package.json` exists only for that harness. The app ships no dependencies: `web/` is
vanilla JS and `engine/` is pure Python with an empty import list.

Both suites run on every pull request via `.github/workflows/tests.yml`, which also
fails if `web/data/*.json` has drifted out of step with the word model.

## What is here

```
CLAUDE.md                  the brief. Read first
docs/01..09                the evidence the design rests on
docs/10-build-log.md       what was built, what changed, what to distrust
engine/                    the domain core. Pure Python, no I/O, no dependencies
  words.py                 103 statutory word forms, 21 patterns, 293 curated misspellings
  classify.py              error classifier and KS2 mark-scheme scoring
  schedule.py              Leitner boxes plus a pattern layer, interleaved
  probe.py                 the 24-item baseline probe, 16 on-list and 8 off-list
  profile.py               phonological reliance, orthographic choice, transfer
  ladder.py                the escalation ladder, DEFAULT OFF (docs/08 M5)
  sentences.py             111 context sentences. NOT YET REVIEWED — read them
  export.py                emits web/data/*.json
  demo.py                  coverage harness and a worked session
web/                       the six screens. Vanilla JS, no framework, offline-capable
db/schema.sql              the Postgres schema this grows into
tests/                     unit, golden-file and cross-language parity suites
```

## The engine is the domain core

Everything imports it and nothing reimplements it, with one deliberate exception. Running
with no server forces a browser-side classifier, so `web/js/engine/` holds mechanical
ports of `classify.py` and `schedule.py`. They are held to the Python implementation by
`tests/test_parity.py`, which compares both over roughly 2,800 cases, and by
`tests/test_schedule_parity.py`, which replays the golden-file session through the browser
scheduler. If either goes red, browser-collected data can no longer be pooled with
anything scored in Python. Treat it as a build blocker.

## Three things this app deliberately does not have

**No streaks, no badges, no day counter.** Engagement-contingent rewards carry the largest
overjustification penalty (d = -0.40), children fare worse than adults, and it sits close
to the ICO Children's code prohibition on nudge techniques. Progress is self-referenced:
rules cracked, words moved further apart.

**No dyslexia font and no coloured overlay claim.** Both refuted (g = -0.04, N = 688; and
2,690 participants). Font size and background are offered as comfort preferences with no
claim attached.

**No adaptivity switched on.** The one trial that isolated it found no advantage over a
well-built fixed sequence. The ladder is built, flagged, and off until the M7 experiment
says otherwise.

## Scope

One child, one device, data never leaves it. That is what keeps `docs/06` background
reading rather than a launch blocker. **The moment a second child uses this, a DPIA
becomes legally mandatory** — not advisable, mandatory — and export and hard delete become
launch features. Both are already built; the DPIA is not.
