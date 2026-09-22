// Reinforcement sound, synthesised rather than loaded.
//
// WHY SYNTHESISED. Four short stings as Web Audio costs no files, no network
// and no cache, so the offline guarantee in docs/05 survives untouched, and
// each sting is a handful of numbers to retune rather than a re-render. If
// recorded audio is ever preferred, drop mp3s into web/audio/ named
// correct/notyet/unlock/complete and setFiles() will use them instead.
//
// WHERE IT MAY PLAY. On the reveal and between items. NEVER while she is
// typing: docs/02's coherence principle is about the moment of retrieval, and
// a sound during an attempt is exactly the extraneous load the removal
// condition wins by dropping. play() refuses when the attempt screen is up.
//
// WHAT THE SOUNDS MAY SAY. Shute 2008 advises praise sparingly and no
// normative comparison, so "correct" is a brief confirming figure rather than
// a fanfare, and "not yet" is neutral and low: informational, never a buzzer.
// A wrong answer is the most useful event in this app; it must not sound like
// a punishment.

let ctx = null;
let muted = false;
let files = null;
let attemptScreenUp = false;

export function setMuted(v) { muted = !!v; }
export function isMuted() { return muted; }
export function setAttemptScreenUp(v) { attemptScreenUp = !!v; }
export function setFiles(map) { files = map || null; }

// iOS starts every AudioContext suspended and only lets a user gesture resume
// it, so the first tap anywhere arms audio for the rest of the session.
export function arm() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
  }
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return true;
}

function tone({ freq, at = 0, dur = 0.18, type = "sine", gain = 0.16, glide = null }) {
  const t0 = ctx.currentTime + at;
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (glide) osc.frequency.exponentialRampToValueAtTime(glide, t0 + dur);
  // Soft mallet envelope: quick but not clicky in, long gentle tail out.
  amp.gain.setValueAtTime(0.0001, t0);
  amp.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
  amp.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(amp).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

// Pentatonic, so any two of these sound consonant together and nothing can
// come out sour however they overlap.
const VOICES = {
  // Two notes rising a fifth. Reads as "yes" without sounding like a jackpot.
  correct:  () => { tone({ freq: 587.33, dur: 0.16, gain: 0.14 });
                    tone({ freq: 880.00, at: 0.085, dur: 0.30, gain: 0.12 }); },

  // One warm low note, falling slightly. Neutral. Says "noted", not "wrong".
  notyet:   () => { tone({ freq: 261.63, dur: 0.30, gain: 0.11, type: "triangle",
                           glide: 233.08 }); },

  // Three notes up, slightly brighter. Only ever fires on a surprise unlock,
  // which by design she cannot predict or work towards.
  unlock:   () => { tone({ freq: 523.25, dur: 0.16, gain: 0.13 });
                    tone({ freq: 659.25, at: 0.09, dur: 0.16, gain: 0.13 });
                    tone({ freq: 987.77, at: 0.18, dur: 0.42, gain: 0.14 }); },

  // Settling cadence at the end of a session. Downward, restful, finished.
  complete: () => { tone({ freq: 659.25, dur: 0.22, gain: 0.11 });
                    tone({ freq: 523.25, at: 0.13, dur: 0.22, gain: 0.11 });
                    tone({ freq: 392.00, at: 0.26, dur: 0.52, gain: 0.12,
                           type: "triangle" }); },
};

export function play(name) {
  if (muted) return false;
  if (attemptScreenUp) return false;      // the rule, enforced not remembered
  if (files && files[name]) {
    const a = new Audio(files[name]);
    a.volume = 0.5;
    a.play().catch(() => {});
    return true;
  }
  if (!arm() || !ctx) return false;
  const voice = VOICES[name];
  if (!voice) return false;
  try { voice(); } catch { return false; }
  return true;
}

export const VOICE_NAMES = Object.keys(VOICES);
