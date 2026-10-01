// Listening for her voice, to encourage saying a word aloud. On this device only.
//
// NOTHING IS RECORDED, STORED OR SENT. The microphone feeds an analyser that yields
// one number at a time, how loud the room is right now. Nothing keeps the sound and
// nothing turns it into words, so there is no recording to protect and nothing that
// could identify her. Browser speech recognition is deliberately NOT used: it can send
// the audio to Apple or Google to be transcribed, which would be a child's voice
// leaving the device (docs/06). Peter's brief did not need it either: the point is
// to say the word, not to be marked on how.
//
// Why say it at all. Saying a word aloud makes it more memorable than reading it
// silently, but only when some items are said and others are not: the production
// effect (MacLeod et al. 2010). Saying it the way it is spelt helps children spell
// it (Hilte and Reitsma 2006). So it is asked for on a miss, for the words whose
// support includes it, never on every card.
//
// Off by default, ICO Children's code standard 7. An adult switches it on in the
// grown-up view; the browser then asks for the microphone, and shows that it is on.
// The microphone is opened for the game and closed the moment she leaves it.

let stream = null;
let ctx = null;
let analyser = null;
let buf = null;

export const supported = () => !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia
  && (window.AudioContext || window.webkitAudioContext));

export const isOpen = () => !!stream;

export async function open() {
  if (stream) return true;
  if (!supported()) return false;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    const AC = window.AudioContext || window.webkitAudioContext;
    ctx = new AC();
    if (ctx.state === "suspended") await ctx.resume().catch(() => {});
    analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    buf = new Float32Array(analyser.fftSize);
    // Into the analyser and nowhere else: not to the speakers, not to a recorder.
    ctx.createMediaStreamSource(stream).connect(analyser);
    return true;
  } catch {
    close();
    return false;
  }
}

export function close() {
  if (stream) for (const t of stream.getTracks()) t.stop();
  if (ctx) ctx.close().catch(() => {});
  stream = null; ctx = null; analyser = null; buf = null;
}

function loudness() {
  if (!analyser) return 0;
  analyser.getFloatTimeDomainData(buf);
  let sum = 0;
  for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
  return Math.sqrt(sum / buf.length);
}

/**
 * Wait for her to say something: sound well above the room's own level for about a
 * quarter of a second in all. Resolves "heard", "quiet" after `ms`, "off" if the
 * microphone is closed, or "stopped" if `signal.stopped` is set.
 * onLevel(0..1) drives a meter, so she can see that it is listening.
 */
export function listen(ms = 8000, onLevel = () => {}, signal = {}) {
  if (!analyser) return Promise.resolve("off");
  // iOS can leave the context suspended when it was made after an await. A miss is a
  // tap, and this runs inside it, so asking again here is allowed to work.
  if (ctx && ctx.state !== "running") ctx.resume().catch(() => {});
  return new Promise((resolve) => {
    const start = performance.now();
    let last = start, floor = null, voiced = 0;
    const room = [];
    const tick = () => {
      if (signal.stopped) { resolve("stopped"); return; }
      if (!analyser) { resolve("off"); return; }
      const now = performance.now();
      const dt = now - last;
      last = now;
      const v = loudness();
      if (now - start < 350) {
        room.push(v);                      // the room, before she starts
      } else if (floor === null) {
        room.sort((a, b) => a - b);
        floor = room.length ? room[Math.floor(room.length / 2)] : 0.002;
      }
      if (floor !== null && v > Math.max(floor * 3, 0.02)) voiced += dt;
      onLevel(Math.min(1, v / 0.12));
      if (voiced >= 250) { resolve("heard"); return; }
      if (now - start >= ms) { resolve("quiet"); return; }
      setTimeout(tick, 40);
    };
    tick();
  });
}
