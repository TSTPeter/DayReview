// The six screens from docs/02, and nothing else.
//
//   1 attempt     hear the word in a sentence, type it. Nothing else on screen.
//   2 reveal      attempt marked against target, error named, morphemes, one line of why
//   3 rule card   the pattern, three sibling words
//   4 session end self-referenced progress. No streak, no days, no leaderboard.
//   5 diagnostic  the 24-word baseline probe, ON PAPER, styled as a challenge not a test
//   6 grown-up    error profile, pattern strengths, what to practise on paper
//
// The order things ship in is deliberate: docs/08 puts the scheduler before any reward
// system, because spacing is worth about 10.6 percentage points and rewards are not
// established. There is no reward system here at all.

import { classify, feedback, getOpcodes, normalise } from "./engine/classify.js";
import { Scheduler, addDays, today } from "./engine/schedule.js";
import { compute, narrate } from "./engine/profile.js";
import * as audio from "./audio.js";
import * as store from "./store.js";
import * as sfx from "./sfx.js";
import * as sync from "./sync.js";
import * as supports from "./supports.js";
import * as voice from "./voice.js";
import * as dash from "./dashboard.js";
import { Keystrokes, fluency } from "./keystrokes.js";
import { crackedPatterns, settle, renderWorld, artFor, assignArt } from "./rewards.js";
import * as weekly from "./engine/weekly.js";
import { NOUN_VERB_PAIRS, PAIR_RULE, makeEntry } from "./engine/derive.js";
import * as games from "./games.js";

const $ = (sel) => document.querySelector(sel);
const el = (tag, props = {}, kids = []) => {
  const n = document.createElement(tag);
  // dataset is a read-only accessor: Object.assign onto it throws in strict mode, and
  // ES modules are always strict. Handle it separately rather than losing the element.
  const { dataset, ...rest } = props;
  Object.assign(n, rest);
  if (dataset) for (const [k, v] of Object.entries(dataset)) n.dataset[k] = v;
  for (const k of [].concat(kids)) n.append(k);
  return n;
};

const SESSION_SIZE = 10;
const STRATEGY_EVERY = 5;   // docs/03: at most one item in five, never after a failure

const STRATEGY_OPTIONS = [
  ["sounded_out", "I sounded it out"],
  ["looked_right", "It looked right"],
  ["thought_about_parts", "I thought about the parts"],
  ["just_knew", "I just knew it"],
];

const app = {
  data: null, byWord: new Map(), sentences: {},
  curated: new Map(),        // statutory and off-list entries, as shipped
  authored: new Map(),       // the term's school words, written up by hand
  term: [],                  // the school's lists for the term (engine/term.py)
  scheduler: null, session: null, queue: [], index: 0,
  marks: [], strategy: [], keys: new Keystrokes(),
  mode: "practice",          // practice | probe
  probeItems: [], paperIndex: 0,
  audioOk: true,             // set by audio.working() at boot: the DEVICE voice
  prompt: { mode: null, source: null },   // how the item on screen was presented
  probeSources: [],          // voice per paper-probe item, written into its row
  cracked: new Set(),        // rules she has cracked, ever
  curios: [],                // surprise pieces, ever
  week: null,                // this week's list from school, or null
  screen: "home",            // the screen on show, so an update knows when it may reload
  version: null,             // data/version.json: which deploy this device is showing
};

// Whether a service worker already controlled this page when it loaded. If not, the
// worker that takes charge in a moment is the first install, not an update, and the
// page is already the newest there is.
const hadWorker = "serviceWorker" in navigator && !!navigator.serviceWorker.controller;

// --------------------------------------------------------------- boot

async function boot() {
  const [words, sentences, clips, term, gameData, supportData, version] = await Promise.all([
    fetch("data/words.json").then((r) => r.json()),
    fetch("data/sentences.json").then((r) => r.json()).catch(() => ({})),
    // Pre-rendered dictation (tools/render_audio.py). Missing or empty is fine: every
    // item then uses the device voice, exactly as before clips existed.
    fetch("data/audio.json").then((r) => r.json()).catch(() => ({})),
    // The school's lists for the whole term (engine/term.py). Missing is fine: the
    // adult can still paste a list each week, as before.
    fetch("data/term.json").then((r) => r.json()).catch(() => ({})),
    // The games' content (engine/games.py). Missing means the games hub says so.
    fetch("data/games.json").then((r) => r.json()).catch(() => ({ words: {}, weeks: {} })),
    // What a miss shows, and the experiment (engine/supports.py). Missing: no supports.
    fetch("data/supports.json").then((r) => r.json()).catch(() => null),
    // Which deploy this is (tools/deploy_to_site.py), for the grown-up view.
    fetch("data/version.json").then((r) => r.json()).catch(() => null),
  ]);
  audio.setClips(clips);
  app.version = version;
  app.data = words;
  app.sentences = sentences.sentences || {};
  app.unreviewed = new Set(sentences.unreviewed || []);
  app.games = gameData;
  app.term = term.weeks || [];
  for (const w of [...words.words, ...words.off_list]) app.curated.set(w.word, w);
  // The term's school words, written up by hand: origin, parts, why, family.
  app.authored = new Map((term.entries || []).map((e) => [e.word, e]));
  app.byWord = new Map(app.curated);
  assignArt(Object.keys(words.patterns));   // one distinct piece per rule
  // The experiment's arms, once its content is reviewed. Off until then.
  await supports.init(supportData, store,
    (w) => app.curated.get(w) || app.authored.get(w) || null);

  audio.setOverrides(await store.getKV("pronunciation_overrides", {}));
  applyComfort(await store.getKV("comfort", { size: "default", theme: "light" }));

  // Each Monday the term's list switches on by itself. A list the adult saved
  // this week is theirs and wins. See weekly.py choose_week().
  const stored = await store.getKV("weekly_list", null);
  app.week = weekly.chooseWeek(stored, weekly.scheduledWeek(app.term, today()));
  if (app.week !== stored) await store.setKV("weekly_list", app.week);
  await rebuildScheduler();

  games.init({
    $, el, show, store, sfx, supports,
    data: () => app.games,
    // The games follow the term's calendar, not an edited list: their content
    // is written per school week.
    week: () => weekly.scheduledWeek(app.term, today()),
    weeksSoFar: () => app.term.filter((w) => w.set_on <= today()),
    entryFor: (word) => app.byWord.get(word) || app.authored.get(word) || makeEntry(word),
    // The sentence she heard in the dictation, for Fill the gap.
    sentenceFor: (word) => app.sentences[word] || null,
    markedUp: (word, d) => markedUp(normalise(word), d.attempt, d.type === "hyphen" ? word : ""),
  });
  wire();
  games.wire();
  // Find out whether this device can speak BEFORE dictating into silence. With no
  // voice the prompt degrades to a cloze, which is still free-typed retrieval and
  // still never shows the spelling. prompt_mode records which one she actually got,
  // so the two are never pooled in analysis.
  app.audioOk = await audio.working();
  // The "no speech voice" note is now per item: set in playPrompt, shown only when the
  // item on screen actually fell back to the cloze.
  $("#attempt-noaudio").hidden = true;

  sfx.setMuted((await store.getKV("sound", "on")) === "off");
  // iOS keeps an AudioContext suspended until a real gesture, so the first
  // touch anywhere arms it for the session.
  const armOnce = () => {
    sfx.arm();
    audio.arm();
    window.removeEventListener("pointerdown", armOnce);
  };
  window.addEventListener("pointerdown", armOnce, { once: true });

  // The config is pasted on this iPad, in the grown-up view; the site never serves one.
  sync.load(await store.getKV("sync_enabled", false), await store.getKV("firebase_config", null));
  await loadCollection();
  await refreshHome();
  show("home");

  if ("serviceWorker" in navigator) {
    watchForUpdates();
    navigator.serviceWorker.register("sw.js").catch(() => {});
    navigator.serviceWorker.ready.then(warmClips).catch(() => {});
  }
}

