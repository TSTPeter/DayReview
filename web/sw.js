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
const CACHE = `${PREFIX}v4`;
const SHELL = [
  "./", "index.html", "manifest.json",
  "css/paper.css",
  "js/app.js", "js/store.js", "js/audio.js", "js/keystrokes.js",
  "js/sfx.js", "js/rewards.js", "js/dashboard.js", "js/sync.js",
  "js/engine/classify.js", "js/engine/schedule.js", "js/engine/profile.js",
  "js/engine/derive.js", "js/engine/weekly.js",
  "data/words.json", "data/sentences.json",
];

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

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  e.respondWith(
    caches.match(e.request).then((hit) => hit || fetch(e.request).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
      return res;
    }).catch(() => caches.match("index.html")))
  );
});
