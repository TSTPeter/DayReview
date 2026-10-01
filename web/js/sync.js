// Firebase sync: AGGREGATES ONLY.
//
// WHAT THIS DELIBERATELY DOES NOT SEND.
//
// docs/05 decision 2: "no child's writing ever leaves our tenancy", and
// docs/06 concentrates the whole data-protection risk in one place: free
// text written by a child. Her attempts ARE that free text: 'goverment' for
// 'government' is a nine-year-old's writing, and the keystroke timings are a
// behavioural trace of her using a device.
//
// So none of it is sent. What goes to Firebase is the arithmetic Peter needs
// to see from his phone: how many, how often, how accurate, which rules are
// strong. Enough to answer "is this working?", not enough to reconstruct a
// single thing she wrote.
//
// The payload is built by an ALLOWLIST, field by field, never by spreading an
// attempt row and deleting the awkward parts. A filter fails open when a new
// field is added upstream; an allowlist fails closed. tests/test_sync_shape.py
// asserts the forbidden fields cannot appear.
//
// FAILING SOFT IS A REQUIREMENT, NOT A COURTESY. Practice must work with the
// wifi off (docs/05 decision 6). The SDK is imported lazily, only when a
// config exists and the device is online, and every failure path is a silent
// no-op. Nothing in the practice loop ever awaits this.

const SDK = "https://www.gstatic.com/firebasejs/10.12.2";

// The complete set of keys that may ever be transmitted, each with the type a
// DAY-LEVEL aggregate must have.
//
// The type matters as much as the name. Several day-level names collide with
// per-attempt field names. A day has a `correct` COUNT, an attempt has a
// `correct` BOOLEAN, so a name-only allowlist would let a raw attempt row's
// values ride through. Checking the type as well makes that impossible:
// tests/test_sync_shape.mjs caught exactly this.
const SCHEMA = Object.freeze({
  date: "string",
  attempts: "count",
  correct: "count",
  accuracy: "ratio",
  minutes: "count",
  phonological_reliance: "ratio",
  orthographic_choice_rate: "ratio",
  delayed_7: "ratio",
  delayed_28: "ratio",
  transfer_on: "ratio",
  transfer_off: "ratio",
  patterns_cracked: "count",
  typing_median_ms: "count",
  pattern_strength: "ratiomap",
  updated_at: "string",
});

export const ALLOWED = Object.freeze(Object.keys(SCHEMA));

// Named so the reason is visible at the point of prohibition.
export const FORBIDDEN = Object.freeze([
  "attempt_text",   // her actual writing
  "raw",            // ditto, pre-normalisation
  "error_detail",   // quotes the letters she wrote
  "trap",
  "latency_ms", "keystroke_count", "edits_before_submit",  // behavioural trace
  "median_inter_key_ms",   // per-attempt; only a DAY median may be sent, as typing_median_ms
  "word",           // which word she failed is not needed to see the trend
  "session_id", "id",
]);

let config = null;
let db = null;
let uid = null;
let failed = false;

export function isConfigured() { return !!config; }
export const whoAmI = () => uid;

const REQUIRED = ["apiKey", "authDomain", "databaseURL", "projectId", "appId"];

/** Is this a Firebase web config with a Realtime Database URL? */
export function validConfig(c) {
  if (!c || typeof c !== "object") return false;
  if (!REQUIRED.every((k) => typeof c[k] === "string" && c[k].length && c[k].length < 200)) return false;
  return /^https:\/\/[a-z0-9-]+(\.[a-z0-9-]+)*\.(firebaseio\.com|firebasedatabase\.app)\/?$/
    .test(c.databaseURL);
}

/**
 * Read what the Firebase console gives you to paste: either JSON, or the snippet
 * `const firebaseConfig = { apiKey: "...", ... };`. Returns the config, or null.
 */