/**
 * Build the scheduler over the statutory list PLUS this week's school words.
 *
 * The weekly words have to be in it from the start, not bolted on for the
 * week: that is what lets them fold into the Leitner boxes once the test is
 * past, which is the half of this feature that serves the actual goal.
 */
async function rebuildScheduler() {
  const state = await store.getKV("scheduler_state", null);
  const patterns = await store.getKV("pattern_state", null);
  // Every word the scheduler holds a record for needs an entry, not just this
  // week's. Last week's words stay in the saved state on purpose (that is the
  // spacing), and building entries for this week only made the first one of them
  // to come due crash the session. Rebuilt from the curated set each time, so a
  // second save in one sitting cannot drop words either.
  const wanted = [...new Set([...(app.week ? app.week.words : []),
                              ...Object.keys(state || {})])];
  // A term word gets its authored entry; any other school word is derived.
  const lookup = new Map([...app.curated, ...app.authored]);
  const extra = weekly.entriesFor(wanted, lookup).filter((e) => !app.curated.has(e.word));
  app.byWord = new Map(app.curated);
  for (const e of extra) app.byWord.set(e.word, e);
  app.scheduler = new Scheduler([...app.data.words, ...extra], today(), state, patterns);
}

async function loadCollection() {
  const attempts = await store.allAttempts();
  app.cracked = crackedPatterns(attempts, app.byWord);
  app.curios = await store.getKV("curios", []);
}

function paintWorld(el) {
  renderWorld(el, [...app.cracked], app.curios, ruleNames());
}

// Every rule card's text: the statutory patterns, plus the ones only a school
// word can carry (the hyphen rules). See engine/derive.py SCHOOL_PATTERNS.
function ruleNames() {
  return app.data ? { ...(app.data.school_patterns || {}), ...app.data.patterns } : {};
}

async function persistScheduler() {
  await store.setKV("scheduler_state", app.scheduler.state);
  await store.setKV("pattern_state", app.scheduler.patterns);
}

function applyComfort(c) {
  document.documentElement.dataset.comfort = c.size || "default";
  document.documentElement.dataset.theme = c.theme || "light";
}

/**
 * Fetch the clips she is about to need, so the next session works offline. Not all of
 * them: that is several megabytes on a first visit. This week's words and whatever the
 * scheduler has due are what the next session will be made of. Everything else is
 * cached as it is heard. The service worker stores each response on the way through.
 */
async function warmClips() {
  if (!navigator.onLine) return;
  if (navigator.connection && navigator.connection.saveData) return;
  // First visit: the worker has just installed and is not yet in charge of this
  // page, so nothing fetched now would be kept. Wait until it claims the page.
  if (!navigator.serviceWorker.controller) {
    await new Promise((resolve) => navigator.serviceWorker
      .addEventListener("controllerchange", resolve, { once: true }));
  }
  const words = new Set([...(app.week ? app.week.words : []),
                         ...app.scheduler.due().slice(0, SESSION_SIZE * 3)]);
  const urls = new Set();
  for (const w of words) {
    const sentence = app.sentences[w] || "";
    const hint = weekly.hintOf(app.week, w);
    for (const text of [audio.namingLine(w, hint), sentence]) {
      const url = text && audio.clipFor(text);
      if (url) urls.add(url);
    }
  }
  for (const url of urls) {
    // One at a time, read to the end, and give up quietly: a nicety, never a blocker.
    // Reading matters. fetch() resolves on the headers, so an unread body is a
    // request still open, and sixty of those would sit on the handful of connections
    // a browser allows per host: the clip she is actually waiting for would queue
    // behind them. The browser suite found this as a page that never went idle.
    try { await (await fetch(url)).arrayBuffer(); } catch { return; }
  }
}

// --------------------------------------------------------------- router

function show(name) {
  for (const s of document.querySelectorAll(".screen")) s.classList.toggle("on", s.id === `screen-${name}`);
  app.screen = name;
  // Back on the welcome page with a new version waiting: now it can load.
  if (name === "home" && updateReady) setTimeout(reloadIfSafe, 250);
  // Two guards ride on the router so neither can be forgotten at a call site:
  // dictation refuses to speak while the word is on screen (redundancy), and
  // effects refuse to sound at all while she is mid-attempt (coherence).
  audio.setWordVisible(name === "reveal" || name === "rule" || name === "paper-entry");
  sfx.setAttemptScreenUp(name === "attempt");
  // The item counter belongs to a session in progress and nowhere else.
  if (name !== "attempt" && name !== "reveal" && name !== "rule") {
    $("#attempt-count").textContent = "";
  }
  window.scrollTo(0, 0);
}

function setProgress(done, total) {
  $("#progress-bar").style.width = total ? `${Math.round((done / total) * 100)}%` : "0%";
}

// --------------------------------------------------------------- updates

// A deploy reaches a device through its service worker, which keeps the game in a cache
// so it works offline. On the first open after a deploy that cache still holds the old
// version: the new one downloads behind it and takes over a few seconds later (sw.js).
// The page on screen was drawn from the old cache, so it reloads itself, but only on
// the welcome page, where nothing is lost; anywhere else it waits until she is back
// there. Coming back to an open tab is not a reload, so a game left open checks again
// whenever it returns to the screen. Peter, 1 October 2026: the changes were live, and
// his Android phone went on showing the version it had saved.
let updateReady = false;

function watchForUpdates() {
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!hadWorker) return;        // the first install taking charge, not an update
    updateReady = true;
    reloadIfSafe();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible") return;
    navigator.serviceWorker.getRegistration()
      .then((r) => r && r.update()).catch(() => { /* offline: next time */ });
  });
}

function reloadIfSafe() {
  if (!updateReady || app.screen !== "home") return;
  updateReady = false;
  location.reload();
}

// --------------------------------------------------------------- home

async function refreshHome() {
  $("#home-sync-note").hidden = !sync.isConfigured();
  const attempts = await store.allAttempts();
  const name = await store.getKV("learner_name", "");
  $("#home-hello").textContent = name ? `Hi ${name}!` : "Hi there!";
  $("#home-summary").textContent = readyLine();
  paintWorld($("#home-world"));
  paintWeekCard();
  $("#home-probe-note").textContent = attempts.length
    ? "Re-run the challenge every half term. The change over time is the measure that matters."
    : "New here? Start with the challenge, so the app knows what to teach.";
}

