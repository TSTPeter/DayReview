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

// RUNS. Peter, 1 October 2026: right answers in a row in a game deserve a sound at
// three, five, seven and nine, and polyphony from eleven. Each milestone is a longer
// climb up the same pentatonic scale as the stings above, so nothing can clash, and
// each adds a voice: from eleven, three voices in canon and a chord that gains a
// voice every two more. Performance-contingent (d = -0.28, the least harmful expected
// class), confined to the games, and silent whenever sound is off. docs/15.
const PENTA = [261.63, 293.66, 329.63, 392.00, 440.00, 523.25, 587.33, 659.25,
               783.99, 880.00, 1046.50, 1174.66, 1318.51, 1567.98, 1760.00];
const RUNS = { 3: [7, 8, 10], 5: [5, 6, 7, 8, 10], 7: [5, 6, 7, 8, 9, 10, 12],
               9: [3, 5, 6, 7, 8, 9, 10, 12, 13] };
const STEP = 0.065;

export const isRunMilestone = (n) => n >= 3 && n % 2 === 1;

function climb(notes, { at = 0, gain = 0.1, last = 0.45 } = {}) {
  notes.forEach((k, i) => tone({ freq: PENTA[Math.max(0, Math.min(PENTA.length - 1, k))],
    at: at + i * STEP, dur: i === notes.length - 1 ? last : 0.16, gain }));
  return at + (notes.length - 1) * STEP;
}

export function playRun(n) {
  if (muted || attemptScreenUp || !isRunMilestone(n)) return false;
  if (!arm() || !ctx) return false;
  try {
    if (n < 11) {
      const notes = RUNS[n];
      const end = climb(notes);
      if (n >= 7) tone({ freq: PENTA[notes[notes.length - 1] - 2], at: end, dur: 0.5, gain: 0.07 });
      if (n >= 9) tone({ freq: PENTA[0], dur: end + 0.5, gain: 0.05, type: "triangle" });
      return true;
    }
    const voices = Math.min(3 + Math.floor((n - 11) / 2), 6);
    const r = RUNS[9];
    climb(r, { gain: 0.07 });
    climb(r.map((k) => k + 2), { at: 0.09, gain: 0.05 });
    const end = climb(r.map((k) => k - 3), { at: 0.18, gain: 0.05 });
    for (const k of [5, 7, 8, 10, 12, 14].slice(0, voices)) {
      tone({ freq: PENTA[k], at: end + 0.08, dur: 0.95, gain: 0.16 / voices });
    }
    tone({ freq: PENTA[0], dur: end + 1, gain: 0.05, type: "triangle" });
    return true;
  } catch {
    return false;
  }
}

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
