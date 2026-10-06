/*
 * End-to-end browser check.
 *
 *   npm install && npx playwright install chromium
 *   python3 serve.py --port 8137 &
 *   node tests/browser/run.mjs
 *   CHROME=/path/to/chrome node tests/browser/run.mjs   (to point at another build)
 *   TODAY=2026-10-12 node tests/browser/run.mjs         (to play another week of the term)
 *
 * The Python suite proves the engine is right. This proves the app in front of a child
 * actually behaves the way docs/02 says it must, which is a different claim: that the
 * word is never on screen while she is spelling it, that nothing counts days or
 * streaks, that the paper probe records dictation_paper, and that a session survives
 * losing the network mid-way.
 *
 * Headless Chromium ships no speech voices, so this also exercises the no-audio path,
 * which is the one a borrowed device is most likely to hit.
 */
import { existsSync, readFileSync } from "node:fs";
import { chromium } from "playwright-core";
import { namingLine } from "../../web/js/audio.js";
import { hintFor } from "../../web/js/engine/derive.js";

const BASE = process.env.BASE || "http://localhost:8137/";

// Find a Chromium: an explicit CHROME wins, then whatever `playwright install` put in
// place, then a preinstalled one. Undefined lets Playwright pick for itself.
function resolveExecutable() {
  if (process.env.CHROME) return process.env.CHROME;
  try {
    const p = chromium.executablePath();
    if (p && existsSync(p)) return p;
  } catch { /* no registry-installed browser */ }
  for (const p of ["/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
                   "/opt/pw-browsers/chromium/chrome-linux/chrome"]) {
    if (existsSync(p)) return p;
  }
  return undefined;
}
const EXECUTABLE = resolveExecutable();

let failures = 0;
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "  ok  " : "FAIL  "}${name}${detail ? "  — " + detail : ""}`);
  if (!ok) failures += 1;
};

const readAttempts = (page) => page.evaluate(async () => {
  const db = await new Promise((res, rej) => {
    const r = indexedDB.open("spelling", 1);
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
  return await new Promise((res) => {
    const t = db.transaction("attempts", "readonly").objectStore("attempts").getAll();
    t.onsuccess = () => res(t.result);
  });
});

const readKV = (page, key) => page.evaluate(async (k) => {
  const db = await new Promise((res, rej) => {
    const r = indexedDB.open("spelling", 1);
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
  return await new Promise((res) => {
    const t = db.transaction("kv", "readonly").objectStore("kv").get(k);
    t.onsuccess = () => res(t.result ? t.result.value : null);
  });
}, key);

const browser = await chromium.launch(
  EXECUTABLE ? { executablePath: EXECUTABLE } : {});
// Every context below tests the DEVICE-voice path unless it says otherwise, so each
// pins that precondition: an empty clip manifest, for the page and for the service
// worker's precache alike (a context route reaches the worker in Chromium; checked).
// Without this, what the suite means would change with whatever happens to be
// rendered. The clip tests further down pin their own manifests, and one of them
// uses the real one.
const noClips = (c) => c.route("**/data/audio.json", (r) => r.fulfill({
  contentType: "application/json", body: JSON.stringify({ clips: {} }) }));
// The same for the school term: engine/term.py ships the real autumn lists, and
// which one is live depends on today's date. A context that tests the app with no
// list pins an empty term, so what the suite means does not change with the
// calendar. The term's own checks further down build a term relative to today.
const noTerm = (c) => c.route("**/data/term.json", (r) => r.fulfill({
  contentType: "application/json", body: JSON.stringify({ weeks: [] }) }));

const ctx = await browser.newContext({ viewport: { width: 420, height: 900 } });
await noClips(ctx);
await noTerm(ctx);
const page = await ctx.newPage();
const errors = [];
const requestLog = [];
page.on("request", (r) => requestLog.push(r.url()));
page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
page.on("console", (m) => {
  if (m.type() === "error" && !/favicon/i.test(m.text())) errors.push("console: " + m.text());
});

console.log("\n— boot —");
await page.goto(BASE, { waitUntil: "networkidle" });
await page.waitForSelector("#screen-home.on", { timeout: 10000 });
check("home screen renders", true);

console.log("\n— 1. attempt screen —");
await page.click("#btn-practise");
await page.waitForSelector("#screen-attempt.on");
const attemptScreenText = (await page.innerText("#screen-attempt")).toLowerCase();
check("no score or timer on the attempt screen",
      !/\bscore\b|\bseconds\b|\btimer\b/.test(attemptScreenText));
// Checking the actual queued target rather than "any list word", because in the
// no-audio fallback the visible sentence legitimately contains other words.

console.log("\n— 2. reveal —");
await page.click("#attempt-input");
await page.keyboard.type("acomodate", { delay: 20 });
await page.keyboard.press("Backspace");
await page.click("#attempt-submit");
await page.waitForSelector("#screen-reveal.on");
// The single most important UI guarantee: she spells from memory, never copies. The
// target is only knowable after the reveal, so it is asserted against the text that
// was on screen while she was typing.
const target = (await page.textContent("#reveal-target")).trim().toLowerCase();
check("target word was NOT on the attempt screen while typing",
      !attemptScreenText.includes(target), `target was "${target}"`);
for (const [label, sel] of [["marked attempt", "#reveal-marked"], ["morphemes", "#reveal-morph"],
                            ["origin", "#reveal-origin"], ["why", "#reveal-why"],
                            ["siblings", "#reveal-siblings"]]) {
  check(`reveal shows ${label}`, (await page.textContent(sel)).trim().length > 0);
}
const rows1 = await readAttempts(page);
const last = rows1[rows1.length - 1];
check("keystroke timing captured", last.keystroke_count > 0 && last.latency_ms > 0,
      `keys=${last.keystroke_count} latency=${last.latency_ms}ms median=${last.median_inter_key_ms}ms`);
check("one Backspace counts as one edit", last.edits_before_submit === 1,
      `edits=${last.edits_before_submit}`);
check("attempt row carries the diagnosis", !!last.error_type && Array.isArray(last.error_patterns));
// experiments/2026-10-support-types.md: until the quotations are reviewed nothing
// here changes, and no word has an arm.
check("before the experiment starts, the answer screen is as it was, and no arm is recorded",
      await page.locator("#reveal-origin-part").isVisible()
      && await page.locator("#reveal-family-part").isVisible()
      && await page.locator("#reveal-support").isHidden()
      && last.arm === null && last.support_shown === null,
      `arm=${last.arm} support_shown=${last.support_shown}`);

console.log("\n— 3. rule card —");
await page.click("#reveal-rule-btn");
await page.waitForSelector("#screen-rule.on");
check("rule card names the pattern", (await page.textContent("#rule-name")).trim().length > 0);
check("rule card offers sibling words",
      (await page.locator("#rule-siblings span").count()) > 0);
await page.click("#rule-back");

console.log("\n— 4. session end —");
await page.click("#reveal-next");
for (let i = 1; i < 10; i++) {
  await page.waitForSelector("#screen-attempt.on");
  await page.fill("#attempt-input", "zzz");
  await page.click("#attempt-submit");
  await page.waitForSelector("#screen-reveal.on");
  if (!(await page.locator("#reveal-strategy").isHidden())) {
    await page.locator("#strategy-options button").first().click();
  }
  await page.click("#reveal-next");
}
await page.waitForSelector("#screen-end.on");
const endText = await page.innerText("#screen-end");
check("session end avoids streaks and day counts",
      !/streak|day \d+|days in a row|badge|trophy|leaderboard/i.test(endText));
check("session end reports self-referenced progress", /spelled correctly/i.test(endText));

console.log("\n— 5. paper probe —");
const ctx2 = await browser.newContext({ viewport: { width: 420, height: 900 } });
await noClips(ctx2);
await noTerm(ctx2);
const p2 = await ctx2.newPage();
p2.on("pageerror", (e) => errors.push("probe pageerror: " + e.message));
await p2.goto(BASE, { waitUntil: "networkidle" });
await p2.click("#btn-probe");
await p2.waitForSelector("#screen-probe-intro.on");
check("probe tells the adult it runs on paper",
      /paper/i.test(await p2.innerText("#screen-probe-intro")));
await p2.click("#probe-start");
for (let i = 0; i < 24; i++) {
  await p2.waitForSelector("#probe-next:not([disabled])", { timeout: 10000 });
  await p2.click("#probe-next");
}
await p2.waitForSelector("#screen-paper-entry.on", { timeout: 10000 });
const inputCount = await p2.locator("#paper-list input").count();
check("paper entry offers 24 boxes", inputCount === 24, `got ${inputCount}`);
const labels = await p2.locator("#paper-list .tab").allTextContents();
for (let i = 0; i < inputCount; i++) {
  const w = labels[i].replace(/^\d+\.\s*/, "");
  await p2.locator("#paper-list input").nth(i).fill(i % 2 ? w : w.slice(0, -1));
}
await p2.click("#paper-submit");
await p2.waitForSelector("#screen-grownup.on", { timeout: 15000 });
const probeRows = await readAttempts(p2);
check("probe attempts recorded as dictation_paper",
      probeRows.every((r) => r.prompt_mode === "dictation_paper"));
check("probe covers on-list and off-list words",
      probeRows.some((r) => r.on_list) && probeRows.some((r) => !r.on_list));

console.log("\n— 6. grown-up view —");
for (const [label, sel] of [["phonological reliance", "#gu-phon"],
                            ["orthographic choice", "#gu-ortho"],
                            ["delayed accuracy", "#gu-delayed"],
                            ["transfer", "#gu-transfer"]]) {
  check(`dashboard shows ${label}`, (await p2.textContent(sel)).trim().length > 0);
}
check("dashboard reports pattern strength",
      (await p2.locator("#gu-patterns tr").count()) > 0);
const guText = await p2.innerText("#screen-grownup");
check("dashboard makes no dyslexia-font or overlay claim",
      /no evidence that special fonts or coloured overlays/i.test(guText));

console.log("\n— state survives a reload —");
// The most load-bearing untested behaviour there was. Spacing is worth about 10.6
// percentage points (Cepeda et al., 254 studies) and it is the only thing in this app
// with an effect size that large. If Leitner state did not survive a reload, every word
// would return to box 1 every day and the scheduler would be decoration.
const beforeReload = await page.evaluate(async () => {
  const db = await new Promise((r) => { const q = indexedDB.open("spelling", 1);
    q.onsuccess = () => r(q.result); });
  return await new Promise((r) => {
    const t = db.transaction("kv", "readonly").objectStore("kv").get("scheduler_state");
    t.onsuccess = () => r(t.result ? t.result.value : null);
  });
});
const pushedOut = Object.entries(beforeReload || {})
  .filter(([, v]) => v.seen > 0).map(([w]) => w);
check("practised words are recorded in scheduler state", pushedOut.length > 0,
      `${pushedOut.length} words seen`);
check("a missed word is due later, not today",
      pushedOut.every((w) => beforeReload[w].due > new Date().toISOString().slice(0, 10)));

await page.reload({ waitUntil: "networkidle" });
await page.waitForSelector("#screen-home.on");
const afterReload = await page.evaluate(async () => {
  const db = await new Promise((r) => { const q = indexedDB.open("spelling", 1);
    q.onsuccess = () => r(q.result); });
  const get = (store, key) => new Promise((r) => {
    const t = db.transaction(store, "readonly").objectStore(store);
    const q = key === undefined ? t.getAll() : t.get(key);
    q.onsuccess = () => r(q.result);
  });
  return { sched: await get("kv", "scheduler_state"), pat: await get("kv", "pattern_state"),
           attempts: (await get("attempts")).length };
});
check("scheduler state survives a reload",
      JSON.stringify(afterReload.sched && afterReload.sched.value) === JSON.stringify(beforeReload));
check("pattern state survives a reload", !!(afterReload.pat && afterReload.pat.value));
check("the attempt log survives a reload", afterReload.attempts >= 10,
      `${afterReload.attempts} rows`);

console.log("\n— offline —");
await page.bringToFront();
await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, { timeout: 10000 })
  .then(() => check("service worker controls the page", true))
  .catch(() => check("service worker controls the page", false));
await ctx.setOffline(true);
await page.reload({ waitUntil: "domcontentloaded" });
const offlineOk = await page.waitForSelector("#screen-home.on", { timeout: 10000 })
  .then(() => true).catch(() => false);
check("app loads with the network off", offlineOk);
await ctx.setOffline(false);

console.log("\n— engagement layer: what she must NEVER see —");
// The whole design rests on Deci et al.: expected rewards reduce persistence
// (engagement-contingent d = -0.40, worse in children). If a score or a
// streak ever reaches a child-facing screen, that finding has been violated
// and this check is the thing that catches it.
const CHILD_SCREENS = ["home", "attempt", "reveal", "rule", "end",
                       "probe-intro", "probe-dictate"];
const BANNED = /\b(\d+\s*(pts|points|xp|coins?|gems?|stars? earned)|streak|day \d+|\d+ days? in a row|level \d+|leaderboard|rank(ed)? #?\d+)\b/i;
const leaks = await page.evaluate((ids) => {
  const found = [];
  for (const id of ids) {
    const el = document.querySelector(`#screen-${id}`);
    if (!el) continue;
    const prev = el.style.display;
    el.style.display = "block";
    found.push([id, el.innerText]);
    el.style.display = prev;
  }
  return found;
}, CHILD_SCREENS);
for (const [id, text] of leaks) {
  const hit = text.match(BANNED);
  check(`no score or streak on the ${id} screen`, !hit, hit ? `found "${hit[0]}"` : "");
}
// Open it on THIS page first: it has only been rendered in the probe context
// so far, so its fields are still empty here.
await page.click("#end-grownup").catch(() => page.click("#btn-grownup"));
await page.waitForSelector("#screen-grownup.on");
check("the grown-up view is where consistency lives",
      /Practised on \d+ of the last \d+ days|No practice recorded yet/
        .test(await page.innerText("#screen-grownup")));