// What is ready for her today, from the session she would actually get. This is
// the encouragement to come back, and it is the scheduler's spacing said out
// loud: a word is 'ready for another go' because its interval has come round,
// which is when practising it helps. Never a count of visits or days. docs/11.
function readyLine() {
  const queue = weekly.compose(app.scheduler, app.week, SESSION_SIZE, today());
  if (!queue.length) {
    const next = Object.values(app.scheduler.state).map((st) => st.due)
      .filter((d) => d > today()).sort()[0];
    return next
      ? `Nothing is due today. Your next words are ready on ${dayName(next)}.`
      : "Nothing is due today.";
  }
  const again = queue.filter((w) => (app.scheduler.state[w]?.seen || 0) > 0).length;
  const fresh = queue.length - again;
  const words = (n) => `${n} word${n === 1 ? "" : "s"}`;
  if (again && fresh) {
    return `${words(again)} ${again === 1 ? "is" : "are"} ready for another go, `
      + `and ${fresh} ${fresh === 1 ? "is" : "are"} new.`;
  }
  if (again) return `${words(again)} ${again === 1 ? "is" : "are"} ready for another go.`;
  return `${words(fresh)} ${fresh === 1 ? "is" : "are"} ready for you, all new.`;
}

function dayName(iso) {
  const days = Math.round((Date.parse(iso) - Date.parse(today())) / 86400000);
  if (days === 1) return "tomorrow";
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-GB",
    { weekday: "long", timeZone: "UTC" });
}

function paintWeekCard() {
  const card = $("#home-week");
  if (!app.week || !app.week.words.length) { card.hidden = true; return; }
  card.hidden = false;
  const left = weekly.daysUntil(app.week.test_on);
  const active = weekly.isActive(app.week);
  $("#home-week-tab").textContent = active ? "This week" : "Last week";
  $("#home-week-theme").hidden = !app.week.theme;
  $("#home-week-theme").textContent = app.week.theme ? app.week.theme : "";
  $("#home-week-words").textContent = app.week.words.join("  ·  ");
  $("#home-week-state").textContent = !active
    ? "Tested. These are still coming back, spaced out, so they stick."
    : left === 0 ? "Tested today."
    : left === 1 ? "Tested tomorrow."
    : `Tested in ${left} days.`;
}

// --------------------------------------------------------------- this week

// Written back WITH the tags, one per line, so editing the list a second time
// does not silently drop the noun/verb markers the school supplied.
function weekText(list) {
  if (!list) return "";
  return list.words
    .map((w) => (list.hints && list.hints[w] ? `${w} (${list.hints[w]})` : w))
    .join("\n");
}

function showWeek() {
  $("#week-input").value = weekText(app.week);
  $("#week-test").value = app.week ? app.week.test_on : weekly.nextTestDay();
  paintParsed();
  paintWeekSource();
  $("#week-note").textContent = "";
  show("week");
}

// Which list is in use, said plainly, with a way back to the school's own. "Clear it"
// holds the school's list off until Monday (clearWeek), and a list pasted over it does
// the same, so a device can be left without the week's words. Until this button the
// only way back was typing all fifteen words in again. Found 6 October 2026, when the
// school's list was in the app and live but a device was not showing it.
const sameList = (a, b) => !!a && !!b && a.test_on === b.test_on
  && a.words.length === b.words.length && a.words.every((w, i) => w === b.words[i]);

function paintWeekSource() {
  const school = weekly.scheduledWeek(app.term, today());
  const note = $("#week-source");
  const button = $("#week-school");
  if (!school) {                      // before the term, or no term loaded
    note.textContent = "";
    button.hidden = true;
    return;
  }
  const same = sameList(app.week, school);
  note.textContent = same
    ? "This is the school’s list for this week."
    : app.week && app.week.cleared
      ? "You cleared this week’s list. The school’s list is one tap away."
      : "This is not the school’s list for this week.";
  button.hidden = same;
}

async function useSchoolList() {
  const school = weekly.scheduledWeek(app.term, today());
  if (!school) return;
  app.week = { ...school };
  await store.setKV("weekly_list", app.week);
  await rebuildScheduler();
  await persistScheduler();
  await refreshHome();
  show("home");
}

function paintParsed() {
  const entries = weekly.parseEntries($("#week-input").value);
  const words = entries.map((e) => e.word);
  if (!words.length) { $("#week-parsed").textContent = ""; return; }
  // Say plainly which words the app knows properly and which it is reading
  // from the letters alone, so the thinner reveal is never a surprise.
  const curated = words.filter((w) => app.authored.has(w)
    || (app.byWord.has(w) && !app.byWord.get(w).derived));
  const parts = [`${words.length} word${words.length === 1 ? "" : "s"}`];
  // Show the tags back. If the school wrote '(N)' and the app did not read it,
  // that has to be visible here rather than discovered mid-dictation.
  const tagged = entries.filter((e) => e.hint);
  if (tagged.length) {
    parts.push(`${tagged.length} will be dictated with their word class `
      + `(${tagged.slice(0, 3).map((e) => `${e.word} = ${e.hint}`).join(", ")}`
      + `${tagged.length > 3 ? "\u2026" : ""})`);
  }
  if (curated.length) {
    parts.push(`${curated.length} already known in full (${curated.slice(0, 4).join(", ")}`
      + `${curated.length > 4 ? "…" : ""})`);
  }
  // The -ce/-se pairs were one instance of a general fault: a word that sounds
  // exactly like another, dictated as 'The word is X' twice with no sentence
  // and no word class, asks a question with no answer in it. A wrong answer
  // then records an error type that describes nothing. The ten pairs are
  // handled by NOUN_VERB_PAIRS; the rest of derive.HOMOPHONES are not, and
  // writing fifty sentences unreviewed would break docs/05's review gate. So
  // say so here instead of failing quietly during dictation.
  const unanswerable = entries.filter((e) =>
    !e.hint
    && !app.sentences[e.word]
    && (app.byWord.get(e.word) || makeEntry(e.word)).patterns.includes("homophone-trap"));
  if (unanswerable.length) {
    parts.push(`⚠ ${unanswerable.map((e) => e.word).join(", ")} `
      + `sound${unanswerable.length === 1 ? "s" : ""} like another word and the app `
      + `has no sentence to tell them apart. Add the word class in brackets, `
      + `like "${unanswerable[0].word} (noun)"`);
  }
  const rest = words.length - curated.length;
  if (rest) parts.push(`${rest} read from the spelling, so she'll get the rule but not the word history`);
  $("#week-parsed").textContent = parts.join(" · ");
}

async function saveWeek() {
  const words = weekly.parse($("#week-input").value);
  if (!words.length) {
    $("#week-note").textContent = "No words found. One per line, or separated by commas.";
    return;
  }
  const testOn = $("#week-test").value || weekly.nextTestDay();
  const theme = app.week && app.week.theme;
  app.week = weekly.makeList($("#week-input").value, today(), testOn);
  // An edit to the term's list is still that week's list, so keep its theme.
  if (theme) app.week.theme = theme;
  await store.setKV("weekly_list", app.week);
  await rebuildScheduler();
  await persistScheduler();
  await refreshHome();
  show("home");
}

async function clearWeek() {
  // Cleared means cleared until next Monday, not until the next reload: an empty
  // list dated this week holds off the term's list, which would otherwise return.
  const scheduled = weekly.scheduledWeek(app.term, today());
  app.week = scheduled
    ? { ...scheduled, words: [], hints: {}, set_on: today(), cleared: true }
    : null;
  await store.setKV("weekly_list", app.week);
  await rebuildScheduler();
  await refreshHome();
  show("home");
}

// --------------------------------------------------------------- 1. attempt

