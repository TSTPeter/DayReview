// Offline first. docs/05 decision 6: home broadband and school networks both fail, and
// a spelling session interrupted mid-word is a session that does not get finished.
//
// Cache-first for the shell and the word data, because neither changes between releases
// and both are needed before the first word can be dictated.

// Namespaced, and the sweep below is limited to this prefix. CacheStorage is
// per-ORIGIN, not per-scope, so on a shared domain - which is where this now
// lives - a bare "delete everything that is not mine" would wipe the caches of
// every other app on the host.
const PREFIX = "spelling-";
const CACHE = `${PREFIX}v5`;
const SHELL = [
  "./", "index.html", "manifest.json",
  "css/paper.css",
  "js/app.js", "js/store.js", "js/audio.js", "js/keystrokes.js",
  "js/sfx.js", "js/rewards.js", "js/dashboard.js", "js/sync.js",
  "js/engine/classify.js", "js/engine/schedule.js", "js/engine/profile.js",
  "js/engine/derive.js", "js/engine/weekly.js",
  "data/words.json", "data/sentences.json", "data/audio.json",
];
// Clips are NOT in the shell: all of them is several megabytes on a first visit.
// app.js warms the ones the next session needs, and any clip heard online is kept.

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys
      .filter((k) => k.startsWith(PREFIX) && k !== CACHE)
      .map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

const isClip = (url) => /\/audio\/[0-9a-f]{16}\.mp3$/.test(new URL(url).pathname);

// Media is fetched in byte ranges: Safari asks for "bytes=0-1" before it will play a
// clip, and a whole 200 answer to that request can stop playback. A cache can only hold
// whole responses (Cache.put refuses a 206), so a cached clip is sliced here into the
// 206 the media element asked for. Without this, a clip that is safely cached can
// still refuse to play offline, which is the one case the cache exists for.
async function sliced(request, whole) {
  const blob = await whole.blob();
  const size = blob.size;
  const m = /^bytes=(\d*)-(\d*)$/.exec(request.headers.get("range") || "");
  const type = whole.headers.get("Content-Type") || "audio/mpeg";
  if (!m || (m[1] === "" && m[2] === "")) {
    return new Response(blob, { status: 200, headers: { "Content-Type": type } });
  }
  let start;
  let end;
  if (m[1] === "") {                       // "bytes=-500": the last 500 bytes
    start = Math.max(0, size - Number(m[2]));
    end = size - 1;
  } else {
    start = Number(m[1]);
    end = m[2] === "" ? size - 1 : Math.min(Number(m[2]), size - 1);
  }
  if (start >= size || start > end) {
    return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
  }
  return new Response(blob.slice(start, end + 1), {
    status: 206,
    statusText: "Partial Content",
    headers: {
      "Content-Type": type,
      "Content-Range": `bytes ${start}-${end}/${size}`,
      "Content-Length": String(end - start + 1),
      "Accept-Ranges": "bytes",
    },
  });
}

// A clip first heard online arrives as ranges, which cannot be cached. Fetch it whole
// alongside, so the next time she hears it the network is optional.
async function keepWhole(url) {
  if (await caches.match(url)) return;
  try {
    const res = await fetch(url);
    if (res.status === 200) await (await caches.open(CACHE)).put(url, res);
  } catch { /* offline: it will be kept the next time it is heard online */ }
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;

  if (req.headers.has("range")) {
    e.respondWith(caches.match(req.url).then((hit) => (hit ? sliced(req, hit) : fetch(req))));
    if (isClip(req.url)) e.waitUntil(keepWhole(req.url));
    return;
  }

  e.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      // Only keep what worked. A cached 404 for a clip would be served forever.
      if (res.ok) {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
      }
      return res;
    }).catch(() => (req.mode === "navigate"
      // Offline and uncached: a page gets the shell, anything else a clean failure,
      // never index.html pretending to be a script or a clip.
      ? caches.match("index.html")
      : Response.error())))
  );
});