check("the grown-up view plots daily use",
      (await page.locator("#gu-calendar svg rect").count()) > 20,
      `${await page.locator("#gu-calendar svg rect").count()} day cells`);
check("the heatmap has a legend", (await page.locator("#gu-legend i").count()) >= 5);
check("a table view exists for the pale steps",
      (await page.locator("#gu-table-toggle").count()) === 1);

console.log("\n— the garden —");
// A piece is earned by cracking a RULE (3 consecutive correct), never by
// answering, showing up, or elapsed time.
const gardenFresh = await page.evaluate(() =>
  document.querySelector("#home-world").innerText);
check("garden starts empty and promises nothing",
      /starts empty/i.test(gardenFresh) && !/\d+\s*\/\s*\d+/.test(gardenFresh),
      gardenFresh.trim().slice(0, 60));

const crackedCount = await page.evaluate(async () => {
  // Seed three consecutive correct attempts on one word, then recount.
  const data = await fetch("data/words.json").then((r) => r.json());
  const w = data.words[0];
  const db = await new Promise((r) => { const q = indexedDB.open("spelling", 1);
    q.onsuccess = () => r(q.result); });
  for (let i = 0; i < 3; i++) {
    await new Promise((r) => {
      const t = db.transaction("attempts", "readwrite").objectStore("attempts");
      t.add({ word: w.word, attempt_text: w.word, correct: true,
              created_at: new Date(Date.now() + i * 1000).toISOString(),
              prompt_mode: "audio_sentence", error_patterns: [] }).onsuccess = r;
    });
  }
  const mod = await import("./js/rewards.js");
  const all = await new Promise((r) => {
    const t = db.transaction("attempts", "readonly").objectStore("attempts").getAll();
    t.onsuccess = () => r(t.result);
  });
  const byWord = new Map([...data.words, ...data.off_list].map((x) => [x.word, x]));
  return { cracked: [...mod.crackedPatterns(all, byWord)].length,
           patterns: w.patterns.length };
});
check("three consecutive correct cracks that word's rules",
      crackedCount.cracked >= crackedCount.patterns,
      `${crackedCount.cracked} cracked`);

console.log("\n— this week's spellings —");
{
  const ctx3 = await browser.newContext({ viewport: { width: 820, height: 1180 } });
  await noClips(ctx3);
  await noTerm(ctx3);
  const w = await ctx3.newPage();
  w.on("pageerror", (e) => errors.push("week pageerror: " + e.message));
  await w.goto(BASE, { waitUntil: "networkidle" });
  await w.waitForSelector("#screen-home.on");

  await w.click("#btn-week");
  await w.waitForSelector("#screen-week.on");
  // Two curated (necessary, rhythm), four the app has never seen.
  await w.fill("#week-input",
    "1. necessary\n2. rhythm\n3. tomorrow\n4. business\n5. column\n6. receipt");
  await w.waitForTimeout(150);
  const parsed = await w.textContent("#week-parsed");
  check("a pasted, numbered list is parsed", /6 words/.test(parsed), parsed.trim().slice(0, 60));
  check("the adult is told which words get a thinner reveal",
        /read from the spelling/.test(parsed));
  check("the test day defaults to a Friday",
        new Date((await w.inputValue("#week-test")) + "T00:00:00Z").getUTCDay() === 5);

  await w.click("#week-save");
  await w.waitForSelector("#screen-home.on");
  check("home shows this week's list", /tomorrow/.test(await w.textContent("#home-week-words")));
  check("home says when the test is",
        /Tested (in \d+ days|today|tomorrow)/.test(await w.textContent("#home-week-state")));

  // The mix: two in three from the list.
  const WEEK = ["necessary", "rhythm", "tomorrow", "business", "column", "receipt"];
  await w.click("#btn-practise");
  let fromList = 0, derivedSeen = false;
  for (let i = 0; i < 10; i++) {
    await w.waitForSelector("#screen-attempt.on");
    await w.fill("#attempt-input", "zzz");
    await w.click("#attempt-submit");
    await w.waitForSelector("#screen-reveal.on");
    const target = (await w.textContent("#reveal-target")).trim().toLowerCase();
    if (WEEK.includes(target)) fromList += 1;
    // A word with no curated entry must not show an empty origin card.
    if (["tomorrow", "business", "column", "receipt"].includes(target) && !derivedSeen) {
      derivedSeen = true;
      check(`'${target}': origin card hidden, not blank`,
            await w.locator("#reveal-about").isHidden());
      check(`'${target}': still marked and diagnosed`,
            (await w.textContent("#reveal-verdict")).trim().length > 0 &&
            (await w.textContent("#reveal-marked")).trim().length > 0);
      const revealText = await w.innerText("#screen-reveal");
      check(`'${target}': no empty origin line leaks through`,
            !/^\s*:\s*,\s*$/m.test(revealText));
    }
    await w.click("#reveal-next");
  }
  check("about two words in three come from this week's list",
        fromList >= 6 && fromList <= 8, `${fromList}/10`);
  check("a word with no curated entry was reached", derivedSeen);

  await w.waitForSelector("#screen-end.on");
  await w.click("#end-grownup");
  await w.waitForSelector("#screen-grownup.on");
  check("the grown-up view reports coverage of the list",
        /\d+ of \d+ practised/.test(await w.textContent("#gu-week-summary")));

  await ctx3.close();
}

// Headless Chromium has no speech voices, so this runs the cloze path. That is
// the harder case for these words, not the easier one: with no dictation at all
// the word class is the only thing separating 'licence' from 'license'.
console.log("\n— a real school list, headings and all —");
{
  const ctx4 = await browser.newContext({ viewport: { width: 820, height: 1180 } });
  await noClips(ctx4);
  await noTerm(ctx4);
  const w = await ctx4.newPage();
  w.on("pageerror", (e) => errors.push("real-list pageerror: " + e.message));
  await w.goto(BASE, { waitUntil: "networkidle" });
  await w.waitForSelector("#screen-home.on");

  await w.click("#btn-week");
  await w.waitForSelector("#screen-week.on");
  await w.fill("#week-input",
    "Noun/verb pairs (N = noun, V = verb):\n"
    + "advice (N) / advise (V) / device (N) / devise (V) / licence (N) "
    + "/ license (V) / practice (N) / practise (V) / prophecy (N) / prophesy (V)\n"
    + "Plain list:\n"
    + "ancient, apparent, appreciate, attached, available");
  await w.waitForTimeout(150);
  const parsed = await w.textContent("#week-parsed");
  check("the headings are not counted as spellings", /15 words/.test(parsed),
        parsed.trim().slice(0, 80));
  check("the adult is shown which words got a word class",
        /10 will be dictated with their word class/.test(parsed));
  check("this week's list has nothing the app cannot dictate", !/⚠/.test(parsed));

  // A homophone with no sentence and no word class is unanswerable, and the
  // adult has to be told before the child meets it, not after.
  await w.fill("#week-input", "stationery\nrhythm");
  await w.waitForTimeout(150);
  const risky = await w.textContent("#week-parsed");
  check("an undictatable homophone is flagged to the adult",
        /⚠ stationery/.test(risky), risky.trim().slice(0, 110));
  check("an ordinary word is not flagged", !/rhythm sounds like/.test(risky));
  await w.fill("#week-input",
    "Noun/verb pairs (N = noun, V = verb):\n"
    + "advice (N) / advise (V) / device (N) / devise (V) / licence (N) "
    + "/ license (V) / practice (N) / practise (V) / prophecy (N) / prophesy (V)\n"
    + "Plain list:\n"
    + "ancient, apparent, appreciate, attached, available");
  await w.waitForTimeout(150);

  await w.click("#week-save");
  await w.waitForSelector("#screen-home.on");
  const shown = await w.textContent("#home-week-words");
  for (const junk of ["pairs", "plain"]) {
    check(`'${junk}' never becomes a spelling`, !new RegExp(`\\b${junk}\\b`).test(shown));
  }

  // Re-opening the list must not lose the tags the school supplied.
  await w.click("#btn-week");
  await w.waitForSelector("#screen-week.on");
  check("the word class survives a round trip through the editor",
        /advice \(noun\)/.test(await w.inputValue("#week-input")));
  await w.click("#week-back");
  await w.waitForSelector("#screen-home.on");

  const PAIRS = ["advice", "advise", "device", "devise", "licence", "license",
                 "practice", "practise", "prophecy", "prophesy"];
  await w.click("#btn-practise");
  let sawPair = false, sawPlain = false;
  for (let i = 0; i < 10; i++) {
    await w.waitForSelector("#screen-attempt.on");
    const hint = (await w.textContent("#attempt-hint")).trim();
    const hintUp = await w.locator("#attempt-hint").isVisible();
    await w.fill("#attempt-input", "zzz");
    await w.click("#attempt-submit");
    await w.waitForSelector("#screen-reveal.on");
    const target = (await w.textContent("#reveal-target")).trim().toLowerCase();
    if (PAIRS.includes(target) && !sawPair) {
      sawPair = true;
      check(`'${target}': the word class is on screen while she types`,
            hintUp && /It is the (noun|verb)\./.test(hint), hint);
      await w.click("#reveal-rule-btn");
      await w.waitForSelector("#screen-rule.on");
      check(`'${target}': the rule card teaches the c/s rule, not 'sounds the same'`,
            /The noun has a c, the verb has an s/.test(await w.textContent("#rule-explain")));
      await w.click("#rule-back");
      await w.waitForSelector("#screen-reveal.on");
    } else if (!PAIRS.includes(target) && !sawPlain) {
      sawPlain = true;
      check(`'${target}': no word class is invented for an ordinary word`, !hintUp);
    }
    await w.click("#reveal-next");
  }
  check("a noun/verb pair was reached", sawPair);

  await ctx4.close();
}

// Her iPad HAS voices, so the path she will actually use is the one
// headless Chromium cannot run. Stub the speech API and read back what the app
// asked it to say: for these ten words the spoken line is the whole question.
console.log("\n— what the dictation actually says —");
{
  const ctx5 = await browser.newContext({ viewport: { width: 820, height: 1180 } });
  await noClips(ctx5);
  await noTerm(ctx5);
  const w = await ctx5.newPage();
  w.on("pageerror", (e) => errors.push("dictation pageerror: " + e.message));
  await w.addInitScript(() => {
    window.__spoken = [];
    class FakeUtterance {
      constructor(text) { this.text = text; this.onend = null; this.onerror = null; }
    }
    // speechSynthesis is an accessor on the window prototype in Chromium, so a
    // plain assignment is silently dropped. Define over it.
    const fake = {
      getVoices: () => [{ name: "Test Voice", lang: "en-GB", default: true }],
      speak(u) { window.__spoken.push(u.text); setTimeout(() => u.onend && u.onend(), 5); },
      cancel() {}, pause() {}, resume() {},
      addEventListener() {}, removeEventListener() {},
      speaking: false, pending: false, paused: false,
    };
    Object.defineProperty(window, "SpeechSynthesisUtterance",
                          { value: FakeUtterance, configurable: true, writable: true });
    Object.defineProperty(window, "speechSynthesis",
                          { value: fake, configurable: true });
  });
  await w.goto(BASE, { waitUntil: "networkidle" });
  await w.waitForSelector("#screen-home.on");

  await w.click("#btn-week");
  await w.waitForSelector("#screen-week.on");
  await w.fill("#week-input", "advice (N)\nadvise (V)\nlicence (N)\nlicense (V)");
  await w.click("#week-save");
  await w.waitForSelector("#screen-home.on");

  await w.click("#btn-practise");
  await w.waitForSelector("#screen-attempt.on");
  // Wait for the three-step script to finish rather than for a fixed time.
  await w.waitForFunction(
    () => window.__spoken.filter((t) => /^The word is /.test(t)).length >= 2,
    null, { timeout: 15000 });
  const said = await w.evaluate(() => window.__spoken.slice());
  const naming = said.filter((t) => /^The word is /.test(t));

  check("the word class is spoken, not just displayed",
        /^The word is \w+, the (noun|verb)\.$/.test(naming[0]), naming[0]);
  check("it is repeated on the second naming, as the KS2 script does",
        naming[1] === naming[0], naming[1]);
  check("the sentence still sits between the two namings",
        said.indexOf(naming[0]) < said.length - 1
        && !/^The word is /.test(said[said.indexOf(naming[0]) + 1]),
        said.join(" | ").slice(0, 120));
  check("the word itself is never spelled out or shown during dictation",
        await w.locator("#attempt-hint").isVisible()
        && !(await w.innerText("#screen-attempt")).toLowerCase()
              .includes(naming[0].replace(/^The word is (\w+),.*$/, "$1")));

  await ctx5.close();
}

