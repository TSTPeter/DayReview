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
import { blank } from "../../web/js/gap.js";

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
const sentences = (await (await fetch(new URL("data/sentences.json", BASE))).json()).sentences;

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
  // Share used to be a small link at the very foot of the page, below the fold on a phone
  // (6 October 2026). It is a labelled button now, and must be on the first screen.
  const share = await page.$eval("#btn-share", (b) => {
    const r = b.getBoundingClientRect();
    return { bottom: Math.round(r.bottom), h: Math.round(r.height), vh: innerHeight };
  });
  check("the Share button is on the first screen, without scrolling, and big enough to touch",
        share.bottom <= share.vh && share.h >= 44, JSON.stringify(share));
  await page.tap("#btn-share");
  await page.waitForSelector("#screen-share.on");
  await page.tap("#share-copy");
  await page.waitForFunction(() => document.querySelector("#share-note").textContent.length > 0);
  check("the share screen fits the width, and Copy the link answers a tap",
        await fits() && /\S/.test(await page.textContent("#share-note")), (await page.textContent("#share-note")).trim());
  await page.tap("#share-back");
  await page.waitForSelector("#screen-home.on");
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
    // Back on the bins after the pause, the missed card is answered (not at the first go),
    // then two cards right at the first go bring the first animal onto the page. It sits
    // in the lower part of the screen, so on a phone it is in view and not under a card.
    await page.waitForSelector("#sort-bins:not(.resting)", { timeout: 8000 });
    await page.tap(`#sort-bins button[data-key="${c.answer}"]`);
    for (let k = 0; k < 2; k++) {
      const next = await card();
      await page.tap(`#sort-bins button[data-key="${next.answer}"]`);
    }
    await page.waitForTimeout(900);
    const animal = await page.$eval('#sort-scene g.layer[data-kind="animal"]', (g) => {
      const r = g.getBoundingClientRect();
      return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height),
               opacity: getComputedStyle(g).opacity, vw: innerWidth, vh: innerHeight };
    }).catch(() => null);
    check("two right answers at the first go bring the first animal into view",
          !!animal && Number(animal.opacity) === 1 && animal.x >= 0 && animal.y >= 0
          && animal.x + animal.w <= animal.vw + 1 && animal.y + animal.h <= animal.vh + 1,
          JSON.stringify(animal));
    // The background is fixed to the window; the title bar must sit over it.
    check("the title bar sits above the background",
          await page.$eval("header.bar", (h) => getComputedStyle(h).position === "relative"
            && Number(getComputedStyle(h).zIndex) >= 1));
  }
  // --- the four newer games, by touch (6 October 2026)
  if (content.sort) await page.tap("#sort-quit");
  await page.waitForSelector("#screen-games.on");
  check("the games hub fits the width with the four new games on it",
        await fits() && (await page.locator(".game-card:not([disabled])").count()) >= 8);

  // fill the gap: a typed answer, checked by a tap
  await page.tap("#game-gap");
  await page.waitForSelector("#screen-gap.on");
  check("fill the gap fits the width", await fits());
  const shown = await page.textContent("#gap-sentence");
  const gapWord = week.words.find((w) => { const b = blank(sentences[w] || "", w); return b && b.before + b.after === shown; });
  await page.fill("#gap-answer input", gapWord || "");
  await page.tap("#gap-answer button.primary");
  check("a typed answer is checked by a tap, and the right one earns its points",
        !!gapWord && /Correct!\s+\+10/.test(await page.textContent("#gap-answer .verdict")), gapWord || shown);
  await page.tap("#gap-quit");
  await page.waitForSelector("#screen-games.on");

  // look, cover, write: the cover goes on when she taps it
  await page.tap("#game-lcw");
  await page.waitForSelector("#screen-lcw.on");
  const lcwWord = (await page.textContent("#lcw-word")).replace(/\s+/g, "");
  await page.tap("#lcw-cover");
  check("look cover write fits the width, and the word is covered after one tap",
        await fits() && !(await page.innerText("#screen-lcw")).toLowerCase().includes(lcwWord.toLowerCase()), lcwWord);
  await page.tap("#lcw-quit");
  await page.waitForSelector("#screen-games.on");

  // letter tiles: tiles are tapped into place, and are big enough to touch
  await page.tap("#game-tiles");
  await page.waitForSelector("#screen-tiles.on");
  const meaning = await page.textContent("#tiles-clue");
  const tilesWord = Object.keys(games.words).find((w) => games.words[w].meaning === meaning);
  const tile = await page.$eval("#tiles-tray .tile", (b) => {
    const r = b.getBoundingClientRect();
    return { w: Math.round(r.width), h: Math.round(r.height) };
  });
  check("letter tiles fit the width, and each tile is big enough to touch",
        await fits() && Math.min(tile.w, tile.h) >= 44, JSON.stringify(tile));
  const firstOpen = () => page.evaluate(() => [...document.querySelectorAll("#tiles-slots .slot")]
    .findIndex((x) => !x.classList.contains("locked") && !x.querySelector(".tile")));
  for (let k = await firstOpen(); k >= 0; k = await firstOpen()) {
    await page.tap(`#tiles-tray .tile[aria-label="${tilesWord[k] === "-" ? "hyphen" : tilesWord[k]}"] >> nth=0`);
  }
  await page.tap("#tiles-check");
  await page.waitForSelector("#tiles-next:not([hidden])");
  check("tapping the tiles into order and checking earns the points",
        /\+10/.test(await page.textContent("#tiles-feedback")), tilesWord);
  await page.tap("#tiles-quit");
  await page.waitForSelector("#screen-games.on");

  // the crossword: a clue is chosen by tap, and the grid fits
  await page.tap("#game-cross");
  await page.waitForSelector("#screen-cross.on");
  const cell = await page.$eval("#cross-grid .xw-cell", (b) => Math.round(b.getBoundingClientRect().width));
  check("the crossword fits the width, with squares big enough to read", await fits() && cell >= 26, `${cell} px`);
  const second = await page.locator("#cross-clues .xw-clue >> nth=1").textContent();
  await page.tap("#cross-clues .xw-clue >> nth=1");
  check("tapping a clue picks it, and its clue is the one to answer",
        second.includes(await page.textContent("#cross-clue")), second.slice(0, 40));
  await page.tap("#cross-quit");
  await page.waitForSelector("#screen-games.on");

  check("no page errors", errors.length === 0, errors.join(" | "));
  await ctx.close();
}

await browser.close();
console.log(`\n${failures ? `${failures} CHECK(S) FAILED` : "all checks passed"}\n`);
process.exit(failures ? 1 : 0);