function startPractice() {
  app.mode = "practice";
  app.queue = weekly.compose(app.scheduler, app.week, SESSION_SIZE, today());
  app.index = 0;
  app.marks = [];
  app.strategy = [];
  store.startSession("practice").then((s) => { app.session = s; });
  nextItem();
}

function nextItem() {
  if (app.index >= app.queue.length) return endSession();
  setProgress(app.index, app.queue.length);
  const word = app.queue[app.index];
  const entry = app.byWord.get(word);

  $("#attempt-input").value = "";
  $("#attempt-input").disabled = false;
  $("#attempt-submit").disabled = true;
  $("#attempt-state").textContent = "";
  $("#attempt-hint").hidden = true;
  $("#attempt-count").textContent = `${app.index + 1} of ${app.queue.length}`;
  app.keys.reset();

  show("attempt");
  $("#attempt-input").focus();
  playPrompt(entry);
}

// Render the sentence with the target replaced by a blank. Returns a fragment rather
// than a string so the gap is a styled element, not a run of dashes.
function clozeFor(entry) {
  const frag = document.createDocumentFragment();
  const sentence = app.sentences[entry.word] || "";
  if (!sentence) { frag.append(el("span", { className: "gap" })); return frag; }
  // The word is [a-z] with at most internal hyphens (word_form in derive.py), and a
  // hyphen is literal outside a character class, so it is regex-safe.
  const parts = sentence.split(new RegExp(`\\b${entry.word}\\b`, "gi"));
  parts.forEach((part, i) => {
    if (part) frag.append(document.createTextNode(part));
    if (i < parts.length - 1) frag.append(el("span", { className: "gap" }));
  });
  return frag;
}

// Per ITEM, not per device. A clip plays with no device voice at all, so a Chromebook
// with no speech installed now hears curated words properly and only falls back to the
// cloze for a school word nobody rendered.
function canHear(word, sentence, hint) {
  return app.audioOk || audio.clipsCover(word, sentence, hint);
}

// 'advice' and 'advise' sound the same, and so do 'licence' and 'license'. Naming
// the word twice asks a question with no answer in it. The word class is the
// missing half of the prompt, so it is spoken with the word and then left on
// screen while she types. See engine/derive.py NOUN_VERB_PAIRS.
function showHint(hint) {
  const p = $("#attempt-hint");
  p.hidden = !hint;
  p.textContent = hint ? `It is the ${hint}.` : "";
}

async function playPrompt(entry) {
  const sentence = app.sentences[entry.word] || "";
  const hint = weekly.hintOf(app.week, entry.word);
  $("#attempt-noaudio").hidden = true;
  if (!canHear(entry.word, sentence, hint)) {
    app.prompt = { mode: "text_cloze", source: null };
    $("#attempt-noaudio").hidden = false;
    $("#attempt-cloze").hidden = false;
    $("#attempt-cloze").replaceChildren(clozeFor(entry));
    $("#attempt-state").textContent = "Read the sentence and fill in the missing word.";
    // No audio here, so there is no second channel to be redundant with.
    showHint(hint);
    $("#attempt-replay").disabled = true;
    $("#attempt-input").focus();
    return;
  }
  $("#attempt-cloze").hidden = true;
  $("#attempt-hint").hidden = true;
  $("#attempt-replay").disabled = true;
  // Set BEFORE dictating: if she submits mid-way the row still says which voice it was.
  app.prompt = { mode: "audio_sentence",
                 source: audio.clipsCover(entry.word, sentence, hint) ? "clip" : "device" };
  const labels = { word: "Listening\u2026", sentence: "In a sentence\u2026",
                   "word-again": "Once more\u2026", done: "" };
  const source = await audio.dictate(entry.word, sentence, {
    hint,
    onStep: (step) => { $("#attempt-state").textContent = labels[step] ?? ""; },
  });
  // null: cancelled by a submit or a replay, which owns the screen now.
  if (source === null) return;
  app.prompt.source = source;
  showHint(hint);
  $("#attempt-replay").disabled = false;
  $("#attempt-input").focus();
}

function submitAttempt() {
  const entry = app.byWord.get(app.queue[app.index]);
  const raw = $("#attempt-input").value;
  if (!raw.trim()) return;
  audio.cancel();
  recordAttempt(entry, raw, app.prompt).then((d) => showReveal(entry, d));
}

async function recordAttempt(entry, raw, prompt) {
  const d = classify(raw, entry);
  const st = app.scheduler.state[entry.word];
  const boxBefore = st ? st.box : null;
  const prior = await store.attemptsForWord(entry.word);
  const last = prior.length ? prior[prior.length - 1].created_at : null;

  if (st) app.scheduler.record(entry.word, d.correct, d.patterns);

  const row = {
    session_id: app.session ? app.session.id : null,
    word: entry.word,
    prompt_mode: prompt.mode,
    // "clip" (pre-rendered), "device", "mixed" (a clip failed and the device voice
    // covered it), or null for a cloze. Two voices are two stimuli; recorded so an
    // analysis can separate them, the same reason prompt_mode exists.
    audio_source: prompt.source,
    attempt_text: d.raw,
    correct: d.correct,
    error_type: d.type,
    error_detail: d.detail,
    error_patterns: d.patterns,
    sounds_right: d.sounds_right,
    trap: d.trap,
    mark_scheme: d.mark_scheme,
    method_shown: null,       // the ladder is off. docs/08 M5.
    // experiments/2026-10-support-types.md: the word's arm (null before it starts),
    // and the support a miss puts on the answer screen.
    arm: supports.armOf(entry.word),
    support_shown: !d.correct && supports.armOf(entry.word) ? supports.armOf(entry.word) : null,
    box_before: boxBefore,
    box_after: st ? st.box : null,
    days_since_last: last
      ? Math.round((Date.now() - Date.parse(last)) / 86400000) : null,
    position_in_session: app.index + 1,
    on_list: entry.on_list !== false,
    ...app.keys.summary(),
  };
  await store.putAttempt(row);
  await persistScheduler();
  app.marks.push({ entry, diagnosis: d, row });
  return d;
}

// --------------------------------------------------------------- 2. reveal

function markedUp(target, attempt, word = "") {
  // Show HER letters, with the wrong ones marked, against the target. docs/01: the
  // feedback that works is task and process level (d = 0.99), not "correct/wrong"
  // (d = 0.24). Note we never display a misspelling as the OBJECT of study: DysEggxia
  // deliberately does that and docs/01 flags it as a choice we do not copy.
  const frag = document.createDocumentFragment();
  if (!attempt) { frag.append(el("span", { className: "miss", textContent: "(nothing typed)" })); return frag; }
  // Every letter right, hyphen missing: her letters, with a gap marked where the
  // hyphen belongs. The aligner compares letters only, so it cannot show this.
  if (word.includes("-") && attempt === target) {
    word.split("-").forEach((part, i) => {
      if (i) frag.append(el("span", { className: "miss", textContent: "-" }));
      frag.append(el("span", { className: "ok", textContent: part }));
    });
    return frag;
  }
  for (const [tag, i1, i2, j1, j2] of getOpcodes(target, attempt)) {
    if (tag === "equal") frag.append(el("span", { className: "ok", textContent: attempt.slice(j1, j2) }));
    else if (tag === "insert" || tag === "replace") frag.append(el("span", { className: "bad", textContent: attempt.slice(j1, j2) }));
    else if (tag === "delete") frag.append(el("span", { className: "miss", textContent: "·".repeat(Math.max(1, i2 - i1)) }));
  }
  return frag;
}

