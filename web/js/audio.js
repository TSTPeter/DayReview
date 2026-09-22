// Dictation audio.
//
// TWO RULES ARE ENFORCED HERE RATHER THAN LEFT TO DISCIPLINE.
//
// 1. THE KS2 SCRIPT, EXACTLY. docs/07 reproduces the administration script for GPS
//    Paper 2: "The word is passed. They passed a bridge on their way to school. The
//    word is passed," then at least twelve seconds before the next word. Word,
//    sentence, word again, pause. It costs nothing, it is what she meets in May, and
//    it happens to match the evidence for dictation in context anyway.
//
// 2. AUDIO IS A MODE, NOT AN OVERLAY. Knoop-van Campen et al. found combined audio
//    plus written text hindered efficiency for BOTH dyslexic and typical readers.
//    speak() therefore refuses to run while the target word is on screen. That is a
//    single study with n = 42, so hold it lightly, but the design response is cheap
//    and the guard makes the rule impossible to forget.
//
// TWO VOICES, AND WHY. Voice type is not a significant moderator of TTS effectiveness
// (Wood et al. 2018, 22 studies, d = 0.35), so there is no QUALITY argument for a
// better voice. There IS a correctness argument: docs/05 warns British TTS mangles
// 'controversy', 'privilege' and 'schedule' often enough to matter, and a wrong model
// of the word teaches the wrong spelling. Device speech cannot be checked, because it
// differs between an iPad, a Chromebook and a laptop. So every curated line is
// pre-rendered once in one ElevenLabs voice (tools/render_audio.py): the same file on
// every device, which makes docs/05 decision 3, "listen to every word by hand", a job
// that can actually be finished.
//
// A clip is found by the EXACT text about to be said. If any line of an item has no
// clip (a school word nobody rendered, a sentence edited since the last render), the
// WHOLE item uses the device voice, so she never hears the voice change mid-word.
// Device overrides below fix the device voice only; a wrong clip is fixed by
// re-rendering it.

const GAP_MS = 12000;      // docs/07: at least 12 seconds between spellings
const BETWEEN_STEPS_MS = 400;

let wordIsVisible = false;
let overrides = {};
let cachedVoice = null;

let clips = {};            // exact utterance text -> URL, from data/audio.json
let player = null;         // ONE element for every clip: see arm()
let settleClip = null;     // resolves the clip now playing, so cancel() can end it
let seq = 0;               // bumped by cancel() and by each new dictation

// Ten milliseconds of silence. Played once inside the first tap to unlock the element.
const SILENCE = "data:audio/wav;base64,UklGRsQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YaAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
const CLIP_TIMEOUT_MS = 15000;

export function setWordVisible(visible) { wordIsVisible = visible; }
export function setOverrides(map) { overrides = map || {}; }
export function getOverrides() { return { ...overrides }; }

/** Load data/audio.json. An empty or missing manifest means the device voice throughout. */
export function setClips(manifest) {
  clips = (manifest && manifest.clips) || {};
}
export function clipUrls() { return Object.values(clips); }
export function clipFor(text) {
  return Object.prototype.hasOwnProperty.call(clips, text) ? clips[text] : null;
}

/**
 * Lines one and three of the KS2 script. engine/sentences.py naming_line() builds the
 * identical string and tests/test_audio.py holds the two together for every word: a
 * clip is looked up by this exact text.
 */
export function namingLine(word, hint = null) {
  return hint ? `The word is ${word}, the ${hint}.` : `The word is ${word}.`;
}

/** Can this item be dictated entirely from clips? */
export function clipsCover(word, sentence, hint = null) {
  return !!clipFor(namingLine(word, hint)) && (!sentence || !!clipFor(sentence));
}

export function supported() {
  return typeof speechSynthesis !== "undefined" && typeof SpeechSynthesisUtterance !== "undefined";
}

export function voices() {
  return supported() ? speechSynthesis.getVoices() : [];
}

function pickVoice() {
  if (cachedVoice) return cachedVoice;
  const all = voices();
  cachedVoice =
    all.find((v) => v.lang === "en-GB" && /female|kate|serena|sonia/i.test(v.name)) ||
    all.find((v) => v.lang === "en-GB") ||
    all.find((v) => v.lang && v.lang.startsWith("en")) ||
    all[0] || null;
  return cachedVoice;
}

export function setVoice(nameOrNull) {
  cachedVoice = nameOrNull ? voices().find((v) => v.name === nameOrNull) || null : null;
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// Some engines fire neither onend nor onerror: Chrome has a long-standing bug with
// long utterances, and a device with no installed voices can go quiet without ever
// erroring. The prompt is the whole screen here, so a hang means a child staring at a
// dead box. Always resolve.
const UTTERANCE_TIMEOUT_MS = 15000;

export function speak(text, { rate = 0.85 } = {}) {
  if (!supported() || !text) return Promise.resolve(false);
  if (wordIsVisible) {
    // Refusing rather than queueing: playing it later, out of context, would be worse.
    console.warn("audio suppressed: the target word is on screen (see docs/02 redundancy)");
    return Promise.resolve(false);
  }
  return new Promise((resolve) => {
    let settled = false;
    const done = (ok) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(ok);
    };
    const u = new SpeechSynthesisUtterance(text);
    const v = pickVoice();
    if (v) { u.voice = v; u.lang = v.lang; } else { u.lang = "en-GB"; }
    u.rate = rate;
    u.onend = () => done(true);
    u.onerror = () => done(false);
    const timer = setTimeout(() => done(false), UTTERANCE_TIMEOUT_MS);
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  });
}

