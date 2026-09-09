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
import { Keystrokes, fluency } from "./keystrokes.js";

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
  scheduler: null, session: null, queue: [], index: 0,
  marks: [], strategy: [], keys: new Keystrokes(),
  mode: "practice",          // practice | probe
  probeItems: [], paperIndex: 0,
  audioOk: true,             // set by audio.working() at boot
};

// --------------------------------------------------------------- boot

async function boot() {
  const [words, sentences] = await Promise.all([
    fetch("data/words.json").then((r) => r.json()),
    fetch("data/sentences.json").then((r) => r.json()).catch(() => ({})),
  ]);
  app.data = words;
  app.sentences = sentences.sentences || {};
  for (const w of [...words.words, ...words.off_list]) app.byWord.set(w.word, w);

  audio.setOverrides(await store.getKV("pronunciation_overrides", {}));
  applyComfort(await store.getKV("comfort", { size: "default", theme: "light" }));

  const state = await store.getKV("scheduler_state", null);
  const patterns = await store.getKV("pattern_state", null);
  app.scheduler = new Scheduler(words.words, today(), state, patterns);

  wire();
  // Find out whether this device can speak BEFORE dictating into silence. With no
  // voice the prompt degrades to a cloze, which is still free-typed retrieval and
  // still never shows the spelling. prompt_mode records which one she actually got,
  // so the two are never pooled in analysis.
  app.audioOk = await audio.working();
  $("#attempt-noaudio").hidden = app.audioOk;
  await refreshHome();
  show("home");

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
}

async function persistScheduler() {
  await store.setKV("scheduler_state", app.scheduler.state);
  await store.setKV("pattern_state", app.scheduler.patterns);
}

function applyComfort(c) {
  document.documentElement.dataset.comfort = c.size || "default";
  document.documentElement.dataset.theme = c.theme || "light";
}

// --------------------------------------------------------------- router

function show(name) {
  for (const s of document.querySelectorAll(".screen")) s.classList.toggle("on", s.id === `screen-${name}`);
  // The redundancy guard: audio refuses to speak while the target word is on screen.
  audio.setWordVisible(name === "reveal" || name === "rule" || name === "paper-entry");
  window.scrollTo(0, 0);
}

function setProgress(done, total) {
  $("#progress > i").style.width = total ? `${Math.round((done / total) * 100)}%` : "0%";
}

// --------------------------------------------------------------- home

async function refreshHome() {
  const attempts = await store.allAttempts();
  const due = app.scheduler.due().length;
  $("#home-summary").textContent = attempts.length
    ? `${due} words ready to practise.`
    : "Nothing practised yet. Start with the challenge so the app knows what to teach.";
  $("#home-probe-note").textContent = attempts.length
    ? "Re-run the challenge every half term. The change over time is the measure that matters."
    : "";
}

// --------------------------------------------------------------- 1. attempt

function startPractice() {
  app.mode = "practice";
  app.queue = app.scheduler.session(SESSION_SIZE);
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
  // The word is plain [a-z]+ (enforced by tests/test_words.py), so it is regex-safe.
  const parts = sentence.split(new RegExp(`\\b${entry.word}\\b`, "gi"));
  parts.forEach((part, i) => {
    if (part) frag.append(document.createTextNode(part));
    if (i < parts.length - 1) frag.append(el("span", { className: "gap" }));
  });
  return frag;
}

function promptMode() {
  return app.audioOk ? "audio_sentence" : "text_cloze";
}

async function playPrompt(entry) {
  const sentence = app.sentences[entry.word] || "";
  if (!app.audioOk) {
    $("#attempt-cloze").hidden = false;
    $("#attempt-cloze").replaceChildren(clozeFor(entry));
    $("#attempt-state").textContent = "Read the sentence and fill in the missing word.";
    $("#attempt-replay").disabled = true;
    $("#attempt-input").focus();
    return;
  }
  $("#attempt-cloze").hidden = true;
  $("#attempt-replay").disabled = true;
  const labels = { word: "Listening\u2026", sentence: "In a sentence\u2026",
                   "word-again": "Once more\u2026", done: "" };
  await audio.dictate(entry.word, sentence, {
    onStep: (step) => { $("#attempt-state").textContent = labels[step] ?? ""; },
  });
  $("#attempt-replay").disabled = false;
  $("#attempt-input").focus();
}

function submitAttempt() {
  const entry = app.byWord.get(app.queue[app.index]);
  const raw = $("#attempt-input").value;
  if (!raw.trim()) return;
  audio.cancel();
  recordAttempt(entry, raw, promptMode()).then((d) => showReveal(entry, d));
}