function showReveal(entry, d) {
  const f = feedback(d, entry);
  const v = $("#reveal-verdict");
  v.className = `verdict ${d.correct ? "right" : "wrong"}`;
  v.textContent = d.correct ? "Correct." : f.headline;

  $("#reveal-marked").replaceChildren(markedUp(normalise(entry.word), d.attempt,
    d.type === "hyphen" ? entry.word : ""));
  $("#reveal-target").textContent = entry.word;
  $("#reveal-target-wrap").hidden = d.correct;
  $("#reveal-detail").textContent = d.correct ? "" : d.detail;
  $("#reveal-detail").hidden = d.correct;

  // A school word we only know from its letters has no origin, no morphemes
  // and no word family. Hiding that card is the honest answer: a guessed root
  // told to a child is worse than a missing one. She still gets the marking,
  // the named error and the rule. See docs/12. The term's words are written up
  // by hand (engine/games.py), so they show it.
  $("#reveal-about").hidden = !entry.root;

  $("#reveal-morph").innerHTML = "";
  entry.morph.split("+").forEach((m, i, arr) => {
    $("#reveal-morph").append(el("b", { textContent: m }));
    if (i < arr.length - 1) $("#reveal-morph").append(document.createTextNode(" + "));
  });
  $("#reveal-origin").textContent = `${entry.lang}: ${entry.root}, ${entry.gloss}`;
  $("#reveal-why").textContent = entry.why;
  $("#reveal-siblings").replaceChildren(
    ...entry.family.slice(0, 3).map((w) => el("span", { textContent: w })));
  $("#reveal-rule-btn").hidden = !entry.patterns.length;

  // Once the experiment runs, where it comes from and its family belong to the
  // etymology arm, so they leave the card everyone sees; the baseline keeps the parts
  // and the why. A miss then gets the word's own support. Before it runs, nothing
  // here changes. experiments/2026-10-support-types.md.
  const inExp = supports.inExperiment(entry.word);
  $("#reveal-origin-part").hidden = inExp;
  $("#reveal-family-part").hidden = inExp;
  const card = !d.correct && inExp ? supports.render(entry.word) : null;
  $("#reveal-support").replaceChildren(...(card ? [card] : []));
  $("#reveal-support").hidden = !card;
  if (card) supports.logShown(entry.word, "dictation");

  // docs/03: ask at most one item in five, and NEVER after a failure.
  const askStrategy = d.correct && (app.index + 1) % STRATEGY_EVERY === 0;
  $("#reveal-strategy").hidden = !askStrategy;

  show("reveal");
  // Informational, not celebratory. A wrong answer is the most useful event
  // in this app and must not sound like a buzzer (Shute 2008: praise
  // sparingly, no normative comparison).
  sfx.play(d.correct ? "correct" : "notyet");
  $("#reveal-next").focus();
}

function answerStrategy(key) {
  app.strategy.push(key);
  $("#reveal-strategy").hidden = true;
}

// --------------------------------------------------------------- 3. rule card

function showRule() {
  const entry = app.byWord.get(app.queue[app.index]);
  const key = entry.patterns[0];
  if (!key) { show("reveal"); return; }
  const pair = NOUN_VERB_PAIRS.get(entry.word);
  $("#rule-name").textContent = pair ? "noun or verb" : key.replace(/-/g, " ");
  // For the -ce/-se pairs the generic homophone card is true and useless. This
  // is one of the few completely regular spelling rules in English, so say it.
  $("#rule-explain").textContent = pair ? PAIR_RULE : (ruleNames()[key] || "");
  const siblings = pair
    ? [...NOUN_VERB_PAIRS.keys()].filter((w) => w !== entry.word).map((word) => ({ word }))
        .slice(0, 6)
    // Every word the app holds, the week's school words included: the hyphen
    // rules have no statutory words, so their siblings are all on the list.
    : [...app.byWord.values()]
        .filter((w) => w.word !== entry.word && w.patterns.includes(key))
        .slice(0, 6);
  $("#rule-siblings").replaceChildren(...siblings.map((w) => el("span", { textContent: w.word })));
  const worked = entry.morph && entry.morph !== "-"
    ? `${entry.word}  =  ${entry.morph.replace(/\+/g, " + ")}` : entry.word;
  $("#rule-worked").textContent = pair ? `${entry.word} (the ${pair})` : worked;
  $("#rule-why").textContent = pair
    ? `Its partner is the ${pair === "noun" ? "verb" : "noun"}, spelled the other way.`
    : (entry.why || "");
  show("rule");
}

// --------------------------------------------------------------- 4. session end

async function endSession() {
  setProgress(1, 1);
  if (app.session) await store.endSession(app.session.id);

  const right = app.marks.filter((m) => m.diagnosis.correct).length;
  const moved = app.marks.filter((m) => m.row.box_after > m.row.box_before).length;

  // Rules cracked: patterns where every item this session was right, and there was
  // more than one. Self-referenced mastery, which docs/02 identifies as the motivational
  // mechanism that does not backfire.
  const seen = {}, ok = {};
  for (const m of app.marks) {
    for (const p of m.entry.patterns) {
      seen[p] = (seen[p] || 0) + 1;
      if (m.diagnosis.correct) ok[p] = (ok[p] || 0) + 1;
    }
  }
  const cracked = Object.keys(seen).filter((p) => seen[p] >= 2 && ok[p] === seen[p]);

  $("#end-right").textContent = `${right} of ${app.marks.length}`;
  $("#end-moved").textContent = String(moved);
  $("#end-cracked").replaceChildren(
    cracked.length
      ? el("span", { textContent: cracked.map((c) => c.replace(/-/g, " ")).join(", ") })
      : el("span", { className: "muted", textContent: "none clean this time, which is normal" }));

  const weak = app.scheduler.weakPatterns().slice(0, 3);
  $("#end-next").textContent = weak.length
    ? `Next time the app will bring in more words that use: ${weak.map((w) => w.replace(/-/g, " ")).join(", ")}.`
    : "";

  if (app.strategy.length) await store.setKV("strategy_log",
    [...(await store.getKV("strategy_log", [])), ...app.strategy]);

  // What did she crack, across all history, that she had not cracked before?
  const before = new Set(app.cracked);
  await loadCollection();
  const newly = [...app.cracked].filter((p) => !before.has(p));

  const outcome = settle(newly, app.curios);
  if (outcome.curio) {
    app.curios = [...app.curios, outcome.curio.key];
    await store.setKV("curios", app.curios);
  }
  renderUnlocks($("#end-unlocks"), outcome);
  paintWorld($("#end-world"));
  sfx.play(outcome.curio || newly.length ? "unlock" : "complete");

  const name = await store.getKV("learner_name", "");
  $("#screen-end h1").textContent = name ? `Done for now, ${name}` : "Done for now";

  await pushAggregates();
  await refreshHome();
  show("end");
}

function renderUnlocks(host, outcome) {
  host.replaceChildren();
  const names = ruleNames();
  for (const pattern of outcome.pieces) {
    const card = el("div", { className: "unlock" });
    const art = el("div", { className: "art" });
    art.innerHTML = artFor(pattern);
    const text = el("div");
    text.append(el("p", { style: "margin:0;font-weight:800",
                          textContent: `You cracked ${pattern.replace(/-/g, " ")}.` }));
    text.append(el("p", { className: "small muted", style: "margin:.2rem 0 0",
                          textContent: names[pattern] || "" }));
    card.append(art, text);
    host.append(card);
  }
  if (outcome.curio) {
    const card = el("div", { className: "unlock" });
    const art = el("div", { className: "art" });
    art.innerHTML = outcome.curio.art;
    const text = el("div");
    text.append(el("p", { style: "margin:0;font-weight:800", textContent: outcome.curio.line }));
    card.append(art, text);
    host.append(card);
  }
}