function element() {
  if (!player && typeof Audio !== "undefined") player = new Audio();
  return player;
}

/**
 * Call from inside a user gesture. iOS Safari will not let an <audio> element play
 * until one play() has happened inside a gesture; after that the SAME element plays
 * anything, which is why every clip goes through one element. The first dictation is
 * itself started by a tap, so this is belt and braces rather than the only unlock.
 */
export function arm() {
  const p = element();
  if (!p || p.dataset.armed) return;
  p.dataset.armed = "1";
  p.muted = true;
  p.src = SILENCE;
  const done = () => { p.muted = false; };
  const pr = p.play();
  // Only pause if a real clip has not already taken the element over.
  if (pr && pr.then) pr.then(() => { if (p.src === SILENCE) p.pause(); done(); }, done);
  else done();
}

function playClip(url) {
  const p = element();
  if (!p || !url) return Promise.resolve(false);
  if (wordIsVisible) {
    console.warn("audio suppressed: the target word is on screen (see docs/02 redundancy)");
    return Promise.resolve(false);
  }
  if (settleClip) settleClip(false);   // a new clip ends the old one's promise
  return new Promise((resolve) => {
    let settled = false;
    const done = (ok) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      p.onended = null;
      p.onerror = null;
      if (settleClip === done) settleClip = null;
      resolve(ok);
    };
    // Same promise as speak(): always resolve. A stalled download must not leave her
    // looking at a dead prompt.
    const timer = setTimeout(() => done(false), CLIP_TIMEOUT_MS);
    settleClip = done;
    p.onended = () => done(true);
    p.onerror = () => done(false);
    p.muted = false;
    p.src = url;
    const pr = p.play();
    if (pr && pr.catch) pr.catch(() => done(false));
  });
}

// Can this device actually speak? Voices load asynchronously in most browsers, so wait
// for them, then try one short utterance for real. A device with no working TTS cannot
// run an audio-only prompt at all, and the app has to know that BEFORE it dictates
// rather than leaving a child in silence.
let workingPromise = null;

export function working() {
  if (workingPromise) return workingPromise;
  workingPromise = (async () => {
    if (!supported()) return false;
    if (!voices().length) {
      await new Promise((resolve) => {
        const t = setTimeout(resolve, 1200);
        speechSynthesis.addEventListener("voiceschanged", () => { clearTimeout(t); resolve(); },
                                         { once: true });
      });
    }
    cachedVoice = null;
    if (!voices().length) return false;
    return speak("ready", { rate: 1 });
  })();
  return workingPromise;
}

function spoken(word) {
  return overrides[word] || word;
}

// The four-step script. Returns when the third step finishes; the caller owns the pause,
// because in the app the pause is the child typing rather than dead air.
//
// `hint` is a word-class tag ('noun', 'verb') and is spoken as part of the naming step,
// which is what a teacher dictating a -ce/-se pair actually does. It is not decoration:
// for 'licence'/'license' the two words sound identical, so without it the item has no
// answerable question in it at all. See engine/derive.js NOUN_VERB_PAIRS.
//
// Returns which voice was used, "clip", "device" or "mixed", so the attempt row can
// say and the two are never pooled by accident. Returns null if it was cancelled first:
// submitting mid-dictation, or "Hear it again", bumps seq, and without the check the
// rest of the script would carry on talking over the reveal screen, because the reveal
// is only drawn after an IndexedDB write.
export async function dictate(word, sentence, { onStep = () => {}, hint = null } = {}) {
  const mine = ++seq;
  const live = () => mine === seq;
  const fromClips = clipsCover(word, sentence, hint);
  const key = namingLine(word, hint);
  let fellBack = false;
  const say = async (text, deviceText) => {
    if (fromClips) {
      if (await playClip(clipFor(text))) return true;
      // Cancelled, or the word is on screen: stay silent, that is the point.
      if (!live() || wordIsVisible) return false;
      // Otherwise the clip failed: offline before it was cached, or a bad file.
      // Silence would cost her the item; the device voice only costs consistency.
      fellBack = true;
    }
    return speak(deviceText);
  };

  onStep("word");
  await say(key, namingLine(spoken(word), hint));
  if (!live()) return null;
  await wait(BETWEEN_STEPS_MS);
  if (!live()) return null;
  if (sentence) {
    onStep("sentence");
    // The sentence is spoken as written, so the word sits in natural prosody. The KS2
    // administrator is told NOT to overemphasise the target word.
    await say(sentence, sentence);
    if (!live()) return null;
    await wait(BETWEEN_STEPS_MS);
    if (!live()) return null;
  }
  onStep("word-again");
  await say(key, namingLine(spoken(word), hint));
  if (!live()) return null;
  onStep("done");
  return !fromClips ? "device" : fellBack ? "mixed" : "clip";
}

export function cancel() {
  seq += 1;
  if (supported()) speechSynthesis.cancel();
  if (player && player.src !== SILENCE) player.pause();
  if (settleClip) settleClip(false);
}

export const MINIMUM_GAP_MS = GAP_MS;
