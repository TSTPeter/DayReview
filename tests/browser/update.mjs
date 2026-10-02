/*
 * A deploy reaching a device that already has the game (docs/13, "How an update
 * reaches a device").
 *
 * The service worker serves the game from its cache, so the first open after a deploy
 * shows the version the device saved. On 1 October 2026 that kept Peter's Android phone
 * on an old version long after the new one was live. This plays a returning phone
 * across three deploys and holds app.js ("updates") to what it promises:
 *
 *   - the new version takes over by itself on the welcome page,
 *   - never in the middle of a session, and nothing she did is lost,
 *   - a game left open picks it up when it comes back to the screen.
 *
 * It runs its own server over web/, because a deploy is a change to sw.js on the server:
 * the stamp tools/deploy_to_site.py writes, applied here to whichever version is live.
 *
 *   node tests/browser/update.mjs
 */
import { createServer } from "node:http";
import { existsSync, readFileSync, statSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { chromium, devices } from "playwright-core";

const WEB = new URL("../../web/", import.meta.url).pathname;
const SW = readFileSync(join(WEB, "sw.js"), "utf8");
const CACHE_LINE = /const CACHE = `\$\{PREFIX\}[^`]*`;/;
if ((SW.match(new RegExp(CACHE_LINE, "g")) || []).length !== 1) {
  throw new Error("sw.js has no single CACHE line to stamp: update this test with deploy_to_site.py");
}
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".json": "application/json",
                ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".mp3": "audio/mpeg",
                ".ico": "image/x-icon" };

// What the server is serving: one deploy at a time.
let live = { stamp: "aaaaaaaaaaa1", synced: "2026-10-01" };
const deploy = (stamp, synced) => { live = { stamp, synced }; };

const server = createServer((req, res) => {
  const path = decodeURIComponent(new URL(req.url, "http://x").pathname);
  const send = (code, body, type) => {
    res.writeHead(code, { "Content-Type": type, "Cache-Control": "no-store" });
    res.end(body);
  };
  if (path === "/sw.js") {
    return send(200, SW.replace(CACHE_LINE, "const CACHE = `${PREFIX}" + live.stamp + "`;"), TYPES[".js"]);
  }
  if (path === "/data/version.json") {
    return send(200, JSON.stringify({ stamp: live.stamp, commit: "test", synced: live.synced }), TYPES[".json"]);
  }
  const file = normalize(join(WEB, path.endsWith("/") ? `${path}index.html` : path));
  if (!file.startsWith(WEB) || !existsSync(file) || statSync(file).isDirectory()) {
    return send(404, "not found", "text/plain");
  }
  return send(200, readFileSync(file), TYPES[extname(file)] || "application/octet-stream");
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const BASE = `http://127.0.0.1:${server.address().port}/`;

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

const browser = await chromium.launch(EXECUTABLE ? { executablePath: EXECUTABLE } : {});
// The phone that showed the problem, with the device voice: no clips to download.
const ctx = await browser.newContext({ ...devices["Pixel 7"] });
await ctx.route("**/data/audio.json", (r) => r.fulfill({
  contentType: "application/json", body: JSON.stringify({ voice_id: null, model_id: null, clips: {} }) }));
// Every time the game's page loads in a tab, note which version it is showing: the
// version file the service worker hands that page. A tab's sessionStorage outlives its
// reloads, so the list is the tab's history.
await ctx.addInitScript(() => {
  addEventListener("DOMContentLoaded", async () => {
    try {
      const v = await (await fetch("data/version.json")).json();
      const seen = JSON.parse(sessionStorage.getItem("__seen") || "[]");
      seen.push(v.stamp);
      sessionStorage.setItem("__seen", JSON.stringify(seen));
    } catch { /* not the game's page */ }
  });
});