async function recordAttempt(entry, raw, promptMode) {
  const d = classify(raw, entry);
  const st = app.scheduler.state[entry.word];
  const boxBefore = st ? st.box : null;
  const prior = await store.attemptsForWord(entry.word);
  const last = prior.length ? prior[prior.length - 1].created_at : null;

  if (st) app.scheduler.record(entry.word, d.correct, d.patterns);

  const row = {
    session_id: app.session ? app.session.id : null,
    word: entry.word,
    prompt_mode: promptMode,
    attempt_text: d.raw,
    correct: d.correct,
    error_type: d.type,
    error_detail: d.detail,
    error_patterns: d.patterns,
    sounds_right: d.sounds_right,
    trap: d.trap,
    mark_scheme: d.mark_scheme,
    method_shown: null,       // the ladder is off. docs/08 M5.
    arm: null,                // no experiment running. docs/04 requires pre-registration.
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

function markedUp(target, attempt) {
  // Show HER letters, with the wrong ones marked, against the target. docs/01: the
  // feedback that works is task and process level (d = 0.99), not "correct/wrong"
  // (d = 0.24). Note we never display a misspelling as the OBJECT of study: DysEggxia
  // deliberately does that and docs/01 flags it as a choice we do not copy.
  const frag = document.createDocumentFragment();
  if (!attempt) { frag.append(el("span", { className: "miss", textContent: "(nothing typed)" })); return frag; }
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

  $("#reveal-marked").replaceChildren(markedUp(normalise(entry.word), d.attempt));
  $("#reveal-target").textContent = entry.word;
  $("#reveal-target-wrap").hidden = d.correct;
  $("#reveal-detail").textContent = d.correct ? "" : d.detail;
  $("#reveal-detail").hidden = d.correct;

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

  // docs/03: ask at most one item in five, and NEVER after a failure.
  const askStrategy = d.correct && (app.index + 1) % STRATEGY_EVERY === 0;
  $("#reveal-strategy").hidden = !askStrategy;

  show("reveal");
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
  $("#rule-name").textContent = key.replace(/-/g, " ");
  $("#rule-explain").textContent = app.data.patterns[key] || "";
  const siblings = [...app.data.words, ...app.data.off_list]
    .filter((w) => w.word !== entry.word && w.patterns.includes(key))
    .slice(0, 6);
  $("#rule-siblings").replaceChildren(...siblings.map((w) => el("span", { textContent: w.word })));
  $("#rule-worked").textContent = `${entry.word}  =  ${entry.morph.replace(/\+/g, " + ")}`;
  $("#rule-why").textContent = entry.why;
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

  await refreshHome();
  show("end");
}

// --------------------------------------------------------------- 5. diagnostic (paper)

function startProbe() {
  app.mode = "probe";
  const run = Number(localStorage.getItem("probe_run") || "0");
  const on = [];
  const byPattern = {};
  for (const w of app.data.words) {
    const p = w.patterns[0];
    if (!app.data.probe_patterns.includes(p)) continue;
    (byPattern[p] = byPattern[p] || []).push(w);
  }
  for (const p of app.data.probe_patterns) {
    const pool = byPattern[p] || [];
    for (let i = 0; i < 2 && pool.length; i++) {
      const pick = pool[(run * 2 + i) % pool.length];
      if (!on.includes(pick)) on.push(pick);
    }
  }
  app.probeItems = [...on, ...app.data.off_list];
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
    if (app.audioOk) {
      $("#probe-cloze").hidden = true;
      await audio.dictate(entry.word, app.sentences[entry.word] || "");
    } else {
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
    const row = el("div", { className: "card" });
    row.append(el("div", { className: "label", textContent: `${i + 1}. ${entry.word}` }));
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
      attempt_text: (input.value || "").trim(), correct: d.correct,
      error_type: d.type, error_detail: d.detail, error_patterns: d.patterns,
      sounds_right: d.sounds_right, trap: d.trap, mark_scheme: d.mark_scheme,
      method_shown: null, arm: null,
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
  const attempts = await store.allAttempts();
  const marks = attempts.map((a) => {
    const entry = app.byWord.get(a.word);
    return entry ? { entry, diagnosis: classify(a.attempt_text, entry) } : null;
  }).filter(Boolean);

  const p = compute(marks, await store.getKV("strategy_log", []));
  const pct = (v) => (v === null || v === undefined ? "—" : `${Math.round(v * 100)}%`);

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

  const rows = Object.entries(p.pattern_strength).sort((a, b) => a[1] - b[1]);
  $("#gu-patterns").replaceChildren(...rows.map(([k, v]) => {
    const tr = el("tr");
    tr.append(el("td", { textContent: k.replace(/-/g, " ") }));
    const cell = el("td");
    const bar = el("div", { className: "bar-cell" });
    bar.append(el("i", { style: `width:${Math.max(2, v * 120)}px` }),
               el("span", { className: "small", textContent: pct(v) }));
    cell.append(bar);
    tr.append(cell);
    return tr;
  }));

  const medians = attempts.map((a) => a.median_inter_key_ms).filter((x) => x != null);
  const f = fluency(medians);
  $("#gu-fluency").textContent = f.median_inter_key_ms
    ? `${f.median_inter_key_ms} ms between keys. ${f.note}` : f.note;

  show("grownup");
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

// --------------------------------------------------------------- wiring

function wire() {
  $("#btn-practise").onclick = startPractice;
  $("#btn-probe").onclick = startProbe;
  $("#btn-grownup").onclick = showGrownUp;

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