// Pre-rendered clips. The real manifest may be empty (nothing rendered yet), so this
// block serves its own: every curated line mapped to a clip, and every clip answered
// with 1.2 s of silence, long enough to cancel in the middle of. Service workers are
// blocked here so Playwright can see and answer every request; the worker's range
// slicing has its own test.
function silentWav(seconds) {
  const sr = 8000, n = Math.round(sr * seconds), b = Buffer.alloc(44 + n * 2);
  b.write("RIFF", 0); b.writeUInt32LE(36 + n * 2, 4); b.write("WAVE", 8);
  b.write("fmt ", 12); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(sr, 24); b.writeUInt32LE(sr * 2, 28); b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34); b.write("data", 36); b.writeUInt32LE(n * 2, 40);
  return b;
}
const WAV = silentWav(1.2);
const dictation = await (await fetch(new URL("data/sentences.json", BASE))).json();
const clipOf = {};                       // text -> url, the way render_audio.py writes it
let k = 0;
for (const [word, sentence] of Object.entries(dictation.sentences)) {
  for (const text of [namingLine(word, hintFor(word)), sentence]) {
    clipOf[text] = `audio/${(k++).toString(16).padStart(16, "0")}.mp3`;
  }
}
const clipManifest = { voice_id: "test", model_id: "test", clips: clipOf };

async function clipContext({ deviceVoice }) {
  const ctx = await browser.newContext({ viewport: { width: 820, height: 1180 },
                                         serviceWorkers: "block" });
  await noTerm(ctx);
  const w = await ctx.newPage();
  w.on("pageerror", (e) => errors.push("clips pageerror: " + e.message));
  const hits = [];
  await w.route("**/data/audio.json", (r) => r.fulfill({
    contentType: "application/json", body: JSON.stringify(clipManifest) }));
  await w.route("**/audio/*.mp3", (r) => {
    hits.push({ path: new URL(r.request().url()).pathname, t: Date.now() });
    r.fulfill({ contentType: "audio/wav", body: WAV });
  });
  if (deviceVoice) {
    await w.addInitScript(() => {
      window.__spoken = [];
      class U { constructor(t) { this.text = t; } }
      const fake = {
        getVoices: () => [{ name: "Test Voice", lang: "en-GB", default: true }],
        speak(u) { window.__spoken.push(u.text); setTimeout(() => u.onend && u.onend(), 5); },
        cancel() {}, pause() {}, resume() {}, addEventListener() {}, removeEventListener() {},
      };
      Object.defineProperty(window, "SpeechSynthesisUtterance", { value: U, configurable: true, writable: true });
      Object.defineProperty(window, "speechSynthesis", { value: fake, configurable: true });
    });
  }
  await w.goto(BASE, { waitUntil: "networkidle" });
  await w.waitForSelector("#screen-home.on");
  return { ctx, w, hits };
}
const lastRow = (w) => w.evaluate(async () => {
  const db = await new Promise((res) => { const r = indexedDB.open("spelling", 1); r.onsuccess = () => res(r.result); });
  const all = await new Promise((res) => {
    const t = db.transaction("attempts", "readonly").objectStore("attempts").getAll();
    t.onsuccess = () => res(t.result);
  });
  return all[all.length - 1];
});
const pathOf = (text) => "/" + new URL(clipOf[text], BASE).pathname.split("/").slice(-2).join("/");
const hitFor = (hits, text) => hits.some((h) => h.path.endsWith(pathOf(text)));

console.log("\n— pre-rendered clips, on a device with NO speech voice —");
{
  const { ctx, w, hits } = await clipContext({ deviceVoice: false });
  await w.click("#btn-practise");
  await w.waitForSelector("#screen-attempt.on");
  const first = (await w.evaluate(() => document.querySelector("#attempt-count").textContent)).length > 0;
  // Which word is it? The naming clip it asks for says.
  await w.waitForFunction(() => true);
  await w.waitForTimeout(300);
  const firstWord = Object.keys(dictation.sentences).find((wd) => hitFor(hits, namingLine(wd, hintFor(wd))));
  check("a curated word is DICTATED, not dropped to the cloze, with no device voice",
        first && !!firstWord && await w.locator("#attempt-cloze").isHidden(), firstWord || "no clip requested");
  await w.waitForFunction(() => !document.querySelector("#attempt-replay").disabled, null, { timeout: 15000 });
  const sentenceHeard = hitFor(hits, dictation.sentences[firstWord]);
  check("the sentence is played from its clip too, in the same voice", sentenceHeard);
  check("the no-voice note stays hidden when clips cover the item",
        await w.locator("#attempt-noaudio").isHidden());
  await w.fill("#attempt-input", "zzz");
  await w.click("#attempt-submit");
  await w.waitForSelector("#screen-reveal.on");
  const row1 = await lastRow(w);
  check("the attempt row records which voice she heard",
        row1.audio_source === "clip" && row1.prompt_mode === "audio_sentence",
        `${row1.prompt_mode} / ${row1.audio_source}`);

  // Cancel in the middle of the first clip: nothing after it may play. Either cancel()
  // or the word-on-screen guard is enough to pass this; the token alone is isolated below.
  // Count from before the click. The naming clip is asked for as the screen is drawn,
  // so a count taken once the screen shows can already include it, and then no word
  // is found at all. That is a race, and it can go either way.
  const before = hits.length;
  await w.click("#reveal-next");
  await w.waitForSelector("#screen-attempt.on");
  await w.waitForTimeout(250);          // the naming clip is now playing
  const second = Object.keys(dictation.sentences).find((wd) =>
    hits.slice(before).some((h) => h.path.endsWith(pathOf(namingLine(wd, hintFor(wd))))));
  await w.fill("#attempt-input", "zzz");
  const submittedAt = Date.now();
  await w.click("#attempt-submit");
  await w.waitForSelector("#screen-reveal.on");
  await w.waitForTimeout(2500);         // longer than the rest of the script would take
  const late = hits.filter((h) => h.t > submittedAt && second &&
                           h.path.endsWith(pathOf(dictation.sentences[second])));
  check("submitting mid-dictation stops it: the sentence clip is never fetched",
        !!second && late.length === 0, second ? `${second}: ${late.length} late` : "no second word");

  // A school word nobody rendered, on a device with no voice: the cloze, honestly.
  await w.click("#reveal-next").catch(() => {});
  await w.goto(BASE, { waitUntil: "networkidle" });
  await w.click("#btn-week");
  await w.waitForSelector("#screen-week.on");
  await w.fill("#week-input", "tomorrow");
  await w.click("#week-save");
  await w.waitForSelector("#screen-home.on");
  await w.click("#btn-practise");
  let clozeRow = null;
  for (let i = 0; i < 10 && !clozeRow; i++) {
    await w.waitForSelector("#screen-attempt.on");
    const cloze = await w.locator("#attempt-cloze").isVisible();
    await w.fill("#attempt-input", "zzz");
    await w.click("#attempt-submit");
    await w.waitForSelector("#screen-reveal.on");
    const target = (await w.textContent("#reveal-target")).trim();
    if (target === "tomorrow") {
      const row = await lastRow(w);
      clozeRow = { cloze, row };
    } else {
      await w.click("#reveal-next");
    }
  }
  check("an unrendered word with no device voice falls back to the cloze",
        !!clozeRow && clozeRow.cloze && clozeRow.row.prompt_mode === "text_cloze"
        && clozeRow.row.audio_source === null,
        clozeRow ? `${clozeRow.row.prompt_mode} / ${clozeRow.row.audio_source}` : "not reached");
  await ctx.close();
}

console.log("\n— pre-rendered clips, on a device WITH a speech voice —");
{
  const { ctx, w, hits } = await clipContext({ deviceVoice: true });
  await w.click("#btn-week");
  await w.waitForSelector("#screen-week.on");
  await w.fill("#week-input", "tomorrow");
  await w.click("#week-save");
  await w.waitForSelector("#screen-home.on");
  await w.click("#btn-practise");
  let curatedChecked = false, deviceRow = null;
  for (let i = 0; i < 10 && !(curatedChecked && deviceRow); i++) {
    await w.waitForSelector("#screen-attempt.on");
    await w.waitForFunction(() => !document.querySelector("#attempt-replay").disabled,
                            null, { timeout: 15000 });
    await w.fill("#attempt-input", "zzz");
    await w.click("#attempt-submit");
    await w.waitForSelector("#screen-reveal.on");
    const target = (await w.textContent("#reveal-target")).trim();
    const spoken = await w.evaluate(() => window.__spoken.slice());
    const row = await lastRow(w);
    if (target === "tomorrow") {
      deviceRow = { row, spoken, clip: hitFor(hits, "The word is tomorrow.") };
    } else if (!curatedChecked) {
      curatedChecked = true;
      check(`'${target}': the clip wins over a working device voice`,
            !spoken.some((t) => t.startsWith(`The word is ${target}`)) && row.audio_source === "clip",
            row.audio_source);
    }
    await w.evaluate(() => { window.__spoken.length = 0; });
    await w.click("#reveal-next");
  }
  check("a school word with no clip uses the device voice, and says so",
        !!deviceRow && deviceRow.spoken.includes("The word is tomorrow.")
        && !deviceRow.clip && deviceRow.row.audio_source === "device",
        deviceRow ? deviceRow.row.audio_source : "not reached");

  await ctx.close();
}

// The check that isolates the cancel token, in a clean context so the item under test is
// a curated word with clips (a saved weekly list would put an unrendered word first).
// Submitting settles the playing clip as "failed", and a failed clip falls back to the
// device voice. Without the token that fallback fires in the gap before the reveal is
// drawn, so the tablet starts saying the word over the marking. The redundancy guard
// cannot catch it: the word is not on screen yet.
{
  const { ctx, w, hits } = await clipContext({ deviceVoice: true });
  await w.click("#btn-practise");
  await w.waitForSelector("#screen-attempt.on");
  await w.waitForFunction(() => true);
  const t0 = Date.now();
  while (hits.length === 0 && Date.now() - t0 < 5000) await w.waitForTimeout(50);
  await w.waitForTimeout(300);                  // the naming clip is mid-play
  await w.evaluate(() => { window.__spoken.length = 0; });
  await w.fill("#attempt-input", "zzz");
  await w.click("#attempt-submit");
  await w.waitForSelector("#screen-reveal.on");
  await w.waitForTimeout(600);
  const leaked = await w.evaluate(() => window.__spoken.filter((t) => t.startsWith("The word is")));
  check("the item under test really was playing a clip", hits.length > 0, `${hits.length} clip request(s)`);
  check("cancelling a clip never hands the line to the device voice",
        leaked.length === 0, leaked.length ? `leaked: ${leaked.join(" | ")}` : "");
  await ctx.close();
}

// The real rendered set, end to end: the manifest the renderer wrote, the MP3s it
// fetched, played by a real browser engine to their end. Skips while nothing is
// rendered. Service workers are blocked so every request is visible.
console.log("\n— the real rendered clips —");
{
  const real = await (await fetch(new URL("data/audio.json", BASE))).json();
  if (!Object.keys(real.clips || {}).length) {
    console.log("  skip  nothing rendered yet");
  } else {
    const c = await browser.newContext({ viewport: { width: 820, height: 1180 },
                                         serviceWorkers: "block" });
    await noTerm(c);
    const w = await c.newPage();
    w.on("pageerror", (e) => errors.push("real clips pageerror: " + e.message));
    const got = [];
    w.on("response", (r) => { if (r.url().includes("/audio/")) got.push([new URL(r.url()).pathname, r.status()]); });
    await w.goto(BASE, { waitUntil: "networkidle" });
    await w.click("#btn-practise");
    await w.waitForSelector("#screen-attempt.on");
    const t0 = Date.now();
    await w.waitForFunction(() => !document.querySelector("#attempt-replay").disabled,
                            null, { timeout: 30000 });
    const took = (Date.now() - t0) / 1000;
    await w.fill("#attempt-input", "zzz");
    await w.click("#attempt-submit");
    await w.waitForSelector("#screen-reveal.on");
    const word = (await w.textContent("#reveal-target")).trim();
    const row = await lastRow(w);
    const want = [namingLine(word, hintFor(word)), dictation.sentences[word]]
      // Resolved against BASE, so this holds at the root and at /Games/Spelling/ alike.
      .map((t) => new URL(real.clips[t], BASE).pathname);
    const fetched = new Set(got.filter(([, st]) => st < 400).map(([pth]) => pth));
    check(`'${word}': its real naming and sentence clips were fetched`,
          want.every((u) => fetched.has(u)), [...fetched].join(" "));
    check(`'${word}': the real MP3s played to their end in a browser`,
          row.audio_source === "clip" && took > 3 && took < 20,
          `${row.audio_source}, script took ${took.toFixed(1)} s`);
    await c.close();
  }
}

