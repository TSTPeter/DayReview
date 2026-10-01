/*
 * The Firebase payload must never carry a child's writing.
 *
 * docs/06 concentrates the entire data-protection risk in one place: free
 * text written by a child. This asserts the allowlist in web/js/sync.js holds
 * even when handed a complete, realistic attempt row — the exact mistake a
 * future change is most likely to make ("just spread the row in").
 *
 *   node tests/test_sync_shape.mjs
 */
import { shape, ALLOWED, FORBIDDEN, shapeExperiment, parseConfig, validConfig } from "../web/js/sync.js";

let failures = 0;
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "  ok  " : "FAIL  "}${name}${detail ? "  — " + detail : ""}`);
  if (!ok) failures += 1;
};

// A real attempt row, exactly as store.js writes it.
const attemptRow = {
  id: 41,
  session_id: "a5f0-1111",
  word: "government",
  created_at: "2026-09-10T08:00:00.000Z",
  prompt_mode: "audio_sentence",
  attempt_text: "goverment",
  raw: "goverment",
  correct: false,
  error_type: "silent-letter",
  error_detail: "dropped the silent 'n' from the 'nm'",
  error_patterns: ["silent-letter"],
  sounds_right: false,
  trap: "nm",
  latency_ms: 4310,
  keystroke_count: 11,
  edits_before_submit: 2,
  median_inter_key_ms: 380,
  box_before: 1,
  box_after: 1,
};

const out = shape(attemptRow);

for (const key of FORBIDDEN) {
  check(`'${key}' is stripped`, !(key in out), key in out ? `LEAKED ${JSON.stringify(out[key])}` : "");
}

check("her actual spelling appears nowhere in the payload",
      !JSON.stringify(out).includes("goverment"), JSON.stringify(out));
check("the target word appears nowhere in the payload",
      !JSON.stringify(out).includes("government"));
check("every surviving key is on the allowlist",
      Object.keys(out).every((k) => ALLOWED.includes(k)),
      Object.keys(out).filter((k) => !ALLOWED.includes(k)).join(",") || "none stray");

// The aggregates it IS meant to carry survive intact.
const day = shape({
  date: "2026-09-10", attempts: 12, correct: 9, accuracy: 0.75,
  phonological_reliance: 0.42, patterns_cracked: 3,
  pattern_strength: { "double-consonant": 0.6, schwa: 0.4 },
  attempt_text: "sneaky", nested: { deep: "object" },
});
check("aggregates survive", day.attempts === 12 && day.accuracy === 0.75 && day.date === "2026-09-10");
check("pattern_strength survives as a number map",
      day.pattern_strength && day.pattern_strength.schwa === 0.4);
check("an unknown nested object is dropped", !("nested" in day));
check("a smuggled attempt_text is dropped even beside valid aggregates",
      !("attempt_text" in day));

// A future field added upstream must not ride along by default.
check("an unrecognised new field fails closed",
      !("some_future_field" in shape({ date: "2026-09-10", some_future_field: "x" })));

// Type checking, not just name checking: a per-attempt boolean must not pass
// as a day's tally, and a per-attempt latency must not pass as a day median.
check("a boolean cannot masquerade as a day's correct COUNT",
      !("correct" in shape({ date: "2026-09-10", correct: true })));
check("a real count still passes",
      shape({ date: "2026-09-10", correct: 9 }).correct === 9);
check("a per-attempt median cannot ride along",
      !("median_inter_key_ms" in shape(attemptRow)) &&
      !JSON.stringify(shape(attemptRow)).includes("380"));
check("a ratio outside 0..1 is refused",
      !("accuracy" in shape({ date: "2026-09-10", accuracy: 42 })));
check("the whole attempt row now yields nothing but the empty object",
      Object.keys(shape(attemptRow)).length === 0,
      JSON.stringify(shape(attemptRow)));

// The experiment's tallies: counts per arm, and nothing that names a word.
const tallies = shapeExperiment({
  etymology: { words: 9, outcomes: 4, correct: 3 },
  story: { words: 8, outcomes: 4, correct: 2, word: "government", attempt_text: "goverment" },
  say: { words: 7, outcomes: "4", correct: 1 },
  blend: { words: 6, outcomes: 3, correct: true },
  observant: { words: 1, outcomes: 1, correct: 1 },
});
check("experiment tallies keep the four arms' counts",
      tallies.etymology && tallies.etymology.correct === 3 && tallies.story && tallies.story.words === 8);
check("a word or her writing riding with the tallies is dropped",
      !JSON.stringify(tallies).includes("government") && !JSON.stringify(tallies).includes("goverment"));
check("an arm with a string or boolean count is dropped whole",
      !("say" in tallies) && !("blend" in tallies));
check("a word dressed as an arm is dropped", !("observant" in tallies));
check("the whole attempt row yields no tallies", Object.keys(shapeExperiment(attemptRow)).length === 0);

// The config is pasted by an adult, from the Firebase console, as JSON or as JS.
const pasted = `// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyExample-key_123",
  authDomain: "spelling-test.firebaseapp.com",
  databaseURL: "https://spelling-test-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "spelling-test",
  storageBucket: "spelling-test.appspot.com",
  messagingSenderId: "1234567890",
  appId: "1:1234567890:web:abcdef",
};`;
const cfg = parseConfig(pasted);
check("the console's JavaScript snippet is understood",
      cfg && cfg.projectId === "spelling-test" && cfg.databaseURL.endsWith("firebasedatabase.app"));
check("JSON works too", !!parseConfig(JSON.stringify(cfg)));
// What the console's "Add app" page actually shows: imports first, braces and all,
// then the config, then the code that uses it.
const whole = `// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

${pasted.replace("};", '  measurementId: "G-ABC123",\n};')}

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);`;
const fromWhole = parseConfig(whole);
check("the whole snippet, imports and all, is understood",
      fromWhole && fromWhole.databaseURL === cfg.databaseURL && fromWhole.appId === cfg.appId,
      JSON.stringify(fromWhole));
check("only the settings sync needs are kept", fromWhole && !("measurementId" in fromWhole));
check("a config without a Realtime Database URL is refused",
      parseConfig(pasted.replace(/databaseURL: "[^"]*",/, "")) === null);
check("a database URL that is not Firebase's is refused",
      !validConfig({ ...cfg, databaseURL: "https://example.com" }));
check("nonsense is refused", parseConfig("hello") === null && parseConfig("") === null);

console.log(`\n${failures ? `${failures} CHECK(S) FAILED` : "all checks passed"}\n`);
process.exit(failures ? 1 : 0);