const errors = [];
const watch = (page) => page.on("pageerror", (e) => errors.push(e.message));
const seen = async (page) => {
  try { return await page.evaluate(() => JSON.parse(sessionStorage.getItem("__seen") || "[]")); }
  catch { return null; }                           // mid-reload
};
const cached = async (page) => {
  try {
    return await page.evaluate(async () => (await caches.keys()).filter((k) => k.startsWith("spelling-")).join());
  } catch { return null; }
};
// Poll until fn(value) holds, for up to ms.
const until = async (page, read, fn, ms = 20000) => {
  const end = Date.now() + ms;
  let v = await read(page);
  while (!(v && fn(v)) && Date.now() < end) {
    await page.waitForTimeout(250);
    v = await read(page);
  }
  return v;
};
const backFromBackground = (page) => page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
const readAttemptCount = (page) => page.evaluate(async () => {
  const db = await new Promise((res) => { const r = indexedDB.open("spelling", 1); r.onsuccess = () => res(r.result); });
  return await new Promise((res) => {
    const t = db.transaction("attempts", "readonly").objectStore("attempts").count();
    t.onsuccess = () => res(t.result);
  });
});
const versionLine = async (page) => {
  await page.click("#btn-grownup");
  await page.waitForSelector("#screen-grownup.on");
  const text = await page.textContent("#gu-version");
  await page.click("#gu-home");
  await page.waitForSelector("#screen-home.on");
  return text;
};

console.log("\n: a first visit");
const first = await ctx.newPage();
watch(first);
await first.goto(BASE, { waitUntil: "networkidle" });
await first.waitForSelector("#screen-home.on");
const installed = await until(first, cached, (c) => c === "spelling-aaaaaaaaaaa1");
await first.waitForTimeout(1500);
check("a first visit installs the game and does not reload itself",
      installed === "spelling-aaaaaaaaaaa1" && JSON.stringify(await seen(first)) === '["aaaaaaaaaaa1"]',
      JSON.stringify(await seen(first)));
await first.close();

console.log("\n: opening the game after a deploy");
deploy("bbbbbbbbbbb2", "2026-10-02");
const page = await ctx.newPage();
watch(page);
await page.goto(BASE, { waitUntil: "domcontentloaded" });
const two = await until(page, seen, (s) => s.length >= 2);
await page.waitForSelector("#screen-home.on");
await page.waitForTimeout(2500);
check("the first open shows the version it saved, then the new one takes over on the welcome page",
      JSON.stringify(two) === '["aaaaaaaaaaa1","bbbbbbbbbbb2"]', JSON.stringify(two));
check("it reloads once, not again and again", JSON.stringify(await seen(page)) === '["aaaaaaaaaaa1","bbbbbbbbbbb2"]',
      JSON.stringify(await seen(page)));
check("the old version's cache is gone", (await cached(page)) === "spelling-bbbbbbbbbbb2", await cached(page));
const line2 = await versionLine(page);
check("the grown-up view says which version this device has",
      line2.includes("2 October 2026") && line2.includes("bbbbbbbbbbb2"), line2);

console.log("\n: a deploy in the middle of a session");
const before = await readAttemptCount(page);
await page.click("#btn-practise");
await page.waitForSelector("#screen-attempt.on");
deploy("ccccccccccc3", "2026-10-03");
await backFromBackground(page);
const took = await until(page, cached, (c) => c === "spelling-ccccccccccc3");
await page.waitForTimeout(1500);
check("mid-session the new version downloads, but the screen she is on stays put",
      took === "spelling-ccccccccccc3" && (await seen(page)).length === 2
      && await page.locator("#screen-attempt.on").count() === 1, `${took} ${JSON.stringify(await seen(page))}`);
for (let i = 0; i < 10; i++) {
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
check("the whole session runs on, with no reload", (await seen(page)).length === 2);
await page.click("#end-home");
const three = await until(page, seen, (s) => s.length >= 3, 10000);
await page.waitForSelector("#screen-home.on");
check("finishing takes her to the welcome page, and the new version loads there",
      JSON.stringify(three) === '["aaaaaaaaaaa1","bbbbbbbbbbb2","ccccccccccc3"]', JSON.stringify(three));
check("every answer from that session was kept", (await readAttemptCount(page)) === before + 10,
      `${before} then ${await readAttemptCount(page)}`);

console.log("\n: a game left open on the welcome page");
deploy("ddddddddddd4", "2026-10-04");
await page.waitForTimeout(500);
await backFromBackground(page);
const four = await until(page, seen, (s) => s.length >= 4);
await page.waitForSelector("#screen-home.on");
check("coming back to the screen checks for a new version, and it loads",
      JSON.stringify(four) === '["aaaaaaaaaaa1","bbbbbbbbbbb2","ccccccccccc3","ddddddddddd4"]', JSON.stringify(four));
check("and the grown-up view says so", (await versionLine(page)).includes("ddddddddddd4"));

check("updating raises no page errors", errors.length === 0, errors.join(" | "));
await browser.close();
server.close();
console.log(`\n${failures ? `${failures} CHECK(S) FAILED` : "all checks passed"}\n`);
process.exit(failures ? 1 : 0);