export function parseConfig(text) {
  if (!text) return null;
  // The object that holds apiKey. The console's snippet opens with imports that have
  // braces of their own, and none of the config's values contain one.
  const key = text.search(/["']?apiKey["']?\s*:/);
  const open = key < 0 ? -1 : text.lastIndexOf("{", key);
  const close = key < 0 ? -1 : text.indexOf("}", key);
  if (open < 0 || close < 0) return null;
  const body = text.slice(open, close + 1);
  const json = body
    .replace(/^\s*\/\/[^\n]*$/gm, "")                  // comment lines, not the // in a URL
    .replace(/([{,]\s*)([A-Za-z_][A-Za-z0-9_]*)\s*:/g, '$1"$2":')   // bare keys
    .replace(/'([^']*)'/g, '"$1"')                      // single quotes
    .replace(/,\s*}/g, "}");                            // a trailing comma
  try {
    const c = JSON.parse(json);
    const out = {};
    for (const k of [...REQUIRED, "storageBucket", "messagingSenderId"]) if (c[k]) out[k] = String(c[k]);
    return validConfig(out) ? out : null;
  } catch {
    return null;
  }
}

/**
 * Switch sync on, with the config an adult pasted into the grown-up view on THIS
 * iPad and kept in its IndexedDB. The public site never serves one, and
 * tools/deploy_to_site.py refuses to ship one, so no other device syncs anything.
 *
 * ICO Children's code standard 7 is high privacy BY DEFAULT, so off is the resting
 * state: nothing is fetched, attempted or reported until someone changes it, and a
 * normal launch makes no network request at all.
 */
export function load(enabled = false, cfg = null) {
  config = null; db = null; uid = null; failed = false;
  if (!enabled || !validConfig(cfg)) return false;
  config = cfg;
  return true;
}

async function connect() {
  if (db || failed) return db;
  if (!config || !navigator.onLine) return null;
  try {
    const [{ initializeApp, getApps }, { getAuth, signInAnonymously }, { getDatabase }] =
      await Promise.all([
        import(`${SDK}/firebase-app.js`),
        import(`${SDK}/firebase-auth.js`),
        import(`${SDK}/firebase-database.js`),
      ]);
    // Named by project, so a changed config never reuses a stale app.
    const name = `spelling-${config.projectId}`;
    const fb = getApps().find((a) => a.name === name) || initializeApp(config, name);
    // Anonymous sign-in: an opaque id, no account, no name, no email. The database
    // rules (firebase/database.rules.json) let this id write its own record only.
    const cred = await signInAnonymously(getAuth(fb));
    uid = cred.user.uid;
    db = getDatabase(fb);
    return db;
  } catch {
    failed = true;   // offline, blocked, or misconfigured: stop trying
    return null;
  }
}

function valid(kind, v) {
  switch (kind) {
    case "string": return typeof v === "string" && v.length <= 64;
    // A count is a non-negative whole number. An attempt row's boolean
    // `correct` is not one, so it cannot masquerade as a day's tally.
    case "count":  return typeof v === "number" && Number.isFinite(v) &&
                          v >= 0 && Number.isInteger(v);
    case "ratio":  return typeof v === "number" && Number.isFinite(v) &&
                          v >= 0 && v <= 1;
    case "ratiomap": return v && typeof v === "object" && !Array.isArray(v);
    default: return false;
  }
}

/** Keep only allowlisted keys carrying the right kind of value. */
export function shape(aggregate) {
  const out = {};
  for (const [key, kind] of Object.entries(SCHEMA)) {
    const v = aggregate[key];
    if (v === undefined || v === null) continue;
    if (!valid(kind, v)) continue;
    if (kind === "ratiomap") {
      // pattern -> 0..1. Rule names come from words.py and values are
      // proportions; neither reveals anything she wrote.
      const m = {};
      for (const [k, n] of Object.entries(v)) if (valid("ratio", n)) m[k] = n;
      if (Object.keys(m).length) out[key] = m;
    } else {
      out[key] = v;
    }
  }
  return out;
}

// The experiment's tallies (experiments/2026-10-support-types.md): for each arm, how
// many words have had help, how many reached the delayed check, how many were right.
// Counts only. Which words, and what she wrote, never leave the device.
export const EXPERIMENT_ARMS = Object.freeze(["etymology", "story", "say", "blend"]);
const TALLY = Object.freeze(["words", "outcomes", "correct"]);

export function shapeExperiment(tallies) {
  const out = {};
  for (const arm of EXPERIMENT_ARMS) {
    const t = tallies && tallies[arm];
    if (!t || typeof t !== "object") continue;
    const row = {};
    for (const k of TALLY) if (valid("count", t[k])) row[k] = t[k];
    if (Object.keys(row).length === TALLY.length) out[arm] = row;
  }
  return out;
}

async function put(path, payload) {
  if (!config) return "off";
  const conn = await connect();
  if (!conn) return navigator.onLine ? "error" : "offline";
  try {
    const { ref, set } = await import(`${SDK}/firebase-database.js`);
    await set(ref(conn, `learners/${uid}/${path}`), payload);
    return "sent";
  } catch {
    return "error";
  }
}

/**
 * Push one day's aggregates. Returns "sent" | "offline" | "off" | "error".
 * Never throws, never blocks the practice loop.
 */
export async function pushDay(day) {
  if (!config) return "off";
  const payload = shape({ ...day, updated_at: new Date().toISOString() });
  if (!payload.date) return "error";
  return put(`days/${payload.date}`, payload);
}

/** Push the rolling profile. Same allowlist, same guarantees. */
export async function pushProfile(profile) {
  return put("profile", shape({ ...profile, updated_at: new Date().toISOString() }));
}

/** Push the experiment's tallies. Counts per arm, nothing else. */
export async function pushExperiment(tallies) {
  const payload = shapeExperiment(tallies);
  if (!Object.keys(payload).length) return "off";
  return put("experiment", { ...payload, updated_at: new Date().toISOString() });
}
