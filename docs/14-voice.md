# The dictation voice

Every curated line the app dictates is pre-rendered once in one ElevenLabs
voice and shipped as a file. Anything without a file uses the device's own
speech, as the whole app did before.

| | |
|---|---|
| Voice | Stephen B, `7a3RHgjBsCMZwVMrTWfz` |
| Model | `eleven_v3` |
| Stability | Robust (`1.0`) |
| Lines | 244: a naming line and a sentence for each of 122 words |
| Cost | about 7,500 characters, once; re-renders only what changed |
| Renderer | `tools/render_audio.py` |

## Why, stated carefully

**Not because the voice is nicer.** Wood et al. (2018, 22 studies) found voice
type is not a significant moderator of text-to-speech effectiveness. If this
were about quality, `docs/05`'s original judgement that the free browser voice
is adequate would stand.

**Because it can be checked.** `docs/05` decision 3 says listen to every word
by hand, because a mispronounced word teaches the wrong model of it. Device
speech makes that impossible to finish: an iPad, a Chromebook and a laptop each
say *controversy* their own way, so listening on one tells you nothing about
another. A rendered clip is the same file everywhere. Listen once, and what she
hears is known.

**And it was already the plan.** `docs/05`'s architecture has audio generated
once per word and per sentence and served as files, rather than synthesised in
the request path. Live calls from the page would also have put the API key in
front of everyone with the URL, and broken offline use, which `docs/05`
decision 6 requires.

## Why v3, and why Robust

Peter chose `eleven_v3`. Its gain here is contextual reading: *"The word is
prophesy, the verb."* hands the model the part of speech, which is exactly
what separates *-see* from *-sigh*.

ElevenLabs describes v3's three stability presets
([best practices](https://elevenlabs.io/docs/overview/capabilities/text-to-speech/best-practices)):

> **Creative:** "More emotional and expressive, but prone to hallucinations."
> **Natural:** "Closest to the original voice recording—balanced and neutral."
> **Robust:** "Highly stable, but less responsive to directional prompts but consistent, similar to v2."

Robust. A hallucinated word is the worst thing a spelling test can say, and the
KS2 administrator is told not to overemphasise the target word anyway. The docs
give no numbers for the presets, so `1.0` is used: it is Robust whether the API
reads stability as a continuous scale or as three stops.
`tests/test_audio.py` fails if anyone sets it below `0.5`.

The same page says: *"Professional Voice Clones (PVCs) are currently not fully
optimized for Eleven v3."* That matters because there are **two** voices called
Stephen B in the workspace:

| ID | Category | Description |
|---|---|---|
| `7a3RHgjBsCMZwVMrTWfz` | instant clone | "A test track for PMI podcasts" |
| `co3Fa2DchGAVyZ7WbMAQ` | professional clone | labelled `en-british` |

The instant clone is the one Peter named, and on v3 it is also the better
choice. To compare, `--voice co3Fa2DchGAVyZ7WbMAQ` re-renders everything:
the voice is part of every clip's name.

v3 has no SSML break or phoneme tags, so a word the voice gets wrong is fixed
by respelling it in `SPOKEN_OVERRIDES` in the renderer. The app still looks
the clip up by the real line; only the audio changes.

## How it cannot play the wrong thing

**A clip is found by the exact text about to be said.** The manifest,
`web/data/audio.json`, is keyed by the line itself:

```json
"The word is advice, the noun.": "audio/3f0c2a91b7e4d850.mp3"
```

Edit a sentence and its old clip no longer matches anything, so it is never
played; that item uses the device voice until the next render. Nothing stale
can reach her.

That makes the naming line a contract between two languages.
`engine/sentences.py` `naming_line()` and `web/js/audio.js` `namingLine()`
build the same string, and `tests/test_audio.py` holds them to it for every
word. One stray comma and every item would quietly use the device voice with
nothing looking broken.

**One voice per item.** If any line of an item lacks a clip, the whole item
uses the device voice, so she never hears Stephen say the word and the tablet
say the sentence.

**Except when a clip fails mid-item.** Offline before it was cached, say. Then
that one line falls back to the device voice: silence would cost her the item,
a voice change only costs consistency. The attempt row records `mixed`.

## What each attempt records

`audio_source` on every attempt row: `clip`, `device`, `mixed`, or null for a
cloze. Two voices are two stimuli, so they are recorded rather than pooled, for
the same reason `prompt_mode` exists. The column is in `db/schema.sql`.

## Three things that went wrong on the way, or would have

**A device with no speech voice used to get the cloze for everything.** Now a
curated word is dictated properly from its clip; only an unrendered school word
falls back to the cloze, and the "no voice installed" note appears only then.

**Cancelling a clip used to be able to start the device voice.** Submitting
mid-dictation settles the playing clip as "failed", and a failed clip falls back
to the device voice. In the gap before the reveal is drawn (it waits on an
IndexedDB write) the redundancy guard is not yet up, so the tablet would start
saying the word over the marking. Every dictation now carries a sequence number
that cancelling bumps. The browser suite has a check for exactly this, and it
was verified by removing the token and watching that check fail with the
device saying *"The word is accommodate."*

**A cached clip might not have played offline on the iPad.** Safari fetches
media in byte ranges and can refuse a whole response to a range request, while
a cache can only hold whole responses. The service worker now slices a cached
clip into the `206` the media element asked for. Tested on nine range shapes,
down to the bytes returned.

## The render, and the review it enables

```
python3 tools/render_audio.py --dry-run              # what would render, spends nothing
ELEVENLABS_API_KEY=... python3 tools/render_audio.py # render what is missing
```

On Windows: `$env:ELEVENLABS_API_KEY="..."; py tools\render_audio.py`.

Then listen. The words to hear first are the ones `engine/sentences.py`
`PRONUNCIATION_WATCHLIST` flags, and above all `prophecy` / `prophesy`, which
are not homophones in British English. After any sentence edit, re-render in
the same commit: `tests/test_audio.py` fails on a line without a clip, and says
which command fixes it.

Then sync to the site with `tools/deploy_to_site.py`, which now stamps the
service worker's cache version from the content, so an installed tablet actually
picks the new clips up instead of keeping the old ones forever.

## Still open

- **Nothing has been rendered yet.** The connector can start a generation but
  lacks the scope to read one back (`convai_read convai_write flows
  speech_history_read text_to_speech`), so the render needs the script and a
  key. Until then the app behaves exactly as it did.
- **Clip warm-up has no browser test.** `warmClips()` fetches this week's
  words and the next due words once the service worker is in charge. Testing it
  needs the worker and request interception together, which Playwright does not
  make reliable; the clip tests block the worker to see every request.
- **Consistency across 244 separate generations is unmeasured.** v3 varies more
  between takes than v2. Robust stability and a fixed seed are the mitigations;
  listening is the check.
