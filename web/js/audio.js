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
// Voice type is not a significant moderator of TTS effectiveness (Wood et al. 2018,
// 22 studies, d = 0.35), so the free browser voice is adequate and there is no quality
// argument for paying for recorded human audio. There IS a correctness argument: docs/05
// warns British TTS mangles 'controversy', 'privilege' and 'schedule' often enough to
// matter, and a wrong model of the word teaches the wrong spelling. Hence overrides.

const GAP_MS = 12000;      // docs/07: at least 12 seconds between spellings
const BETWEEN_STEPS_MS = 400;

let wordIsVisible = false;
let overrides = {};
let cachedVoice = null;

export function setWordVisible(visible) { wordIsVisible = visible; }
export function setOverrides(map) { overrides = map || {}; }
export function getOverrides() { return { ...overrides }; }

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
export async function dictate(word, sentence, { onStep = () => {} } = {}) {
  onStep("word");
  await speak(`The word is ${spoken(word)}.`);
  await wait(BETWEEN_STEPS_MS);
  if (sentence) {
    onStep("sentence");
    // The sentence is spoken as written, so the word sits in natural prosody. The KS2
    // administrator is told NOT to overemphasise the target word.
    await speak(sentence);
    await wait(BETWEEN_STEPS_MS);
  }
  onStep("word-again");
  await speak(`The word is ${spoken(word)}.`);
  onStep("done");
}

export function cancel() {
  if (supported()) speechSynthesis.cancel();
}

export const MINIMUM_GAP_MS = GAP_MS;
