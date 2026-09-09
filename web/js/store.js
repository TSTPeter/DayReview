// IndexedDB. The attempt log IS the dataset; everything else is derived and disposable.
//
// docs/04: "Every attempt, one row, immutable. Never overwrite; the history is the
// dataset." The field names mirror db/schema.sql exactly so that moving to Postgres
// later is an insert, not a migration with a translation layer in the middle.
//
// Scope is one child on one device (see docs/06), so there is no learner_id and no
// account. If a second child ever uses this, that decision reopens the Children's code
// and a DPIA becomes legally mandatory before launch, not advisable. Read docs/06
// before adding a second row to anything.

const DB_NAME = "spelling";
const DB_VERSION = 1;

export const PROMPT_MODES = ["audio_sentence", "audio_word", "text_cloze", "dictation_paper"];

let dbPromise = null;

function open() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("attempts")) {
        const s = db.createObjectStore("attempts", { keyPath: "id", autoIncrement: true });
        s.createIndex("word", "word");
        s.createIndex("session_id", "session_id");
        s.createIndex("created_at", "created_at");
      }
      if (!db.objectStoreNames.contains("sessions")) {
        db.createObjectStore("sessions", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("kv")) {
        db.createObjectStore("kv", { keyPath: "key" });
      }
      if (!db.objectStoreNames.contains("profiles")) {
        db.createObjectStore("profiles", { keyPath: "id", autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx(store, mode, fn) {
  return open().then((db) => new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const result = fn(t.objectStore(store));
    t.oncomplete = () => resolve(result && result.result !== undefined ? result.result : result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  }));
}

function all(store, index = null, query = null) {
  return open().then((db) => new Promise((resolve, reject) => {
    const t = db.transaction(store, "readonly");
    const src = index ? t.objectStore(store).index(index) : t.objectStore(store);
    const req = src.getAll(query);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  }));
}

// --- attempts --------------------------------------------------------------

export function putAttempt(row) {
  // Immutable by construction: no id is ever supplied, so every write is an insert.
  const record = { ...row, created_at: row.created_at || new Date().toISOString() };
  delete record.id;
  return tx("attempts", "readwrite", (s) => s.add(record));
}

export const allAttempts = () => all("attempts");
export const attemptsForWord = (word) => all("attempts", "word", word);
export const attemptsForSession = (id) => all("attempts", "session_id", id);

// --- sessions --------------------------------------------------------------

export function startSession(kind) {
  const row = { id: crypto.randomUUID(), kind, started_at: new Date().toISOString(),
                ended_at: null };
  return tx("sessions", "readwrite", (s) => s.put(row)).then(() => row);
}

export async function endSession(id) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction("sessions", "readwrite");
    const store = t.objectStore("sessions");
    const get = store.get(id);
    get.onsuccess = () => {
      const row = get.result;
      if (row) { row.ended_at = new Date().toISOString(); store.put(row); }
      resolve(row);
    };
    get.onerror = () => reject(get.error);
  });
}

export const allSessions = () => all("sessions");

// --- scheduler state, preferences: mutable, derived, rebuildable -----------

export function getKV(key, fallback = null) {
  return open().then((db) => new Promise((resolve, reject) => {
    const req = db.transaction("kv", "readonly").objectStore("kv").get(key);
    req.onsuccess = () => resolve(req.result ? req.result.value : fallback);
    req.onerror = () => reject(req.error);
  }));
}

export const setKV = (key, value) => tx("kv", "readwrite", (s) => s.put({ key, value }));

export const saveProfile = (profile) =>
  tx("profiles", "readwrite", (s) => s.add({ ...profile, computed_at: new Date().toISOString() }));
export const allProfiles = () => all("profiles");

// --- export and delete -----------------------------------------------------
//
// docs/06 lists these as launch features the moment a second child uses this, not
// nice-to-haves. Built now because they are cheap now and awkward later.

export async function exportAll() {
  return {
    exported_at: new Date().toISOString(),
    schema: "spelling/1",
    attempts: await allAttempts(),
    sessions: await allSessions(),
    profiles: await allProfiles(),
    scheduler_state: await getKV("scheduler_state"),
    pattern_state: await getKV("pattern_state"),
  };
}

export async function hardDelete() {
  const db = await open();
  db.close();
  dbPromise = null;
  return new Promise((resolve, reject) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = () => resolve(true);
    req.onerror = () => reject(req.error);
    req.onblocked = () => resolve(false);
  });
}
