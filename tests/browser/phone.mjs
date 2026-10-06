/*
 * The games on an Android phone, played by touch.
 *
 * run.mjs drives the games with a mouse at iPad sizes. On 1 October 2026 Peter could
 * not play hangman or hidden words on his Android phone (docs/10). The cause was the
 * update path (update.mjs), but nothing had ever tried the games at phone size with a
 * finger. This does: two Android phones, a large and a small one, taps through the
 * touchscreen, and a finger slide sent as raw touch events, so the browser applies
 * touch-action and pointer capture exactly as it does on a phone.
 *
 *   python3 serve.py --port 8137 &
 *   node tests/browser/phone.mjs
 */
import { existsSync } from "node:fs";
import { chromium, devices } from "playwright-core";

const BASE = process.env.BASE || "http://localhost:8137/";

function resolveExecutable() {
  if (process.env.CHROME) return process.env.CHROME;
  try {
    const p = chromium.executablePath();
    if (p && existsSync(p)) return p;
  } catch { /* no registry-installed browser */ }
  return ["/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
          "/opt/pw-browsers/chromium/chrome-linux/chrome"].find(existsSync);
}
const EXECUTABLE = resolveExecutable();

let failures = 0;
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "  ok  " : "FAIL  "}${name}${detail ? "  : " + detail : ""}`);
  if (!ok) failures += 1;
};

// The real term and game content, whatever week it is, as run.mjs reads them.
const games = await (await fetch(new URL("data/games.json", BASE))).json();
const term = await (await fetch(new URL("data/term.json", BASE))).json();
// TODAY=2026-10-12 plays the week of 12 October on any day (the browser's clock too).
const today = process.env.TODAY || new Date().toISOString().slice(0, 10);
const week = term.weeks.filter((w) => w.set_on <= today).pop();
if (!week) {
  console.log("  skip  no term week today");
  process.exit(0);
}
const content = games.weeks[week.id];

const browser = await chromium.launch(EXECUTABLE ? { executablePath: EXECUTABLE } : {});

for (const phone of ["Pixel 7", "Galaxy S8"]) {
  const { width } = devices[phone].viewport;
  console.log(`\n: ${phone}, ${width} px wide`);
  // No service worker: this is about touch and layout. update.mjs covers the worker.
  const ctx = await browser.newContext({ ...devices[phone], serviceWorkers: "block" });
  if (process.env.TODAY) await ctx.clock.setFixedTime(new Date(`${today}T12:00:00Z`));
  await ctx.route("**/data/audio.json", (r) => r.fulfill({
    contentType: "application/json", body: JSON.stringify({ voice_id: null, model_id: null, clips: {} }) }));
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const cdp = await ctx.newCDPSession(page);
  const touch = (type, x, y) => cdp.send("Input.dispatchTouchEvent",
    { type, touchPoints: type === "touchEnd" ? [] : [{ x, y }] });
  const fits = () => page.evaluate(() =>
    document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1);

  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.waitForSelector("#screen-home.on");
  check("the welcome page fits the width", await fits());
  // The school's list for the week, and the way back to it if a device loses it.
  await page.tap("#btn-week");
  await page.waitForSelector("#screen-week.on");
  check("the week screen fits the width, and says the school's list is in use",
        await fits() && /school.s list for this week/.test(await page.textContent("#week-source")),
        (await page.textContent("#week-source")).trim());
  await page.tap("#week-clear");
  await page.waitForSelector("#screen-home.on");
  await page.tap("#btn-week");
  await page.waitForSelector("#screen-week.on");
  const school = await page.$eval("#week-school", (b) => {
    const r = b.getBoundingClientRect();
    return { shown: b.offsetParent !== null, h: Math.round(r.height), w: Math.round(r.width) };
  });
  check("once cleared, the school's list is one tap away, big enough to touch",
        school.shown && Math.min(school.h, school.w) >= 44 && await fits(), JSON.stringify(school));
  await page.tap("#week-school");
  await page.waitForSelector("#screen-home.on");
  check("and one tap brings this week's list back",
        await page.locator("#home-week").isVisible() && (await page.textContent("#home-week-words")).length > 20);
  await page.tap("#btn-games");
  await page.waitForSelector("#screen-games.on");
  check("hangman and hidden words are both open to play",
        !(await page.locator("#game-hangman").isDisabled()) && !(await page.locator("#game-hunt").isDisabled()));

  // --- hangman
  await page.tap("#game-hangman");
  await page.waitForSelector("#screen-hangman.on");
  check("hangman fits the width", await fits());
  const slots = await page.locator("#hang-word .slot").count();
  const letter = [..."etaoinsrl"][0];
  await page.tap(`#hang-keys button[data-key="${letter}"]`);
  const key = await page.$eval(`#hang-keys button[data-key="${letter}"]`, (b) => ({ off: b.disabled, cls: b.className }));
  check("a tapped letter is guessed", key.off && /\b(hit|miss)\b/.test(key.cls), JSON.stringify(key));
  await page.tap("#hang-hint");
  check("the hint answers a tap", /A place to start/.test(await page.textContent("#hang-feedback")) && slots > 0);
  await page.tap("#hang-quit");
  await page.waitForSelector("#screen-games.on");

  // --- hidden words
  await page.tap("#game-hunt");
  await page.waitForSelector("#screen-hunt.on");
  await page.waitForTimeout(150);
  check("hidden words fits the width", await fits());
  const cells = await page.$$eval("#hunt-grid .hunt-cell", (xs) => xs.map((x) => {
    const r = x.getBoundingClientRect();
    return [r.left + r.width / 2, r.top + r.height / 2, r.width];
  }));
  // The block on screen is the next one this week, read from the page's own letters.
  const letters = cells.length ? await page.$$eval("#hunt-grid .hunt-cell", (xs) => xs.map((x) => x.textContent).join("")) : "";
  const block = content.blocks.find((b) => b.letters === letters);
  check("the block on screen is one of this week's", !!block);
  check("each letter is big enough to touch", Math.min(...cells.map((c) => c[2])) >= 32,
        `${Math.round(Math.min(...cells.map((c) => c[2])))} px`);
  if (block) {
    const route = (w) => block.routes[w][block.tilings[0][w]];
    for (const c of route(0)) await page.tap(`#hunt-grid .hunt-cell >> nth=${c}`);
    check("a word traced by tapping its letters is found",
          (await page.textContent("#hunt-feedback")).startsWith(`Found ${block.words[0]}!`),
          await page.textContent("#hunt-feedback"));
    const pts = route(1).map((c) => cells[c]);
    await touch("touchStart", pts[0][0], pts[0][1]);
    for (let k = 1; k < pts.length; k++) {
      const [x0, y0] = pts[k - 1];
      const [x1, y1] = pts[k];
      for (let s = 1; s <= 6; s++) await touch("touchMove", x0 + ((x1 - x0) * s) / 6, y0 + ((y1 - y0) * s) / 6);
    }
    await touch("touchEnd");
    await page.waitForTimeout(200);
    check("a word traced by sliding a finger through it is found, and the page does not scroll",
          (await page.textContent("#hunt-feedback")).startsWith(`Found ${block.words[1]}!`)
          && (await page.evaluate(() => scrollY)) === 0, await page.textContent("#hunt-feedback"));
  }
  await page.tap("#hunt-quit");
  await page.waitForSelector("#screen-games.on");

  // --- pattern sort
  if (!content.sort) {
    console.log("  skip  no pattern sort this week");
  } else {
    await page.tap("#game-sort");
    await page.waitForSelector("#screen-sort.on");
    check("the pattern sort fits the width", await fits());
    // Waits for a fresh card, which has an open gap. A card answered "no hyphen" reads
    // exactly as it did before, so the text alone cannot tell the old card from the next.
    const card = async () => {
      const open = await page.waitForSelector("#sort-card .gap:not(.filled)", { timeout: 3000 })
        .then(() => true).catch(() => false);
      if (!open) return undefined;
      const shown = await page.textContent("#sort-card");
      return content.sort.cards.find((x) => x.show[0] + x.show[1] === shown);
    };
    let c = await card();
    await page.tap(`#sort-bins button[data-key="${c.answer}"]`);
    check("a right answer shows its points and nothing else", (await page.textContent("#sort-feedback")).trim() === "+5");
    // A miss shows help only for a card that is one of the school's words. The deck can
    // also hold contrast cards (return beside re-enter), so those are answered right and
    // the first card with a word is the one missed.
    c = await card();
    for (let k = 0; k < 10 && c && !c.word; k++) {
      await page.tap(`#sort-bins button[data-key="${c.answer}"]`);
      c = await card();
    }
    await page.tap(`#sort-bins button[data-key="${content.sort.bins.find((b) => b.key !== c.answer).key}"]`);
    check("a miss shows the rule and the word's help, and rests the bins",
          /Not this time/.test(await page.textContent("#sort-feedback"))
          && (await page.locator("#sort-support .support").count()) === 1
          && (await page.locator("#sort-bins.resting").count()) === 1);
    // The background is fixed to the window; the title bar must sit over it.
    check("the title bar sits above the background",
          await page.$eval("header.bar", (h) => getComputedStyle(h).position === "relative"
            && Number(getComputedStyle(h).zIndex) >= 1));
  }
  check("no page errors", errors.length === 0, errors.join(" | "));
  await ctx.close();
}

await browser.close();
console.log(`\n${failures ? `${failures} CHECK(S) FAILED` : "all checks passed"}\n`);
process.exit(failures ? 1 : 0);