/**
 * Send the day's arithmetic, and only the arithmetic, and the experiment's tallies.
 * sync.js enforces the allowlist; this function must never hand it an attempt row.
 * The record is filed under the anonymous sign-in's id (sync.js), never a name:
 * docs/06 standard 8.
 */
async function pushAggregates() {
  if (!sync.isConfigured()) return;
  try {
    const attempts = await store.allAttempts();
    const days = dash.byDay(attempts);
    const today = new Date().toISOString().slice(0, 10);
    const d = days[today];
    let result = "off";
    if (d) {
      result = await sync.pushDay({
        date: today, attempts: d.attempts, correct: d.correct,
        accuracy: d.attempts ? d.correct / d.attempts : null,
        patterns_cracked: app.cracked.size,
        // day-level median, never the per-attempt figure
      });
    }
    if (supports.live()) {
      const per = supports.outcomes(attempts, await store.getKV("support_log", []));
      await sync.pushExperiment(supports.tallies(per));
    }
    await store.setKV("sync_status", { at: new Date().toISOString(), result });
  } catch { /* sync never blocks practice */ }
}

// --------------------------------------------------------------- 5. diagnostic (paper)

function startProbe() {
  app.mode = "probe";
  // The word list comes precomputed from engine/probe.py via export.py. Re-deriving the
  // selection rule here would be a third implementation with nothing holding it to the
  // Python one. docs/03 wants a different sample each half term, so the run number
  // advances after each completed probe and wraps around the year.
  const runs = Object.keys(app.data.probes).length;
  const run = Number(localStorage.getItem("probe_run") || "0") % runs;
  const words = app.data.probes[String(run)] || [];
  app.probeItems = words.map((w) => app.byWord.get(w)).filter(Boolean);
  app.paperIndex = 0;
  show("probe-intro");
}

async function dictateProbe() {
  show("probe-dictate");
  for (let i = 0; i < app.probeItems.length; i++) {
    app.paperIndex = i;
    const entry = app.probeItems[i];
    $("#probe-count").textContent = `Word ${i + 1} of ${app.probeItems.length}`;
    setProgress(i, app.probeItems.length);
    const sentence = app.sentences[entry.word] || "";
    if (canHear(entry.word, sentence, null)) {
      $("#probe-cloze").hidden = true;
      app.probeSources[i] = audio.clipsCover(entry.word, sentence) ? "clip" : "device";
      const source = await audio.dictate(entry.word, sentence);
      if (source) app.probeSources[i] = source;
    } else {
      app.probeSources[i] = null;
      $("#probe-cloze").hidden = false;
      $("#probe-cloze").replaceChildren(clozeFor(entry));
    }
    // The child is writing. The app waits, and shows nothing but the count.
    await new Promise((resolve) => {
      $("#probe-next").onclick = resolve;
      $("#probe-next").disabled = false;
    });
    $("#probe-next").disabled = true;
  }
  buildPaperEntry();
}

function buildPaperEntry() {
  const list = $("#paper-list");
  list.replaceChildren();
  app.probeItems.forEach((entry, i) => {
    const row = el("div", { className: "sheet" });
    row.append(el("div", { className: "tab", textContent: `${i + 1}. ${entry.word}` }));
    row.append(el("input", {
      type: "text", className: "spell", dataset: { word: entry.word },
      autocapitalize: "none", autocomplete: "off", spellcheck: false,
      placeholder: "type exactly what she wrote",
    }));
    list.append(row);
  });
  show("paper-entry");
}

async function submitPaper() {
  const session = await store.startSession("baseline_probe");
  app.session = session;
  app.marks = [];
  const inputs = [...document.querySelectorAll("#paper-list input")];
  for (let i = 0; i < inputs.length; i++) {
    const input = inputs[i];
    const entry = app.byWord.get(input.dataset.word);
    const d = classify(input.value, entry);
    await store.putAttempt({
      session_id: session.id, word: entry.word,
      prompt_mode: "dictation_paper",     // docs/07: measurement runs on paper
      audio_source: app.probeSources[i] ?? null,
      attempt_text: (input.value || "").trim(), correct: d.correct,
      error_type: d.type, error_detail: d.detail, error_patterns: d.patterns,
      sounds_right: d.sounds_right, trap: d.trap, mark_scheme: d.mark_scheme,
      method_shown: null, arm: supports.armOf(entry.word), support_shown: null,
      box_before: null, box_after: null, days_since_last: null,
      position_in_session: i + 1, on_list: entry.on_list !== false,
      latency_ms: null, keystroke_count: null, edits_before_submit: null,
      median_inter_key_ms: null,
    });
    app.marks.push({ entry, diagnosis: d });
  }
  await store.endSession(session.id);
  const profile = compute(app.marks, await store.getKV("strategy_log", []));
  await store.saveProfile(profile);
  localStorage.setItem("probe_run", String(Number(localStorage.getItem("probe_run") || "0") + 1));
  await showGrownUp();
}

// --------------------------------------------------------------- 6. grown-up view

