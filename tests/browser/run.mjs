/*
 * End-to-end browser check.
 *
 *   npm install && npx playwright install chromium
 *   python3 serve.py --port 8137 &
 *   node tests/browser/run.mjs
 *   CHROME=/path/to/chrome node tests/browser/run.mjs   (to point at another build)
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
import { existsSync } from "node:fs";
import { chromium } from "playwright-core";

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

const browser = await chromium.launch(
  EXECUTABLE ? { executablePath: EXECUTABLE } : {});
const ctx = await browser.newContext({ viewport: { width: 420, height: 900 } });
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

// Beatrix's iPad HAS voices, so the path she will actually use is the one
// headless Chromium cannot run. Stub the speech API and read back what the app
// asked it to say: for these ten words the spoken line is the whole question.
console.log("\n— what the dictation actually says —");
{
  const ctx5 = await browser.newContext({ viewport: { width: 820, height: 1180 } });
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