// ---------------------------------------------------------------- the school term
// engine/term.py ships the real autumn lists, but which one is live depends on the
// date, so these checks build a term around TODAY: last week's list and this week's.
// The dates are UTC, the same as the app's today().
console.log("\n— the school term —");
{
  const iso = (d) => d.toISOString().slice(0, 10);
  const now = new Date();
  const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(),
    now.getUTCDate() - ((now.getUTCDay() + 6) % 7)));
  const plus = (d, n) => new Date(d.getTime() + n * 86400000);
  const week = (setOn, words, theme) => ({
    id: `week-${iso(setOn)}`, words, hints: {}, set_on: iso(setOn),
    test_on: iso(plus(setOn, 4)), done: false, theme, source: "term" });
  const lastWeek = week(plus(monday, -7), ["tomorrow", "business", "wednesday"], "Last week");
  const thisWeek = week(monday, ["co-operate", "re-enter", "man-eating"], "Hyphens");
  // The real hand-written entries, so the reveal can be checked against them.
  const shipped = await (await fetch(new URL("data/term.json", BASE))).json();
  const entries = shipped.entries.filter((e) => thisWeek.words.includes(e.word));
  const termCtx = async (kv = {}) => {
    const c = await browser.newContext({ viewport: { width: 820, height: 1180 } });
    await noClips(c);
    await c.route("**/data/term.json", (r) => r.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ weeks: [lastWeek, thisWeek], entries }) }));
    const w = await c.newPage();
    const errs = [];
    w.on("pageerror", (e) => errs.push(e.message));
    await w.goto(BASE, { waitUntil: "networkidle" });
    await w.waitForSelector("#screen-home.on");
    if (Object.keys(kv).length) {
      // Seed what a device would already hold, then boot again on top of it.
      await w.evaluate(async (entries) => {
        const db = await new Promise((res) => { const r = indexedDB.open("spelling", 1); r.onsuccess = () => res(r.result); });
        await new Promise((res) => {
          const t = db.transaction("kv", "readwrite");
          for (const [key, value] of Object.entries(entries)) t.objectStore("kv").put({ key, value });
          t.oncomplete = res;
        });
      }, kv);
      await w.reload({ waitUntil: "networkidle" });
      await w.waitForSelector("#screen-home.on");
    }
    return { c, w, errs };
  };

  {
    const { c, w } = await termCtx();
    const shown = await w.textContent("#home-week-words");
    check("this week's list switches on with nobody typing it",
          await w.locator("#home-week").isVisible() && shown.includes("co-operate"), shown);
    await c.close();
  }
  {
    const pasted = { id: `week-${iso(plus(monday, -6))}`, words: ["hostile", "frantic"], hints: {},
                     set_on: iso(plus(monday, -6)), test_on: iso(plus(monday, -3)), done: false };
    const { c, w } = await termCtx({ weekly_list: pasted });
    const shown = await w.textContent("#home-week-words");
    check("a list saved last week gives way on Monday", shown.includes("re-enter"), shown);
    await c.close();
  }
  {
    const mine = { id: `week-${iso(now)}`, words: ["obstinate", "calamitous"], hints: {},
                   set_on: iso(now), test_on: iso(plus(monday, 4)), done: false };
    const { c, w } = await termCtx({ weekly_list: mine });
    const shown = await w.textContent("#home-week-words");
    check("an adult's own list for this week is kept", shown.includes("obstinate"), shown);
    await c.close();
  }
  {
    // "Clear it" holds the school's list off until next Monday, and a list pasted over
    // it does the same. On 6 October 2026 a device could be left with no list for the
    // week and no way back but typing all the words in again. The week screen now
    // says which list is in use and brings the school's back in one tap.
    const { c, w } = await termCtx();
    const source = async () => (await w.textContent("#week-source")).trim();
    const openWeek = async () => {
      await w.click("#btn-week");
      await w.waitForSelector("#screen-week.on");
    };
    const reopen = async () => {
      await w.reload({ waitUntil: "networkidle" });
      await w.waitForSelector("#screen-home.on");
    };
    await openWeek();
    check("the week screen says when the school's own list is in use, and offers nothing to restore",
          /^This is the school.s list for this week\.$/.test(await source())
          && await w.locator("#week-school").isHidden(), await source());

    await w.click("#week-clear");
    await w.waitForSelector("#screen-home.on");
    await reopen();
    check("a cleared week stays cleared when the game is reopened",
          await w.locator("#home-week").isHidden());
    await openWeek();
    check("the week screen then says so, and offers the school's list",
          /^You cleared this week.s list\./.test(await source())
          && await w.locator("#week-school").isVisible(), await source());
    await w.click("#week-school");
    await w.waitForSelector("#screen-home.on");
    const back = await w.textContent("#home-week-words");
    check("one tap brings the school's list back, with its theme and its test day",
          back.includes("co-operate") && back.includes("man-eating")
          && (await w.textContent("#home-week-theme")).includes("Hyphens")
          && /^Tested/.test((await w.textContent("#home-week-state")).trim()), back);
    await reopen();
    check("and it is still there after the game is reopened",
          (await w.textContent("#home-week-words")).includes("re-enter"));

    // A list of her own, pasted over the school's: it says so, and the way back is there.
    await openWeek();
    await w.fill("#week-input", "obstinate\ncalamitous");
    await w.click("#week-save");
    await w.waitForSelector("#screen-home.on");
    await openWeek();
    check("a list pasted over the school's is called what it is, with the way back",
          /^This is not the school.s list for this week\.$/.test(await source())
          && await w.locator("#week-school").isVisible(), await source());
    await w.click("#week-school");
    await w.waitForSelector("#screen-home.on");
    check("and the school's list replaces it",
          !(await w.textContent("#home-week-words")).includes("obstinate")
          && (await w.textContent("#home-week-words")).includes("co-operate"));

    // The restored list is the real thing for practice: this week's words get asked.
    await w.click("#btn-practise");
    await w.waitForSelector("#screen-attempt.on");
    const asked = [];
    for (let i = 0; i < 6; i++) {
      await w.waitForSelector("#screen-attempt.on");
      await w.fill("#attempt-input", "zzz");
      await w.click("#attempt-submit");
      await w.waitForSelector("#screen-reveal.on");
      asked.push((await w.textContent("#reveal-target")).trim());
      if (!(await w.locator("#reveal-strategy").isHidden())) {
        await w.locator("#strategy-options button").first().click();
      }
      await w.click("#reveal-next");
    }
    check("practice then draws this week's words", asked.some((x) => thisWeek.words.includes(x)),
          asked.join(", "));
    await c.close();
  }
  {
    // Before the term there is no school list to go back to, so no promise of one.
    const c = await browser.newContext({ viewport: { width: 820, height: 1180 } });
    await noClips(c);
    await noTerm(c);
    const w = await c.newPage();
    await w.goto(BASE, { waitUntil: "networkidle" });
    await w.waitForSelector("#screen-home.on");
    await w.click("#btn-week");
    await w.waitForSelector("#screen-week.on");
    check("with no school list for today, the week screen promises none",
          (await w.textContent("#week-source")).trim() === "" && await w.locator("#week-school").isHidden());
    await c.close();
  }
  {
    // She practised 'tomorrow' last week and it is due again today. It is in the saved
    // state but not on this week's list. That once crashed the session outright.
    const { c, w, errs } = await termCtx({
      scheduler_state: { tomorrow: { box: 2, due: iso(plus(monday, -1)), seen: 2, wrong: 1 } } });
    await w.click("#btn-practise");
    const started = await w.waitForSelector("#screen-attempt.on", { timeout: 5000 })
      .then(() => true).catch(() => false);
    check("a word from an earlier list coming due does not break practice",
          started && errs.length === 0, errs.join(" | ") || "attempt screen up");
    await c.close();
  }
  {
    const { c, w, errs } = await termCtx();
    await w.click("#btn-practise");
    await w.waitForSelector("#screen-attempt.on");
    const answer = async (text) => {
      await w.waitForFunction(() => !document.querySelector("#attempt-input").disabled);
      await w.fill("#attempt-input", text);
      await w.click("#attempt-submit");
      await w.waitForSelector("#screen-reveal.on");
      return { verdict: await w.textContent("#reveal-verdict"),
               target: await w.textContent("#reveal-target"),
               marked: await w.textContent("#reveal-marked") };
    };
    // The week's words come first, least seen first, in list order: co-operate.
    const missing = await answer("cooperate");
    check("leaving out the hyphen is marked wrong, and says it is the hyphen",
          /hyphen/i.test(missing.verdict) && missing.target === "co-operate",
          `${missing.verdict} | ${missing.target}`);
    check("the marked answer shows where the hyphen goes", missing.marked === "co-operate",
          missing.marked);
    const about = await w.locator("#reveal-about").isVisible();
    const morph = await w.textContent("#reveal-morph");
    const origin = await w.textContent("#reveal-origin");
    check("a term word shows how it is built, from its written-up entry",
          about && morph.includes("co") && morph.includes("operate") && /Latin/.test(origin),
          `${morph} | ${origin}`);
    await c.close();
    // A fresh device, so the first word is co-operate again.
    const again = await termCtx();
    await again.w.click("#btn-practise");
    await again.w.waitForSelector("#screen-attempt.on");
    await again.w.fill("#attempt-input", "co-operate");
    await again.w.click("#attempt-submit");
    await again.w.waitForSelector("#screen-reveal.on");
    const verdict = await again.w.textContent("#reveal-verdict");
    check("a hyphenated word typed with its hyphen is right", /correct/i.test(verdict), verdict);
    check("the hyphen weeks raise no page errors",
          errs.length === 0 && again.errs.length === 0, [...errs, ...again.errs].join(" | "));
    await again.c.close();
  }
}

console.log("\n— privacy defaults —");
const syncDefault = await page.evaluate(async () => {
  const db = await new Promise((r) => { const q = indexedDB.open("spelling", 1);
    q.onsuccess = () => r(q.result); });
  return await new Promise((r) => {
    const t = db.transaction("kv", "readonly").objectStore("kv").get("sync_enabled");
    t.onsuccess = () => r(t.result ? t.result.value : false);
  });
});
check("sync is OFF by default (ICO standard 7, high privacy by default)", !syncDefault);
const calledFirebase = requestLog.some((u) => /firebase|googleapis|gstatic/.test(u));
check("no call to Firebase or Google on a default launch", !calledFirebase);

// docs/06 standard 8: no name in the learner record. The sync key used to be a
// child's first name, hardcoded, which put it in a file the site serves to
// anyone with the URL. Sync now signs in anonymously and holds the id Firebase
// gives it in memory, so no identifier is ever stored, with sync on or off.
const learnerKey = await page.evaluate(async () => {
  const db = await new Promise((r) => { const q = indexedDB.open("spelling", 1);
    q.onsuccess = () => r(q.result); });
  return await new Promise((r) => {
    const t = db.transaction("kv", "readonly").objectStore("kv").get("learner_key");
    t.onsuccess = () => r(t.result ? t.result.value : null);
  });
});
check("no learner identifier is minted while sync is off", learnerKey === null,
      learnerKey === null ? "" : String(learnerKey));

