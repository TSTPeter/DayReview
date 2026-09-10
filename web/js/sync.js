// Firebase sync — AGGREGATES ONLY.
//
// WHAT THIS DELIBERATELY DOES NOT SEND.
//
// docs/05 decision 2: "no child's writing ever leaves our tenancy", and
// docs/06 concentrates the whole data-protection risk in one place — free
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
// per-attempt field names — a day has a `correct` COUNT, an attempt has a
// `correct` BOOLEAN — so a name-only allowlist would let a raw attempt row's
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
let failed = false;

export function isConfigured() { return !!config; }

/**
 * Load config, but only when an adult has switched sync on.
 *
 * ICO Children's code standard 7 is high privacy BY DEFAULT, so off is the
 * resting state and nothing is fetched, attempted or reported until someone
 * deliberately changes it. It also means the app makes no network request at
 * all on a normal launch, which is what keeps the offline promise honest.
 */
export async function load(enabled = false) {
  if (!enabled) { config = null; return false; }
  if (config) return true;
  try {
    const res = await fetch("data/firebase.json", { cache: "no-store" });
    if (!res.ok) return false;
    const cfg = await res.json();
    if (!cfg || !cfg.databaseURL) return false;
    config = cfg;
    return true;
  } catch {
    return false;   // no config file is the normal, supported state
  }
}

async function connect() {
  if (db || failed) return db;
  if (!config || !navigator.onLine) return null;
  try {
    const [{ initializeApp }, { getDatabase }] = await Promise.all([
      import(`${SDK}/firebase-app.js`),
      import(`${SDK}/firebase-database.js`),
    ]);
    db = getDatabase(initializeApp(config));
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

/**
 * Push one day's aggregates. Returns "sent" | "offline" | "off" | "error".
 * Never throws, never blocks the practice loop.
 */
export async function pushDay(learnerKey, day) {
  if (!config) return "off";
  const payload = shape({ ...day, updated_at: new Date().toISOString() });
  if (!payload.date) return "error";
  const conn = await connect();
  if (!conn) return navigator.onLine ? "error" : "offline";
  try {
    const { ref, set } = await import(`${SDK}/firebase-database.js`);
    await set(ref(conn, `learners/${learnerKey}/days/${payload.date}`), payload);
    return "sent";
  } catch {
    return "error";
  }
}

/** Push the rolling profile. Same allowlist, same guarantees. */
export async function pushProfile(learnerKey, profile) {
  if (!config) return "off";
  const conn = await connect();
  if (!conn) return navigator.onLine ? "error" : "offline";
  try {
    const { ref, set } = await import(`${SDK}/firebase-database.js`);
    await set(ref(conn, `learners/${learnerKey}/profile`), shape({
      ...profile, updated_at: new Date().toISOString(),
    }));
    return "sent";
  } catch {
    return "error";
  }
}