async function showGrownUp() {
  $("#gu-share-send").hidden = !navigator.share;
  $("#gu-share-note").textContent = "";
  const attempts = await store.allAttempts();
  const marks = attempts.map((a) => {
    const entry = app.byWord.get(a.word);
    return entry ? { entry, diagnosis: classify(a.attempt_text, entry) } : null;
  }).filter(Boolean);

  const p = compute(marks, await store.getKV("strategy_log", []));
  const pct = (v) => (v === null || v === undefined ? "-" : `${Math.round(v * 100)}%`);

  // The four numbers docs/04 says matter, and none of the ones it says do not.
  $("#gu-phon").textContent = pct(p.phonological_reliance);
  $("#gu-ortho").textContent = pct(p.orthographic_choice_rate);
  $("#gu-transfer").textContent =
    `${pct(p.transfer.on_list)} taught / ${pct(p.transfer.off_list)} untaught`;
  $("#gu-items").textContent = `${p.items} attempts, confidence ${p.confidence}`;

  const delayed = delayedAccuracy(attempts);
  $("#gu-delayed").textContent =
    `${pct(delayed.d7)} at 7 days / ${pct(delayed.d28)} at 28 days`;

  $("#gu-narrative").replaceChildren(...narrate(p).map((t) => el("p", { textContent: t })));

  dash.renderPatterns($("#gu-patterns"), p.pattern_strength);

  // Habit metrics: daily use and consistency. Adult-facing, by design.
  const days = dash.byDay(attempts);
  const { scale } = dash.renderCalendar($("#gu-calendar"), days);
  dash.renderLegend($("#gu-legend"), scale);
  dash.renderTable($("#gu-table"), days);
  const c = dash.consistency(days);
  $("#gu-consistency").textContent = c.rate === null
    ? "No practice recorded yet."
    : `Practised on ${c.practised} of the last ${c.available} days `
      + `(${Math.round(c.rate * 100)}%).`;

  const syncOn = await store.getKV("sync_enabled", false);
  $("#opt-sync").value = syncOn ? "on" : "off";
  const weekCard = $("#gu-week");
  if (app.week && app.week.words.length) {
    weekCard.hidden = false;
    const c = weekly.coverage(app.week, app.scheduler);
    const when = c.days_left > 0 ? `Tested in ${c.days_left} days.`
               : c.days_left === 0 ? "Tested today."
               : "Tested. Still in rotation.";
    $("#gu-week-summary").textContent =
      `${c.practised} of ${c.words} practised so far, ${c.secure} looking secure. ${when}`;
    $("#gu-week-words").replaceChildren(...app.week.words.map((w) => {
      const st = app.scheduler.state[w] || {};
      const chip = el("span", { textContent: w });
      if (!st.seen) chip.className = "word-chip untouched";
      return chip;
    }));
  } else {
    weekCard.hidden = true;
  }

  const status = await store.getKV("sync_status", null);
  const when = status ? new Date(status.at).toLocaleString() : "";
  $("#gu-fb-config").hidden = !syncOn;
  $("#gu-sync-state").textContent = !syncOn
    ? "Off. Everything stays on this device and the app makes no network calls."
    : sync.isConfigured()
      ? "On. Only counts and percentages are sent, never her writing or keystrokes."
        + (status ? ` Last tried ${when}: ${status.result}.` : " Nothing sent yet: it sends at the end of a practice session.")
      : "On, but there is no Firebase config on this iPad yet. Paste it below.";

  const medians = attempts.map((a) => a.median_inter_key_ms).filter((x) => x != null);
  const f = fluency(medians);
  $("#gu-fluency").textContent = f.median_inter_key_ms
    ? `${f.median_inter_key_ms} ms between keys. ${f.note}` : f.note;

  $("#opt-name").value = await store.getKV("learner_name", "");
  await paintGamesSummary();
  await paintExperiment();
  const drafts = app.week ? app.week.words.filter((w) => app.unreviewed.has(w)) : [];
  $("#gu-week-drafts").hidden = !drafts.length;
  $("#gu-week-drafts").textContent = drafts.length
    ? `Draft sentences waiting for you to check (engine/sentences.py, UNREVIEWED): `
      + `${drafts.join(", ")}. Until they are checked these use the iPad's own voice.`
    : "";

  // Which deploy this device is showing, so a grown-up can tell whether a change has
  // reached it. A newer one installs itself on the welcome page (see "updates").
  const v = app.version;
  const made = v && /^\d{4}-\d{2}-\d{2}$/.test(v.synced || "")
    ? new Date(`${v.synced}T12:00:00Z`).toLocaleDateString("en-GB",
      { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })
    : null;
  $("#gu-version").textContent = v && v.stamp && v.stamp !== "dev"
    ? `This device has the version ${made ? `of ${made} ` : ""}(${v.stamp}). A newer `
      + "version installs itself a few seconds after the game is opened, on the welcome page."
    : "This is a development copy of the game.";

  $("#opt-sound").value = sfx.isMuted() ? "off" : "on";
  $("#opt-voice").value = (await store.getKV("voice_on", false)) ? "on" : "off";
  $("#gu-voice-state").textContent = voice.supported()
    ? "" : "This browser cannot use the microphone, so the game will just ask her to say it.";
  const comfort = await store.getKV("comfort", {});
  $("#comfort-size").value = comfort.size || "default";
  $("#comfort-theme").value = comfort.theme || "light";

  show("grownup");
}

// The support experiment, for the adult, with its uncertainty said out loud.
const ARM_NAMES = { etymology: "Where it comes from", story: "A story of it in use",
                    say: "Say it aloud", blend: "All three" };

async function paintExperiment() {
  const table = $("#gu-exp-table");
  if (!supports.live()) {
    $("#gu-exp-state").textContent = "Not started. It begins once the quotations have "
      + "been read and marked reviewed (experiments/2026-10-support-types-content.md).";
    table.hidden = true;
    return;
  }
  const per = supports.outcomes(await store.allAttempts(), await store.getKV("support_log", []));
  const enough = supports.ARMS.every((a) => per[a].n >= supports.ENOUGH);
  const best = enough ? supports.chanceBest(per) : null;
  const shown = supports.ARMS.reduce((n, a) => n + per[a].words, 0);
  const checked = supports.ARMS.reduce((n, a) => n + per[a].n, 0);
  $("#gu-exp-state").textContent = enough
    ? "Every kind of help has enough words checked to compare. Read the chance column "
      + "as a betting line, not a verdict."
    : `Too few to tell yet: ${shown} ${shown === 1 ? "word has" : "words have"} had help `
      + `after a miss, and ${checked} of them ${checked === 1 ? "has" : "have"} been checked `
      + `a day or more later. Each kind of help needs ${supports.ENOUGH} before this says anything.`;
  table.querySelector("tbody").replaceChildren(...supports.ARMS.map((a) => {
    const p = per[a];
    const tr = el("tr");
    for (const v of [ARM_NAMES[a], String(p.words), String(p.n),
                     p.n ? `${Math.round((100 * p.k) / p.n)}%` : "",
                     best ? `${Math.round(100 * best[a])}%` : ""]) {
      tr.append(el("td", { textContent: v }));
    }
    return tr;
  }));
  table.hidden = false;
}

// Games, for the adult: how much, and whether it is crowding out the dictation.
async function paintGamesSummary() {
  const log = await store.getKV("game_log", []);
  const pts = await store.getKV("game_points", { earned: 0, rounds: 0 });
  const since = Date.now() - 7 * 86400000;
  const recent = log.filter((r) => Date.parse(r.at) >= since);
  const count = (g) => recent.filter((r) => r.game === g).length;
  const sessions = (await store.allSessions())
    .filter((x) => x.kind === "practice" && Date.parse(x.started_at) >= since).length;
  const words = new Set(recent.flatMap((r) => r.items.map((i) => i.word)).filter(Boolean));
  $("#gu-games-summary").textContent = log.length
    ? `Last 7 days: ${count("jigsaw")} jigsaw, ${count("match")} root match, `
      + `${count("sort")} pattern sort, ${count("hangman")} hangman, `
      + `${count("hunt")} hidden words, ${count("gap")} fill the gap, `
      + `${count("lcw")} look cover write, ${count("tiles")} letter tiles, `
      + `${count("cross")} crosswords and ${count("bonus")} bonus rounds, `
      + `touching ${words.size} words; ${sessions} dictation sessions. `
      + `${pts.earned || 0} points earned in all.`
    : "No games played yet.";
}

function delayedAccuracy(attempts) {
  // docs/04's second dashboard number: accuracy at 7 and 28 days after the word was
  // first seen. Not session score.
  const first = new Map();
  for (const a of attempts) {
    if (!first.has(a.word)) first.set(a.word, Date.parse(a.created_at));
  }
  const bucket = (lo, hi) => {
    const rows = attempts.filter((a) => {
      const age = (Date.parse(a.created_at) - first.get(a.word)) / 86400000;
      return age >= lo && age < hi;
    });
    return rows.length ? rows.filter((a) => a.correct).length / rows.length : null;
  };
  return { d7: bucket(5, 14), d28: bucket(21, 42) };
}

// --------------------------------------------------------------- sharing