// Belt and braces on the same rule: nothing the site serves may carry a name.
// Read from the served files rather than the repo, because that is what a
// stranger with the URL actually gets.
const served = ["js/app.js", "js/sync.js", "js/store.js", "data/words.json"];
const names = [];
for (const f of served) {
  const body = await (await fetch(new URL(f, BASE))).text();
  // A key under learners/ must be a variable, never a string literal.
  if (/pushDay\s*\(\s*["'`]/.test(body)) names.push(`${f}: literal sync key`);
}
check("the sync key is never a hardcoded string", names.length === 0, names.join("; "));
// The config is pasted on her iPad. A served one would switch sync on for everyone.
check("the site serves no Firebase config",
      (await fetch(new URL("data/firebase.json", BASE))).status === 404);
check("before the experiment starts, nothing is assigned or logged, even after misses",
      (await readKV(page, "experiment_seed")) === null && (await readKV(page, "support_arms")) === null
      && (await readKV(page, "support_log")) === null);

// ---------------------------------------------------------------- welcome and games
// The real term and the real game content, whatever week it is: every answer is
// read from web/data/games.json, never assumed, so this holds on any date the term
// covers (it stays on the last week after 23 October).
console.log("\n— the welcome page —");
const gameData = await (await fetch(new URL("data/games.json", BASE))).json();
const termData = await (await fetch(new URL("data/term.json", BASE))).json();
// The games follow the term's calendar, so which week they play depends on the day.
// TODAY=2026-10-12 plays the week of 12 October on any day (the browser's clock too),
// which is how a week's content is tried before its Monday arrives. Unset: the real day.
const todayISO = process.env.TODAY || new Date().toISOString().slice(0, 10);
const liveWeek = termData.weeks.filter((w) => w.set_on <= todayISO).pop();
// Every context that plays the real term needs the same day, or it plays another week.
const fixClock = (c) => (process.env.TODAY ? c.clock.setFixedTime(new Date(`${todayISO}T12:00:00Z`)) : null);
const gctx = await browser.newContext({ viewport: { width: 820, height: 1180 }, acceptDownloads: true });
await fixClock(gctx);
await noClips(gctx);
// Every tone the sound module starts, by its pitch, so a headless browser can tell
// which sound played; and every request for the microphone, which nothing here
// should make, because nobody has switched it on.
await gctx.addInitScript(() => {
  window.__tones = [];
  window.__gum = 0;
  const make = BaseAudioContext.prototype.createOscillator;
  BaseAudioContext.prototype.createOscillator = function () {
    const osc = make.call(this);
    const set = osc.frequency.setValueAtTime.bind(osc.frequency);
    osc.frequency.setValueAtTime = (v, t) => { window.__tones.push(Math.round(v)); return set(v, t); };
    return osc;
  };
  if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    const real = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = (c) => { window.__gum += 1; return real(c); };
  }
});
const g = await gctx.newPage();
const gErrors = [];
g.on("pageerror", (e) => gErrors.push(e.message));
await g.goto(BASE, { waitUntil: "networkidle" });
await g.waitForSelector("#screen-home.on");
check("with no name set, the welcome says hello anyway",
      (await g.textContent("#home-hello")) === "Hi there!");
const ready = await g.textContent("#home-summary");
check("the welcome says what is ready today", /ready|due/i.test(ready), ready);
await g.click("#btn-grownup");
await g.waitForSelector("#screen-grownup.on");
await g.fill("#opt-name", "  Zinnia Example ");
await g.click("#opt-name-save");
await g.click("#gu-home");
await g.waitForSelector("#screen-home.on");
check("the welcome calls her by her first name",
      (await g.textContent("#home-hello")) === "Hi Zinnia!");
check("this week's theme is on the welcome page",
      !liveWeek || (await g.textContent("#home-week-theme")) === liveWeek.theme,
      liveWeek ? liveWeek.theme : "no term week today");
const homeText = await g.innerText("#screen-home");
check("the welcome never counts her visits or days",
      !/\b(\d+\s*(visits?|times)|\d+ days?( in a row)?|streak)\b/i.test(homeText.replace(/Tested in \d+ days/, "")),
      homeText.split("\n").slice(0, 3).join(" | "));

console.log("\n— the games —");
if (!liveWeek) {
  console.log("  skip  no term week today");
} else {
  const content = gameData.weeks[liveWeek.id];
  const readPoints = () => g.evaluate(async () => {
    const db = await new Promise((res) => { const r = indexedDB.open("spelling", 1); r.onsuccess = () => res(r.result); });
    return await new Promise((res) => {
      const t = db.transaction("kv", "readonly").objectStore("kv").get("game_points");
      t.onsuccess = () => res(t.result ? t.result.value : { earned: 0, rounds: 0 });
    });
  });
  const wordForClue = (clue) => liveWeek.words.find((w) => gameData.words[w].meaning === clue);

  await g.click("#btn-games");
  await g.waitForSelector("#screen-games.on");
  check("the games hub shows this week's theme",
        (await g.textContent("#games-week")).includes(liveWeek.theme));
  check("the bonus round starts locked, with points to go",
        await g.locator("#game-bonus").isDisabled()
        && /more points/.test(await g.textContent("#games-bonus-state")));

  // --- word jigsaw: solve a round, getting ONE word wrong first on purpose
  await g.click("#game-jigsaw");
  await g.waitForSelector("#screen-jigsaw.on");
  let decoyTried = false, expected = 0, leftMisspelling = false, jigOk = true;
  for (let i = 0; i < 5; i++) {
    const word = wordForClue(await g.textContent("#jig-clue"));
    if (!word) { jigOk = false; break; }
    const c = gameData.words[word];
    const place = async (text) => g.click(`#jig-tray .piece[data-text="${text}"]`);
    if (!decoyTried && c.decoys.length) {
      for (const p of c.parts.slice(0, -1)) await place(p.text);
      await place(c.decoys[0].text);
      await g.click("#jig-check");
      await g.waitForTimeout(500);
      const fb = await g.textContent("#jig-feedback");
      const board = await g.$$eval("#jig-board .piece", (ps) => ps.map((p) => p.dataset.text).join(""));
      leftMisspelling = board.endsWith(c.decoys[0].text);
      check("a wrong ending is explained, and bounces back off the board",
            /Not that ending/.test(fb) && !leftMisspelling, `${fb} | board: ${board}`);
      const jigCard = g.locator("#jig-support .support");
      check("a wrong jigsaw check shows the word's support",
            (await jigCard.count()) === 1 && await jigCard.isVisible()
            && (await jigCard.getAttribute("data-shows")) === "etymology say");
      await place(c.parts[c.parts.length - 1].text);
      decoyTried = true;
    } else {
      for (const p of c.parts) await place(p.text);
      expected += 10;
    }
    await g.click("#jig-check");
    const next = await g.waitForSelector("#jig-next:not([hidden])", { timeout: 3000 })
      .then(() => true).catch(() => false);
    if (!next || !/\./.test(await g.textContent("#jig-feedback"))) jigOk = false;
    await g.click("#jig-next");
  }
  // Finishing saves the round before it says so: wait for the screen, not a timer.
  const finished = await g.waitForFunction(() =>
    document.querySelector("#jig-count").textContent === "Round finished", null, { timeout: 5000 })
    .then(() => true).catch(() => false);
  const afterJig = await readPoints();
  check("a jigsaw round is solved by building each word from its parts",
        jigOk && finished,
        await g.textContent("#jig-clue"));
  check("points come only for words right at the first go", afterJig.earned === expected,
        `${afterJig.earned} points, expected ${expected}`);

  // --- root match: one wrong link first, then all five
  await g.click("#jig-quit");
  await g.click("#game-match");
  await g.waitForSelector("#screen-match.on");
  const lefts = await g.$$eval("#match-left button", (bs) => bs.map((b) => b.textContent));
  const meanOf = (part) => content.roots.find((r) => r.part === part).means;
  const exactly = (t) => new RegExp(`^${t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`);
  // Unmatched buttons only, by their whole text: a matched one has grown a caption.
  const leftBtn = (part) => g.locator("#match-left button:not(.matched)").filter({ hasText: exactly(part) });
  const rightBtn = (means) => g.locator("#match-right button:not(.matched)").filter({ hasText: exactly(means) });
  await leftBtn(lefts[0]).click();
  await rightBtn(meanOf(lefts[1])).click();
  check("a wrong link is drawn and taken back", /Not those two/.test(await g.textContent("#match-feedback")));
  await g.waitForTimeout(800);
  for (const part of lefts) {
    await leftBtn(part).click();
    await rightBtn(meanOf(part)).click();
  }
  const lines = await g.locator("#match-lines path").count();
  check("every match leaves a swirly line between the pair", lines === lefts.length, `${lines} lines`);
  const afterMatch = await readPoints();
  check("the pair got wrong first earns nothing, the rest earn 5",
        afterMatch.earned - afterJig.earned === 5 * (lefts.length - 1),
        `+${afterMatch.earned - afterJig.earned}`);

  // --- pattern sort: quick when right, a moment to reflect when not (docs/15, 1 October)
  await g.click("#match-quit");
  if (!content.sort) {
    console.log("  skip  no pattern sort this week");
  } else {
    await g.click("#game-sort");
    await g.waitForSelector("#screen-sort.on");
    const level = () => g.getAttribute("#sort-scene", "data-level");
    // Waits for a fresh card. A fresh card has an open gap; an answered one has the gap
    // filled or, for "no hyphen", gone, and that card then reads exactly as it did before,
    // so the text alone cannot tell the old card from the next. Undefined: the round is over.
    const cardShown = async () => {
      const open = await g.waitForSelector("#sort-card .gap:not(.filled)", { timeout: 3000 })
        .then(() => true).catch(() => false);
      if (!open) return undefined;
      const shown = await g.textContent("#sort-card");
      return content.sort.cards.find((c) => c.show[0] + c.show[1] === shown);
    };
    const wrongFor = (card) => content.sort.bins.find((b) => b.key !== card.answer).key;
    // The deck can hold contrast cards that are not one of the school's words (return
    // beside re-enter, 'a man eating chips' beside man-eating). A miss on one shows the
    // rule and no help card, because there is no word to help with. The checks below are
    // about help, so they need an opening card that has a word. A round that opens on a
    // contrast card is used to check that contract, then left and started again.
    let opening = await cardShown();
    let contrastChecked = false;
    for (let tries = 0; tries < 12 && opening && !opening.word; tries++) {
      if (!contrastChecked) {
        contrastChecked = true;
        await g.click(`#sort-bins button[data-key="${wrongFor(opening)}"]`);
        check("a miss on a contrast card shows the rule and no help card, and the bins rest then return",
              /Not this time/.test(await g.textContent("#sort-feedback"))
              && (await g.locator("#sort-support .support").count()) === 0
              && (await g.locator("#sort-bins.resting").count()) === 1);
        await g.waitForSelector("#sort-bins:not(.resting)", { timeout: 8000 });
      }
      await g.click("#sort-quit");
      await g.click("#game-sort");
      await g.waitForSelector("#screen-sort.on");
      opening = await cardShown();
    }
    let sortRight = 0, first = true, quietRight = true;
    const runSounds = [];
    const animals = () => g.locator('#sort-scene g.layer[data-kind="animal"]').count();
    const animalsSeen = {};
    for (let i = 0; i < 10; i++) {
      const card = await cardShown();
      if (!card) break;
      if (first) {
        await g.click(`#sort-bins button[data-key="${wrongFor(card)}"]`);
        const missedAt = Date.now();
        check("a card in the wrong bin gets the rule, not a buzzer",
              /Not this time/.test(await g.textContent("#sort-feedback")));
        const sup = g.locator("#sort-support .support");
        check("a miss shows the word's support: before the experiment, where it comes from and how to say it",
              (await sup.count()) === 1 && await sup.isVisible()
              && (await sup.getAttribute("data-shows")) === "etymology say",
              (await sup.count()) ? await sup.getAttribute("data-shows") : "no support card");
        check("the bins rest while she reads, and nothing counts down",
              (await g.locator("#sort-bins.resting").count()) === 1
              && (await g.locator("#sort-bins button:disabled").count()) === content.sort.bins.length
              && !/\b\d+\s*(s|secs?|seconds?)\b/i.test(await g.innerText("#screen-sort")));
        check("a miss ends the run and steps the background back, never below nothing",
              (await level()) === "0" && (await g.getAttribute("#screen-sort", "data-run")) === "0");
        await g.waitForSelector("#sort-bins:not(.resting)", { timeout: 8000 });
        const rested = Date.now() - missedAt;
        check("the bins come back by themselves after a few seconds", rested > 2500 && rested < 6000,
              `${rested} ms`);
        await g.click(`#sort-bins button[data-key="${card.answer}"]`);
        first = false;
      } else {
        sortRight += 1;
        const before = await g.evaluate(() => window.__tones.length);
        await g.click(`#sort-bins button[data-key="${card.answer}"]`);
        const tones = await g.evaluate((n) => window.__tones.slice(n), before);
        if ((await g.textContent("#sort-feedback")).trim() !== "+5") quietRight = false;
        if (sortRight <= 2) animalsSeen[sortRight] = await animals();
        // A run's climb is the only sound in the app that reaches top C, 1046.5 Hz.
        if (tones.includes(1047)) runSounds.push(sortRight);
      }
      await g.waitForTimeout(1250);
    }
    check("a sort round ends with the pattern laid out in its bins",
          await g.locator("#sort-result").isVisible()
          && (await g.locator("#sort-result li").count()) === 10);
    const afterSort = await readPoints();
    check("sorting earns 5 a card at the first go",
          afterSort.earned - afterMatch.earned === 5 * sortRight, `+${afterSort.earned - afterMatch.earned}`);
    check("a right answer gets no note, only its points", sortRight > 0 && quietRight);
    const milestones = [3, 5, 7, 9].filter((n) => n <= sortRight);
    check("right answers in a row at the first go sound at 3, 5, 7 and 9, and only then",
          runSounds.join() === milestones.join(), `heard at ${runSounds.join(", ") || "none"}`);
    const layers = await g.locator("#sort-scene svg > g.layer").count();
    const maxLevel = await g.evaluate(async () => (await import("./js/scene.js")).MAX);
    check("the background gains a layer for each right answer at the first go",
          (await level()) === String(Math.min(maxLevel, sortRight)) && layers === Math.min(maxLevel, sortRight),
          `level ${await level()}, ${layers} layers`);
    check("the first animal arrives with her second right answer, and not before",
          animalsSeen[1] === 0 && animalsSeen[2] === 1, JSON.stringify(animalsSeen));
    const poly = await g.evaluate(async () => {
      const sfx = await import("./js/sfx.js");
      const notes = (n) => {
        const before = window.__tones.length;
        return sfx.playRun(n) ? window.__tones.length - before : 0;
      };
      return { 9: notes(9), 10: notes(10), 11: notes(11), 13: notes(13), 21: notes(21), 23: notes(23) };
    });
    check("from 11 in a row it turns polyphonic, gaining a voice every two, up to six",
          poly[10] === 0 && poly[11] > 2 * poly[9] && poly[13] === poly[11] + 1
          && poly[21] === poly[11] + 3 && poly[23] === poly[21], JSON.stringify(poly));
    let sortLog = null;
    for (let n = 0; n < 20 && !sortLog; n++) {
      sortLog = ((await readKV(g, "game_log")) || []).filter((r) => r.game === "sort").pop();
      if (!sortLog) await g.waitForTimeout(100);
    }
    check("the round log says which card had support, and that nothing listened",
          sortLog && sortLog.items[0].support === "etymology say" && sortLog.items[0].said === null
          && sortLog.items.slice(1).every((x) => x.support === null),
          sortLog ? JSON.stringify(sortLog.items[0]) : "no entry");

    // "Another round" is the same sitting, so the background stays; a miss in it takes
    // back ONE layer. The first build took two, which kept the page near empty at a
    // realistic hit rate (docs/11, 6 October 2026).
    await g.click("#sort-again");
    const second = await cardShown();
    const before = Number(await level());
    check("another round keeps the background it had", before === Math.min(maxLevel, sortRight),
          `level ${before}`);
    await g.click(`#sort-bins button[data-key="${wrongFor(second)}"]`);
    check("a miss takes back one layer, not two", before > 1 && Number(await level()) === before - 1,
          `${before} then ${await level()}`);

    // Leaving during a pause, or just after a right answer, and coming straight back
    // must start a clean round: no bins left resting, no old timer moving it on.
    await g.click("#sort-quit");
    await g.click("#game-sort");
    await g.waitForSelector("#screen-sort.on");
    await g.click(`#sort-bins button[data-key="${wrongFor(await cardShown())}"]`);
    await g.click("#sort-quit");
    await g.click("#game-sort");
    await g.waitForSelector("#screen-sort.on");
    const cleanAfterPause = (await g.locator("#sort-bins.resting").count()) === 0
      && (await g.locator("#sort-bins button:disabled").count()) === 0;
    await g.click(`#sort-bins button[data-key="${(await cardShown()).answer}"]`, { timeout: 1000 })
      .catch(() => {});
    await g.click("#sort-quit");
    await g.click("#game-sort");
    await g.waitForSelector("#screen-sort.on");
    await g.waitForTimeout(4200);        // past the old pause and the old next-card timer
    check("leaving mid-pause or mid-move and coming straight back starts a clean round",
          cleanAfterPause && (await g.textContent("#sort-count")) === "Card 1 of 10"
          && (await g.locator("#sort-bins button:disabled").count()) === 0 && (await level()) === "0",
          `${cleanAfterPause ? "" : "bins left resting; "}${await g.textContent("#sort-count")}, level ${await level()}`);
    await g.click("#sort-quit");
  }

  // --- hangman: a hint, a miss, a wrong whole-word guess, letters by tap and by
  // keyboard, a typed solve, and one word lost on purpose
  await g.waitForSelector("#screen-games.on");
  const readLog = () => g.evaluate(async () => {
    const db = await new Promise((res) => { const r = indexedDB.open("spelling", 1); r.onsuccess = () => res(r.result); });
    return await new Promise((res) => {
      const t = db.transaction("kv", "readonly").objectStore("kv").get("game_log");
      t.onsuccess = () => res(t.result ? t.result.value : []);
    });
  });
  const beforeHang = await readPoints();
  await g.click("#game-hangman");
  await g.waitForSelector("#screen-hangman.on");
  check("hangman has a hyphen key every week, so a hyphen is never given away",
        (await g.locator('#hang-keys button[data-key="-"]').count()) === 1);
  const slots = () => g.$$eval("#hang-word .slot", (ss) => ss.map((s) => s.textContent));
  const guessedKeys = () => g.$$eval("#hang-keys button:disabled", (bs) => bs.map((b) => b.dataset.key));
  // Which of this week's words fit what is showing: never read from the page's state.
  const candidates = async () => {
    const shown = await slots();
    const guessed = await guessedKeys();
    return liveWeek.words.filter((w) => w.length === shown.length
      && [...w].every((ch, i) => (shown[i] ? shown[i] === ch : !guessed.includes(ch)))
      && guessed.every((k) => shown.includes(k) || !w.includes(k)));
  };
  const fallen = () => g.locator("#hang-petals .fallen").count();
  const press = async (k, keyboard) => {
    if (keyboard) await g.keyboard.press(k === "-" ? "Minus" : k);
    else await g.click(`#hang-keys button[data-key="${k}"]`);
  };
  const byLetters = async (keyboard = false) => {
    for (let n = 0; n < 40 && !(await g.locator("#hang-next").isVisible()); n++) {
      const cs = await candidates();
      if (!cs.length) return false;
      const guessed = await guessedKeys();
      await press([...cs[0]].find((ch) => !guessed.includes(ch)), keyboard);
    }
    return /You got it/.test(await g.textContent("#hang-feedback"));
  };
  const hangWords = [];

  // Word 1: the hint, a miss, then the whole word typed.
  await g.click("#hang-hint");
  const afterHint = await slots();
  check("the hint fills in the first letter of the word, marked as given",
        afterHint[0] !== "" && (await g.locator("#hang-word .slot.given").count()) >= 1
        && await g.locator("#hang-hint").isDisabled(), afterHint.join("") || "(nothing shown)");
  const safe = [..."qjzxkfwvmgdupbhylc"].filter((k) =>
    !(liveWeek.words.filter((w) => w.length === afterHint.length)).some((w) => w.includes(k)));
  if (safe.length) {
    await press(safe[0]);
    check("a wrong letter drops a petal and is crossed out on its key, nowhere else",
          (await fallen()) === 1 && /7 petals left/.test(await g.textContent("#hang-left"))
          && (await g.getAttribute(`#hang-keys button[data-key="${safe[0]}"]`, "class")).includes("miss")
          && !(await slots()).includes(safe[0]));
  }
  // Type each word that still fits, in capitals: a wrong one costs a petal, and
  // guessing letters to narrow it down could finish the word before it is typed
  // (device and devise differ only in their last new letter).
  let typed = null;
  for (const guess of await candidates()) {
    await g.fill("#hang-input", guess.toUpperCase());
    await g.click("#hang-solve");
    if (/You knew it/.test(await g.textContent("#hang-feedback"))) { typed = guess; break; }
  }
  hangWords.push(typed);
  check("typing the whole word solves it", !!typed
        && (await g.textContent("#hang-reveal .whole")) === typed, String(typed));
  check("a word solved with a hint earns half", /\+5\b/.test(await g.textContent("#hang-feedback")),
        await g.textContent("#hang-feedback"));
  await g.click("#hang-next");

  // Word 2: a wrong whole-word guess costs a petal and disappears, then letters.
  await g.fill("#hang-input", "zzzz");
  await g.press("#hang-input", "Enter");
  check("a wrong whole-word guess costs a petal and never stays on screen",
        (await fallen()) === 1 && (await g.inputValue("#hang-input")) === ""
        && /not it/.test(await g.textContent("#hang-feedback")));
  const solved2 = await byLetters();
  hangWords.push((await slots()).join(""));
  check("guessing letters by tap solves a word", solved2);
  await g.click("#hang-next");

  // Word 3: a keyboard, where there is one, guesses letters too.
  await g.click("#hang-count");     // focus off the text box
  const solved3 = await byLetters(true);
  hangWords.push((await slots()).join(""));
  check("guessing letters on a keyboard solves a word", solved3);
  await g.click("#hang-next");

  // Word 4: letters again.
  const solved4 = await byLetters();
  hangWords.push((await slots()).join(""));
  await g.click("#hang-next");

  // Word 5: lost on purpose, with letters no word of that length contains.
  const len5 = (await slots()).length;
  const none5 = [..."abcdefghijklmnopqrstuvwxyz-"].filter((k) =>
    !liveWeek.words.filter((w) => w.length === len5).some((w) => w.includes(k)));
  let lost = false;
  if (none5.length >= 8) {
    for (const k of none5.slice(0, 8)) await press(k);
    const shown = await slots();
    lost = /Out of petals/.test(await g.textContent("#hang-feedback"));
    check("out of petals, the word is shown whole, in its parts, with its rule",
          lost && shown.every((c) => c !== "") && (await g.textContent("#hang-reveal .whole")) === shown.join("")
          && (await g.locator("#hang-reveal > p.muted").textContent()).length > 10, shown.join(""));
    const lostCard = g.locator("#hang-reveal .support");
    check("a lost word gets its support too",
          (await lostCard.count()) === 1 && (await lostCard.getAttribute("data-shows")) === "etymology say");
    hangWords.push(shown.join(""));
  } else {
    console.log("  skip  no eight letters are missing from every word of that length");
    await byLetters();
    hangWords.push((await slots()).join(""));
  }
  await g.click("#hang-next");
  const afterHang = await readPoints();
  const hangExpected = 5 + (solved2 ? 10 : 0) + (solved3 ? 10 : 0) + (solved4 ? 10 : 0) + (lost ? 0 : 10);
  check("hangman earns 10 a word solved, 5 with a hint, nothing for a lost one",
        afterHang.earned - beforeHang.earned === hangExpected,
        `+${afterHang.earned - beforeHang.earned}, expected +${hangExpected}`);
  // The round is saved just after its last screen appears.
  let hangLog = null;
  for (let n = 0; n < 20 && !hangLog; n++) {
    hangLog = (await readLog()).filter((r) => r.game === "hangman").pop();
    if (!hangLog) await g.waitForTimeout(100);
  }
  check("a hangman round is logged, word by word",
        hangLog && hangLog.items.length === 5 && hangLog.items[0].hint === true
        && hangLog.items.map((i) => i.word).join() === hangWords.join(),
        hangLog ? hangLog.items.map((i) => i.word).join() : "no entry");
  check("the round ends with what was solved, and how",
        /4 of 5 solved, 3 without a hint|5 of 5 solved, 4 without a hint/.test(await g.textContent("#hang-feedback")),
        await g.textContent("#hang-feedback"));
  await g.click("#hang-quit");

  // --- hidden words: a hint, taps, a slide, and every word found
  await g.waitForSelector("#screen-games.on");
  const beforeHunt = await readPoints();
  await g.click("#game-hunt");
  await g.waitForSelector("#screen-hunt.on");
  const letters = async () => (await g.$$eval("#hunt-grid .hunt-cell", (xs) => xs.map((x) => x.textContent))).join("");
  const block = content.blocks[0];
  check("the first block is the week's first, from engine/wordblocks.py", (await letters()) === block.letters);
  const cell = (i) => g.locator("#hunt-grid .hunt-cell").nth(i);
  const tap = async (cells) => { for (const c of cells) await cell(c).click(); };
  const onCells = () => g.$$eval("#hunt-grid .hunt-cell.on", (xs) => xs.map((x) => Number(x.dataset.i)));
  const own = (b, w, t = b.tilings[0]) => b.routes[w][t[w]];
  await g.click("#hunt-hint");
  const ring1 = await g.$$eval("#hunt-grid .hunt-cell.hint", (xs) => xs.map((x) => Number(x.dataset.i)));
  await g.click("#hunt-hint");
  const ring2 = await g.$$eval("#hunt-grid .hunt-cell.hint", (xs) => xs.map((x) => Number(x.dataset.i)));
  // The page lists ringed cells in page order, which cannot say which was rung first,
  // and a route can run either way along a row (this week's first block starts at 41 and
  // goes to 40). So the second ring is compared as the same two cells, not in order.
  const cellsOf = (xs) => [...xs].sort((x, y) => x - y).join();
  check("a hint rings where a word starts, and asking again rings its next letter",
        ring1.join() === String(own(block, 0)[0])
        && cellsOf(ring2) === cellsOf(own(block, 0).slice(0, 2)),
        `${ring1} then ${ring2}`);
  const r1 = own(block, 1);
  await tap(r1.slice(0, 2));
  const two = await onCells();
  await cell(r1[1]).click();
  const one = await onCells();
  await g.click("#hunt-clear");
  const same = (a, b) => [...a].sort((x, y) => x - y).join() === [...b].sort((x, y) => x - y).join();
  check("letters join a trace one after another, and tapping the last again takes it back",
        same(two, r1.slice(0, 2)) && same(one, [r1[0]])
        && (await onCells()).length === 0, `${two} then ${one}`);
  await tap(own(block, 0));
  const kinds0 = gameData.words[block.words[0]].parts.flatMap((p) => [...p.text].map(() => p.kind));
  const classes0 = await Promise.all(own(block, 0).map((c) => cell(c).getAttribute("class")));
  check("a found word takes the colours of its parts, letter by letter",
        classes0.every((cl, k) => cl.includes("found") && cl.includes(`k-${kinds0[k]}`)),
        `${block.words[0]}: ${kinds0.join(" ")}`);
  check("a word found after a hint earns half",
        /Found .*\+5\b/.test(await g.textContent("#hunt-feedback")), await g.textContent("#hunt-feedback"));
  await cell(own(block, 0)[0]).click();
  check("a found letter is spent: tapping it starts nothing", (await onCells()).length === 0);
  // Word 2 by sliding a finger through it.
  const centres = await g.$$eval("#hunt-grid .hunt-cell", (xs) => xs.map((x) => {
    const r = x.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2];
  }));
  await g.mouse.move(...centres[r1[0]]);
  await g.mouse.down();
  for (const c of r1.slice(1)) await g.mouse.move(...centres[c], { steps: 5 });
  await g.mouse.up();
  check("sliding through the letters finds a word too",
        (await g.textContent("#hunt-feedback")).startsWith(`Found ${block.words[1]}!`),
        await g.textContent("#hunt-feedback"));
  for (let w = 2; w < block.words.length; w++) await tap(own(block, w));
  await g.waitForSelector("#hunt-again:not([hidden])", { timeout: 3000 }).catch(() => {});
  check("finding every word finishes the block",
        new RegExp(`All ${block.words.length} found, ${block.words.length - 1} without a hint`)
          .test(await g.textContent("#hunt-feedback"))
        && await g.locator("#hunt-again").isVisible()
        && (await g.locator("#hunt-grid .hunt-cell.found").count()) === block.letters.length,
        await g.textContent("#hunt-feedback"));
  check("the found words are listed, in their colours",
        (await g.textContent("#hunt-found")) === block.words.join("")
        && (await g.locator("#hunt-found .part").count()) >= block.words.length);
  const afterHunt = await readPoints();
  check("hidden words earns 10 a word, 5 with a hint",
        afterHunt.earned - beforeHunt.earned === 5 + 10 * (block.words.length - 1),
        `+${afterHunt.earned - beforeHunt.earned}`);
  const huntLines = await g.locator("#hunt-lines polyline.word").count();
  check("every found word has its line, underneath the letters", huntLines === block.words.length,
        `${huntLines} lines`);

  // --- a route that spells the word but would strand the others still counts
  const orphanAt = content.blocks.findIndex((b) => b.routes.some((rs, w) =>
    rs.some((_, j) => !b.tilings.some((t) => t[w] === j))));
  if (orphanAt < 0) {
    console.log("  skip  no block this week has a route that would strand the others");
  } else {
    // The next block follows the number logged this week, so log enough to reach it.
    const extra = (orphanAt - 1 + content.blocks.length) % content.blocks.length;
    await g.evaluate(async ({ week, n }) => {
      const db = await new Promise((res) => { const r = indexedDB.open("spelling", 1); r.onsuccess = () => res(r.result); });
      const log = await new Promise((res) => {
        const t = db.transaction("kv", "readonly").objectStore("kv").get("game_log");
        t.onsuccess = () => res(t.result ? t.result.value : []);
      });
      for (let i = 0; i < n; i++) log.push({ at: new Date().toISOString(), game: "hunt", week, items: [], points: 0 });
      await new Promise((res) => {
        const t = db.transaction("kv", "readwrite");
        t.objectStore("kv").put({ key: "game_log", value: log });
        t.oncomplete = res;
      });
    }, { week: liveWeek.id, n: extra });
    await g.click("#hunt-again");
    const ob = content.blocks[orphanAt];
    await g.waitForFunction((L) => [...document.querySelectorAll("#hunt-grid .hunt-cell")]
      .map((x) => x.textContent).join("") === L, ob.letters, { timeout: 3000 }).catch(() => {});
    check("another block is the next one in the week", (await letters()) === ob.letters);
    const [w, j] = ob.routes.flatMap((rs, wi) => rs.map((_, ji) => [wi, ji]))
      .find(([wi, ji]) => !ob.tilings.some((t) => t[wi] === ji));
    await tap(ob.routes[w][j]);
    const foundCells = await g.$$eval("#hunt-grid .hunt-cell.found", (xs) => xs.map((x) => Number(x.dataset.i)));
    const k = ob.routes[w].findIndex((r) => [...r].sort((a, b) => a - b).join() === [...foundCells].sort((a, b) => a - b).join());
    check("a right spelling along a route that would strand the rest still counts, moved to one that fits",
          /In this block it fits here/.test(await g.textContent("#hunt-feedback"))
          && k >= 0 && ob.tilings.some((t) => t[w] === k), `${ob.words[w]}: route ${j} became ${k}`);
    const t = ob.tilings.find((x) => x[w] === k);
    if (t) for (let v = 0; v < ob.words.length; v++) if (v !== w) await tap(ob.routes[v][t[v]]);
    await g.waitForSelector("#hunt-again:not([hidden])", { timeout: 3000 }).catch(() => {});
    check("and the block can still be finished",
          /All \d+ found/.test(await g.textContent("#hunt-feedback")), await g.textContent("#hunt-feedback"));
  }
  await g.click("#hunt-quit");

  // --- the bonus round: open, answer every square, one wrong on purpose
  await g.waitForSelector("#screen-games.on");
  const beforeBonus = await readPoints();
  const canPlay = Math.floor(beforeBonus.earned / 50) - beforeBonus.rounds > 0;
  check("enough points open the bonus round", canPlay === !(await g.locator("#game-bonus").isDisabled()),
        `${beforeBonus.earned} points`);
  if (canPlay) {
    await g.click("#game-bonus");
    await g.waitForSelector("#screen-bonus.on");
    const tiles = await g.locator("#bonus-board button").count();
    let right = 0, typedWrong = false;
    for (let t = 0; t < tiles; t++) {
      await g.click(`#bonus-board button >> nth=${t}`);
      const clue = await g.textContent("#bonus-clue-text");
      const word = Object.keys(gameData.words).find((w) => gameData.words[w].meaning === clue);
      await g.fill("#bonus-input", typedWrong ? word : "zzz");
      await g.click("#bonus-check");
      if (!typedWrong) {
        typedWrong = true;
        check("a wrong answer shows her attempt against the word, with the why",
              (await g.textContent("#bonus-marked")) === "zzz"
              && (await g.textContent("#bonus-why")).startsWith(word),
              await g.textContent("#bonus-why"));
        check("and the word's support", (await g.locator("#bonus-support .support").count()) === 1
              && await g.locator("#bonus-support").isVisible());
      } else if (/Correct/.test(await g.textContent("#bonus-verdict"))) {
        right += 1;
      }
      await g.click("#bonus-back");
    }
    await g.waitForSelector("#bonus-end:not([hidden])", { timeout: 5000 }).catch(() => {});
    const end = await g.textContent("#bonus-end-text");
    const after = await readPoints();
    check("the bonus round is typed recall, marked by the real classifier",
          tiles === 9 && /You scored \d+/.test(end), end);
    check("playing the bonus round uses it up", after.rounds === beforeBonus.rounds + 1,
          `${after.rounds} played`);
    check("every word typed right is marked right", right === tiles - 1, `${right} of ${tiles - 1}`);
    await g.click("#bonus-quit");
  }

  // --- none of it reaches the practice screens
  await g.click("#games-home");
  await g.waitForSelector("#screen-home.on");
  const leaksAfter = await g.evaluate((ids) => ids.map((id) => {
    const el = document.querySelector(`#screen-${id}`);
    el.style.display = "block";
    const text = el.innerText;
    el.style.display = "";
    return [id, text];
  }), CHILD_SCREENS);
  const hit = leaksAfter.map(([id, t]) => [id, t.match(BANNED)]).find(([, m]) => m);
  check("points never reach the practice screens, even once she has some", !hit,
        hit ? `${hit[0]}: "${hit[1][0]}"` : "");

  // --- the adult's view and the export
  await g.click("#btn-grownup");
  await g.waitForSelector("#screen-grownup.on");
  check("the grown-up view reports the games against dictation",
        /jigsaw/.test(await g.textContent("#gu-games-summary"))
        && /dictation sessions/.test(await g.textContent("#gu-games-summary")));
  check("before it starts, the experiment card says so, with no table",
        /^Not started/.test(await g.textContent("#gu-exp-state")) && await g.locator("#gu-exp-table").isHidden());
  check("with sync off there is nowhere to paste a Firebase config", await g.locator("#gu-fb-config").isHidden());
  check("the microphone stays off until a grown-up switches it on, and nothing asked for it",
        (await g.inputValue("#opt-voice")) === "off" && (await g.evaluate(() => window.__gum)) === 0);
  const [download] = await Promise.all([g.waitForEvent("download"), g.click("#gu-export")]);
  const exported = readFileSync(await download.path(), "utf8");
  check("the export carries the games but never her name",
        exported.includes("game_points") && !/Zinnia/.test(exported));

  // --- sharing: the address, and nothing about her
  await g.click("#gu-home");
  await g.waitForSelector("#screen-home.on");
  check("with sync off, the welcome page has no note about totals", await g.locator("#home-sync-note").isHidden());
  // The device's share sheet and clipboard are stubbed, to see exactly what would leave.
  await g.evaluate(() => {
    window.__shared = [];
    window.__copied = [];
    navigator.share = async (d) => { window.__shared.push(d); };
    Object.defineProperty(navigator, "clipboard", { configurable: true,
      value: { writeText: async (t) => { window.__copied.push(t); } } });
  });
  check("the welcome page has one Share button, labelled for a child, and no second link",
        (await g.locator("#btn-share").count()) === 1
        && (await g.textContent("#btn-share")).trim() === "Share this with your friends");
  await g.click("#btn-share");
  await g.waitForSelector("#screen-share.on");
  const qr = await g.waitForFunction(() => {
    const i = document.querySelector("#screen-share img");
    return i && i.complete && i.naturalWidth > 0 ? i.getAttribute("src") : null;
  }, null, { timeout: 3000 }).then((h) => h.jsonValue()).catch(() => null);
  const shareText = await g.innerText("#screen-share");
  check("Share shows a QR code of the address, and says nothing about her goes with it",
        qr === "img/share-qr.svg" && shareText.includes("www.tsttalent.com/Spelling")
        && /Nothing about you goes with it/.test(shareText), qr || "no image");
  const notice = await (await fetch(new URL("privacy.html", BASE))).text();
  check("the share screen links a notice for grown-ups, and it is served",
        (await g.locator('#screen-share a[href="privacy.html"]').count()) === 1
        && /stays on your tablet/.test(notice) && /never a word your child/.test(notice));
  const ADDRESS = "https://www.tsttalent.com/Spelling";
  check("where the device can share, Send the link is offered", await g.locator("#share-send").isVisible());
  await g.click("#share-send");
  const sent = await g.evaluate(() => window.__shared);
  check("Send the link hands over a title, a plain sentence and the address, and nothing else",
        sent.length === 1 && Object.keys(sent[0]).sort().join() === "text,title,url"
        && sent[0].url === ADDRESS && /^A spelling game for Year 5 and 6/.test(sent[0].text)
        && !/[?#]/.test(sent[0].url) && !/Zinnia|Example/.test(JSON.stringify(sent[0])), JSON.stringify(sent[0]));
  await g.click("#share-copy");
  await g.waitForFunction(() => document.querySelector("#share-note").textContent.length > 0);
  const copied = await g.evaluate(() => window.__copied);
  check("Copy the link puts the same sentence and the address on the clipboard, and says so",
        copied.length === 1 && copied[0] === `${sent[0].text}\n${ADDRESS}`
        && /^Copied/.test(await g.textContent("#share-note")), JSON.stringify(copied));
  await g.click("#share-back");
  await g.waitForSelector("#screen-home.on");

  // --- the grown-up's message for other parents
  await g.click("#btn-grownup");
  await g.waitForSelector("#screen-grownup.on");
  const parentText = await g.textContent("#gu-share-text");
  check("the grown-up view has a message for other parents: what it is, what it keeps, the address",
        /A spelling game for Years 5 and 6/.test(parentText) && /keeps what a child types on their own device/.test(parentText)
        && parentText.includes(ADDRESS) && parentText.includes("/privacy.html")
        && !/Zinnia|Example/.test(parentText));
  await g.click("#gu-share-copy");
  await g.waitForFunction(() => document.querySelector("#gu-share-note").textContent.length > 0);
  const copiedParents = await g.evaluate(() => window.__copied.at(-1));
  check("copying it puts exactly that message on the clipboard",
        copiedParents.replace(/\s+/g, " ") === parentText.replace(/\s+/g, " "), copiedParents.slice(0, 60));
  await g.click("#gu-share-send");
  const sentParents = await g.evaluate(() => window.__shared.at(-1));
  check("sending it hands over only a title, the message and the address",
        Object.keys(sentParents).sort().join() === "text,title,url" && sentParents.url === ADDRESS
        && !/[?#]/.test(sentParents.url), JSON.stringify(sentParents).slice(0, 80));
  await g.click("#gu-home");
  await g.waitForSelector("#screen-home.on");

  // --- the new screens fit an iPad
  for (const [name, vw, vh] of [["iPad portrait", 820, 1180], ["iPad landscape", 1180, 820]]) {
    await g.setViewportSize({ width: vw, height: vh });
    for (const s of ["games", "jigsaw", "match", "sort", "hangman", "hunt", "bonus", "share", "week"]) {
      const res = await g.evaluate((id) => {
        for (const x of document.querySelectorAll(".screen")) x.classList.toggle("on", x.id === `screen-${id}`);
        const over = document.documentElement.scrollWidth > document.documentElement.clientWidth + 1;
        const small = [...document.querySelectorAll(`#screen-${id} button`)]
          .filter((b) => b.offsetParent !== null)
          .filter((b) => Math.min(b.getBoundingClientRect().width, b.getBoundingClientRect().height) < 44)
          .length;
        return { over, small };
      }, s);
      check(`${name}: the ${s} screen fits, with every tap target 44px or more`,
            !res.over && res.small === 0, JSON.stringify(res));
    }
  }
}
check("the welcome and the games raise no page errors", gErrors.length === 0, gErrors.join(" | "));
await gctx.close();

// ---------------------------------------------------------------- the support experiment
// experiments/2026-10-support-types.md. The shipped content is unreviewed, so the
// experiment is off. This context serves the same file marked reviewed, which is
// exactly what flipping engine/supports.py REVIEWED will ship.
console.log("\n— the support experiment, once it starts —");
const supportData = await (await fetch(new URL("data/supports.json", BASE))).json();
check("the shipped quotations are not yet reviewed, so the experiment is off", supportData.reviewed === false);
const SHOWS = { etymology: "etymology", story: "story", say: "say", blend: "etymology story say" };
const xctx = await browser.newContext({ viewport: { width: 820, height: 1180 }, acceptDownloads: true });
await fixClock(xctx);
await noClips(xctx);
await xctx.route("**/data/supports.json", (r) => r.fulfill({
  contentType: "application/json", body: JSON.stringify({ ...supportData, reviewed: true }) }));
const x = await xctx.newPage();
const xErrors = [];
const xRequests = [];
x.on("pageerror", (e) => xErrors.push(e.message));
x.on("request", (r) => xRequests.push(r.url()));
await x.goto(BASE, { waitUntil: "networkidle" });
await x.waitForSelector("#screen-home.on");
const xSeed = await readKV(x, "experiment_seed");
const xArms = (await readKV(x, "support_arms")) || {};
check("it mints one seed on this device and gives every word one arm",
      Number.isInteger(xSeed) && Object.keys(xArms).length === Object.keys(supportData.words).length
      && Object.values(xArms).every((a) => a in SHOWS), `${Object.keys(xArms).length} words`);
await x.click("#btn-practise");
await x.waitForSelector("#screen-attempt.on");
await x.fill("#attempt-input", "zzz");
await x.click("#attempt-submit");
await x.waitForSelector("#screen-reveal.on");
const xWord = (await x.textContent("#reveal-target")).trim();
const xArm = xArms[xWord] || null;
if (!xArm) {
  console.log(`  skip  ${xWord} is not in the experiment`);
} else {
  const card = x.locator("#reveal-support .support");
  check("a miss on the answer screen shows the word's own arm, and only that",
        (await card.count()) === 1 && (await card.getAttribute("data-shows")) === SHOWS[xArm],
        `${xWord}: ${xArm}`);
  if (SHOWS[xArm].includes("story")) {
    check("a story says where it is from", (await card.textContent()).includes(supportData.words[xWord].story.source));
  }
  check("where it comes from leaves the card everyone sees; the parts and the why stay",
        await x.locator("#reveal-origin-part").isHidden() && await x.locator("#reveal-family-part").isHidden()
        && await x.locator("#reveal-morph").isVisible() && await x.locator("#reveal-why").isVisible());
  const xRow = (await readAttempts(x)).pop();
  check("the attempt row carries the arm and what the miss showed",
        xRow.arm === xArm && xRow.support_shown === xArm, `${xRow.arm} / ${xRow.support_shown}`);
  let xLog = [];
  for (let n = 0; n < 20 && !xLog.length; n++) {
    xLog = (await readKV(x, "support_log")) || [];
    if (!xLog.length) await x.waitForTimeout(100);
  }
  check("the showing is logged: the word, its arm, and where",
        xLog.length === 1 && xLog[0].word === xWord && xLog[0].arm === xArm && xLog[0].where === "dictation",
        JSON.stringify(xLog));
}
await x.reload({ waitUntil: "networkidle" });
await x.waitForSelector("#screen-home.on");
check("coming back never changes an arm or the seed",
      JSON.stringify(await readKV(x, "support_arms")) === JSON.stringify(xArms)
      && (await readKV(x, "experiment_seed")) === xSeed);
await x.click("#btn-grownup");
await x.waitForSelector("#screen-grownup.on");
const helped = xArm ? 1 : 0;
const expState = await x.textContent("#gu-exp-state");
check("the grown-up view says it is too soon to tell, with the counts so far",
      expState.startsWith(`Too few to tell yet: ${helped} ${helped === 1 ? "word has" : "words have"} had help`)
      && (await x.locator("#gu-exp-table tbody tr").count()) === 4, expState);

// Firebase, set up the way docs/13 says: the console's own snippet, pasted on this iPad.
await x.selectOption("#opt-sync", "on");
await x.waitForSelector("#gu-fb-config:not([hidden])");
check("switching sync on asks for this iPad's Firebase settings",
      /no Firebase config on this iPad yet/.test(await x.textContent("#gu-sync-state")));
await x.fill("#opt-fb-config", "apiKey: 'nope'");
await x.click("#opt-fb-save");
check("a paste that is not a Firebase web config is refused, and says why",
      /does not look like a Firebase web config/.test(await x.textContent("#gu-sync-state"))
      && (await readKV(x, "firebase_config")) === null);
const DB_URL = "https://spelling-test-default-rtdb.europe-west1.firebasedatabase.app";
await x.fill("#opt-fb-config", `// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSy-test-not-a-key",
  authDomain: "spelling-test.firebaseapp.com",
  databaseURL: "${DB_URL}",
  projectId: "spelling-test",
  storageBucket: "spelling-test.appspot.com",
  messagingSenderId: "1234567890",
  appId: "1:1234567890:web:abcdef"
};
const app = initializeApp(firebaseConfig);`);
await x.click("#opt-fb-save");
await x.waitForFunction(() => /^On\. Only counts/.test(document.querySelector("#gu-sync-state").textContent),
  null, { timeout: 3000 }).catch(() => {});
const savedCfg = await readKV(x, "firebase_config");
check("the console's whole snippet is understood and kept on this iPad, and the box is cleared",
      savedCfg && savedCfg.databaseURL === DB_URL && savedCfg.projectId === "spelling-test"
      && (await x.inputValue("#opt-fb-config")) === ""
      && /^On\. Only counts/.test(await x.textContent("#gu-sync-state")), JSON.stringify(savedCfg));
const [xdl] = await Promise.all([x.waitForEvent("download"), x.click("#gu-export")]);
const xEx = JSON.parse(readFileSync(await xdl.path(), "utf8"));
check("the export carries the seed, every arm and every showing, for the registered analysis",
      xEx.experiment_seed === xSeed && JSON.stringify(xEx.support_arms) === JSON.stringify(xArms)
      && (xEx.support_log || []).length === helped);
check("the export never carries the Firebase settings",
      !JSON.stringify(xEx).includes("spelling-test") && !("firebase_config" in xEx));
await x.click("#gu-home");
await x.waitForSelector("#screen-home.on");
check("with sync on, her welcome page tells her what her grown-up can see (ICO standard 11)",
      await x.locator("#home-sync-note").isVisible()
      && /never the words you write/.test(await x.textContent("#home-sync-note")));
check("saving the settings sends nothing: sync waits for the end of a session",
      !xRequests.some((u) => /firebase|googleapis|gstatic/.test(u)));

if (!liveWeek || !gameData.weeks[liveWeek.id].sort) {
  console.log("  skip  no pattern sort this week");
} else {
  const deck = gameData.weeks[liveWeek.id].sort;
  await x.click("#btn-games");
  await x.waitForSelector("#screen-games.on");
  await x.click("#game-sort");
  await x.waitForSelector("#screen-sort.on");
  const shownNow = await x.textContent("#sort-card");
  const sc = deck.cards.find((c) => c.show[0] + c.show[1] === shownNow);
  const arm = sc && xArms[sc.word];
  if (!arm) {
    console.log(`  skip  ${sc ? sc.word : shownNow} is not in the experiment`);
  } else {
    await x.click(`#sort-bins button[data-key="${deck.bins.find((b) => b.key !== sc.answer).key}"]`);
    check("in a game, a miss shows the word's arm too",
          (await x.getAttribute("#sort-support .support", "data-shows")) === SHOWS[arm], `${sc.word}: ${arm}`);
    let fromSort = null;
    for (let n = 0; n < 60 && !fromSort; n++) {
      fromSort = ((await readKV(x, "support_log")) || []).find((e) => e.where === "sort");
      if (!fromSort) await x.waitForTimeout(100);
    }
    check("and it is logged as shown in the sort",
          fromSort && fromSort.word === sc.word && fromSort.arm === arm && fromSort.said === null,
          JSON.stringify(fromSort));
  }
}
check("the experiment raises no page errors", xErrors.length === 0, xErrors.join(" | "));
await xctx.close();

// ---------------------------------------------------------------- saying it aloud
// web/js/voice.js listens for a voice on the tablet and keeps nothing. The microphone
// here is a stand-in the test controls: a tone it turns up when "she" speaks. The
// app cannot tell it from a real one.
console.log("\n— saying it aloud —");
const mctx = await browser.newContext({ viewport: { width: 820, height: 1180 } });
await fixClock(mctx);
await noClips(mctx);
await mctx.addInitScript(() => {
  window.__mic = { opened: 0, stopped: 0, gain: null };
  if (!navigator.mediaDevices) return;
  navigator.mediaDevices.getUserMedia = async (c) => {
    if (!c || !c.audio || c.video) throw new DOMException("audio only", "NotAllowedError");
    const ac = new AudioContext();
    await ac.resume().catch(() => {});
    const osc = ac.createOscillator();
    osc.frequency.value = 220;
    const gain = ac.createGain();
    gain.gain.value = 0;
    const dest = ac.createMediaStreamDestination();
    osc.connect(gain).connect(dest);
    osc.start();
    window.__mic.gain = gain;
    window.__mic.opened += 1;
    for (const t of dest.stream.getTracks()) {
      const stop = t.stop.bind(t);
      t.stop = () => { window.__mic.stopped += 1; stop(); };
    }
    return dest.stream;
  };
});
const m = await mctx.newPage();
const mErrors = [];
m.on("pageerror", (e) => mErrors.push(e.message));
await m.goto(BASE, { waitUntil: "networkidle" });
await m.waitForSelector("#screen-home.on");
if (!liveWeek || !gameData.weeks[liveWeek.id].sort) {
  console.log("  skip  no pattern sort this week");
} else {
  const deck = gameData.weeks[liveWeek.id].sort;
  // Waits for a fresh card (an open gap) rather than guessing how long it takes: a card
  // answered "no hyphen" reads exactly as it did before, so the text cannot say whether
  // the next card has been drawn. Undefined: the round is over.
  const cardNow = async () => {
    const open = await m.waitForSelector("#sort-card .gap:not(.filled)", { timeout: 5000 })
      .then(() => true).catch(() => false);
    if (!open) return undefined;
    const shown = await m.textContent("#sort-card");
    return deck.cards.find((c) => c.show[0] + c.show[1] === shown);
  };
  const missBin = (c) => deck.bins.find((b) => b.key !== c.answer).key;
  const speak = (v) => m.evaluate((g) => { window.__mic.gain.gain.value = g; }, v);
  await m.click("#btn-grownup");
  await m.waitForSelector("#screen-grownup.on");
  await m.selectOption("#opt-voice", "on");
  await m.click("#gu-home");
  await m.waitForSelector("#screen-home.on");
  await m.click("#btn-games");
  await m.waitForSelector("#screen-games.on");
  await m.click("#game-sort");
  await m.waitForSelector("#screen-sort.on");
  check("with the microphone switched on, the sort opens it", (await m.evaluate(() => window.__mic.opened)) === 1);

  // Which cards are missed, and how, is decided by the card in front of her, not by its
  // place in the round: the deck is shuffled, and a contrast card (return beside
  // re-enter) has no word and so no help to say aloud. The first card with a word is
  // missed and said aloud, the second is missed and met with silence, the rest are right.
  const missed = { said: null, quiet: null };
  for (let i = 0; i < 10; i++) {
    const c = await cardNow();
    if (!c) break;
    if (c.word && !missed.said) {
      missed.said = c.word;
      await m.click(`#sort-bins button[data-key="${missBin(c)}"]`);
      const t0 = Date.now();
      check("a miss whose support says it aloud shows that it is listening",
            await m.locator("#sort-support .listen").isVisible());
      await m.waitForTimeout(700);              // the room's own level is measured first
      await speak(0.3);
      await m.waitForSelector("#sort-bins:not(.resting)", { timeout: 4000 }).catch(() => {});
      const early = Date.now() - t0;
      await speak(0);
      check("saying it ends the pause early, and she is told she was heard",
            early < 2500 && /I heard you/.test(await m.textContent("#sort-support")), `${early} ms`);
      await m.click(`#sort-bins button[data-key="${c.answer}"]`);
    } else if (c.word && !missed.quiet) {
      missed.quiet = c.word;
      await m.click(`#sort-bins button[data-key="${missBin(c)}"]`);
      const t1 = Date.now();
      await m.waitForSelector("#sort-bins:not(.resting)", { timeout: 6000 }).catch(() => {});
      const quietFor = Date.now() - t1;
      check("staying quiet is fine: the bins come back at the usual time", quietFor > 2500 && quietFor < 5000,
            `${quietFor} ms`);
      await m.click(`#sort-bins button[data-key="${c.answer}"]`);
    } else {
      await m.click(`#sort-bins button[data-key="${c.answer}"]`);
    }
    await m.waitForTimeout(900);
  }
  let mLog = null;
  for (let n = 0; n < 30 && !mLog; n++) {
    mLog = ((await readKV(m, "game_log")) || []).filter((r) => r.game === "sort").pop();
    if (!mLog) await m.waitForTimeout(100);
  }
  const sayOf = (w) => (mLog ? mLog.items.find((i) => i.word === w) : null);
  check("the round records whether each word was said, and nothing else about her voice",
        mLog && missed.said && missed.quiet
        && sayOf(missed.said).said === true && sayOf(missed.quiet).said === false
        && mLog.items.filter((i) => i.word !== missed.said && i.word !== missed.quiet)
             .every((i) => i.said === null),
        mLog ? mLog.items.map((i) => `${i.word}:${i.said}`).join() : "no entry");
  const kept = await m.evaluate(async () => {
    const db = await new Promise((res) => { const r = indexedDB.open("spelling", 1); r.onsuccess = () => res(r.result); });
    const all = await new Promise((res) => {
      const t = db.transaction("kv", "readonly").objectStore("kv").getAll();
      t.onsuccess = () => res(t.result);
    });
    const binary = (v) => v instanceof Blob || v instanceof ArrayBuffer || ArrayBuffer.isView(v)
      || (v && typeof v === "object" && Object.values(v).some(binary));
    return all.filter((row) => binary(row.value)).map((row) => row.key);
  });
  check("no sound is kept anywhere on the tablet", kept.length === 0, kept.join(", "));
  await m.click("#sort-quit");
  check("leaving the game closes the microphone at once", (await m.evaluate(() => window.__mic.stopped)) >= 1);
}
check("saying it aloud raises no page errors", mErrors.length === 0, mErrors.join(" | "));
await mctx.close();

console.log("\n— tablet —");
for (const [name, w, h] of [["iPad portrait", 820, 1180], ["iPad landscape", 1180, 820]]) {
  await page.setViewportSize({ width: w, height: h });
  await page.click("#gu-home").catch(() => {});
  await page.waitForSelector("#screen-home.on").catch(() => {});
  const overflow = await page.evaluate(() =>
    document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  check(`${name}: no horizontal overflow`, !overflow);
  const small = await page.evaluate(() =>
    [...document.querySelectorAll("#screen-home button")]
      .filter((b) => b.offsetParent !== null)
      .map((b) => Math.min(b.getBoundingClientRect().width, b.getBoundingClientRect().height))
      .filter((d) => d < 44).length);
  check(`${name}: every tap target clears 44px`, small === 0, `${small} too small`);
}
await page.setViewportSize({ width: 420, height: 900 });

console.log("\n— console —");
check("no page errors", errors.length === 0, errors.join(" | "));

await browser.close();
console.log(`\n${failures ? `${failures} CHECK(S) FAILED` : "all checks passed"}\n`);
process.exit(failures ? 1 : 0);
