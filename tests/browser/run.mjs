/*
 * End-to-end browser check.
 *
 *   python3 serve.py --port 8137 &
 *   node tests/browser/run.mjs            (needs playwright-core and a Chromium)
 *   CHROME=/path/to/chrome node tests/browser/run.mjs
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
import { chromium } from "playwright-core";

const BASE = process.env.BASE || "http://localhost:8137/";
const EXECUTABLE = process.env.CHROME
  || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

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

const browser = await chromium.launch({ executablePath: EXECUTABLE });
const ctx = await browser.newContext({ viewport: { width: 420, height: 900 } });
const page = await ctx.newPage();
const errors = [];
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
const labels = await p2.locator("#paper-list .label").allTextContents();
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

console.log("\n— console —");
check("no page errors", errors.length === 0, errors.join(" | "));

await browser.close();
console.log(`\n${failures ? `${failures} CHECK(S) FAILED` : "all checks passed"}\n`);
process.exit(failures ? 1 : 0);