// What sharing sends: the game's address and a plain sentence. Never her name, her words,
// her garden or a tracking parameter, and nobody is told who shared it (docs/16-dpia.md).
// The first sentence is for a child to send to a friend; the second is the message a
// grown-up can send to another parent, which says what the game keeps.
const SHARE = {
  url: "https://www.tsttalent.com/Spelling",
  friends: "A spelling game for Year 5 and 6. It works on a phone or tablet.",
  parents: "A spelling game for Years 5 and 6. Words are read out in a sentence and typed "
    + "from memory, and they come back over the following weeks so they stick. There are "
    + "games too. It runs in a browser on a phone or tablet, works offline once opened, and "
    + "keeps what a child types on their own device. What it keeps: "
    + "https://www.tsttalent.com/Spelling/privacy.html",
};

async function sendShare(text, noteSel) {
  try {
    await navigator.share({ title: "Spelling", text, url: SHARE.url });
    $(noteSel).textContent = "";
  } catch (e) {
    // Closing the sheet is her choice and needs no comment; anything else gets the other way.
    $(noteSel).textContent = e && e.name === "AbortError" ? "" : "That did not open. Copy it instead.";
  }
}

async function copyShare(text, noteSel) {
  const all = `${text}\n${SHARE.url}`;
  let ok = false;
  try {
    await navigator.clipboard.writeText(all);
    ok = true;
  } catch { /* not a secure page, or not allowed: try the older way */ }
  if (!ok) {
    const area = document.createElement("textarea");
    area.value = all;
    area.setAttribute("readonly", "");
    area.style.cssText = "position:fixed;top:0;left:0;opacity:0";
    document.body.append(area);
    area.select();
    try { ok = document.execCommand("copy"); } catch { ok = false; }
    area.remove();
  }
  $(noteSel).textContent = ok
    ? "Copied. Paste it into a message."
    : "Copying did not work here. Press and hold the address on screen to copy it.";
}

// --------------------------------------------------------------- wiring

function wire() {
  $("#btn-practise").onclick = startPractice;
  $("#btn-probe").onclick = startProbe;
  $("#btn-grownup").onclick = showGrownUp;
  $("#btn-week").onclick = showWeek;
  $("#btn-games").onclick = () => games.openHub();
  $("#btn-share").onclick = () => {
    // The device's own share sheet, where there is one, and copying where there is not.
    $("#share-send").hidden = !navigator.share;
    $("#share-note").textContent = "";
    show("share");
  };
  $("#share-send").onclick = () => sendShare(SHARE.friends, "#share-note");
  $("#share-copy").onclick = () => copyShare(SHARE.friends, "#share-note");
  $("#gu-share-text").textContent = `${SHARE.parents}\n${SHARE.url}`;
  $("#gu-share-send").onclick = () => sendShare(SHARE.parents, "#gu-share-note");
  $("#gu-share-copy").onclick = () => copyShare(SHARE.parents, "#gu-share-note");
  $("#share-back").onclick = async () => { await refreshHome(); show("home"); };
  $("#games-home").onclick = async () => { await refreshHome(); show("home"); };
  $("#opt-name-save").onclick = async () => {
    // First name only, trimmed, kept on this device. See the note on screen.
    const name = $("#opt-name").value.trim().split(/\s+/)[0] || "";
    await store.setKV("learner_name", name.slice(0, 30));
    $("#opt-name").value = name;
    $("#opt-name-note").textContent = name
      ? `Saved. The welcome screen will say "Hi ${name}!". It stays on this iPad.`
      : "Cleared. The welcome screen will say \"Hi there!\".";
  };
  $("#week-input").addEventListener("input", paintParsed);
  $("#week-save").onclick = saveWeek;
  $("#week-clear").onclick = clearWeek;
  $("#week-school").onclick = useSchoolList;
  $("#week-back").onclick = async () => { await refreshHome(); show("home"); };

  $("#attempt-input").addEventListener("keydown", (e) => {
    app.keys.onKey(e);
    if (e.key === "Enter") { e.preventDefault(); submitAttempt(); }
  });
  $("#attempt-input").addEventListener("input", (e) => {
    app.keys.onInput(e.target.value);
    $("#attempt-submit").disabled = !e.target.value.trim();
  });
  $("#attempt-submit").onclick = submitAttempt;
  $("#attempt-replay").onclick = () => playPrompt(app.byWord.get(app.queue[app.index]));

  $("#reveal-next").onclick = () => { app.index += 1; nextItem(); };
  $("#reveal-rule-btn").onclick = showRule;
  $("#rule-back").onclick = () => show("reveal");
  for (const [key, label] of STRATEGY_OPTIONS) {
    $("#strategy-options").append(
      el("button", { textContent: label, onclick: () => answerStrategy(key) }));
  }

  $("#end-home").onclick = async () => { await refreshHome(); show("home"); };
  $("#end-grownup").onclick = showGrownUp;

  $("#probe-start").onclick = dictateProbe;
  $("#paper-submit").onclick = submitPaper;
  $("#gu-home").onclick = async () => { await refreshHome(); show("home"); };

  $("#gu-export").onclick = async () => {
    const data = await store.exportAll();
    const blob = new Blob([JSON.stringify(data, null, 1)], { type: "application/json" });
    const a = el("a", { href: URL.createObjectURL(blob),
                        download: `spelling-export-${today()}.json` });
    document.body.append(a); a.click(); a.remove();
  };
  $("#gu-delete").onclick = async () => {
    if (!confirm("Delete every attempt, session and profile on this device? This cannot be undone.")) return;
    await store.hardDelete();
    location.reload();
  };

  $("#gu-table-toggle").onclick = () => {
    const t = $("#gu-table");
    t.hidden = !t.hidden;
    $("#gu-table-toggle").textContent = t.hidden
      ? "Show the numbers instead" : "Hide the numbers";
  };

  $("#opt-sync").onchange = async (e) => {
    const on = e.target.value === "on";
    await store.setKV("sync_enabled", on);
    sync.load(on, await store.getKV("firebase_config", null));
    await showGrownUp();
  };

  // The Firebase config is pasted here, on her iPad, and kept in its IndexedDB.
  // It is not child data and it is not exported; deleting everything removes it.
  $("#opt-fb-save").onclick = async () => {
    const cfg = sync.parseConfig($("#opt-fb-config").value);
    if (!cfg) {
      $("#gu-sync-state").textContent = "That does not look like a Firebase web config. "
        + "It needs apiKey, authDomain, databaseURL, projectId and appId, with a Realtime "
        + "Database URL.";
      return;
    }
    await store.setKV("firebase_config", cfg);
    $("#opt-fb-config").value = "";
    sync.load(await store.getKV("sync_enabled", false), cfg);
    await showGrownUp();
  };

  $("#opt-voice").onchange = async (e) => {
    await store.setKV("voice_on", e.target.value === "on");
  };

  $("#opt-sound").onchange = async (e) => {
    const off = e.target.value === "off";
    sfx.setMuted(off);
    await store.setKV("sound", off ? "off" : "on");
    if (!off) sfx.play("correct");        // so the choice is audible immediately
  };

  $("#comfort-size").onchange = async (e) => {
    const c = await store.getKV("comfort", {});
    c.size = e.target.value; await store.setKV("comfort", c); applyComfort(c);
  };
  $("#comfort-theme").onchange = async (e) => {
    const c = await store.getKV("comfort", {});
    c.theme = e.target.value; await store.setKV("comfort", c); applyComfort(c);
  };
}

boot();
