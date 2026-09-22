# Hosting: where this runs, and what that changes

`docs/05` targets Azure. This is that, arrived at from the other direction: the
app is served from **TST's existing Azure Static Web App**, the one behind
`www.tsttalent.com`, as one more folder alongside the workshop games.

    https://www.tsttalent.com/Spelling

## Why there, and not a new thing

The app needs no server. There is no API yet, the word model ships as two JSON
files, and the learner record lives in the browser's IndexedDB. That makes it a
static site, and a static site that has to exist somewhere already existed.

Standing up a separate host would have meant a new account, a new domain, a new
deploy pipeline and a second thing to keep patched, in exchange for nothing the
app actually uses.

## What it inherits from the site

| | |
|---|---|
| Deploy | push to `main` on `TSTPeter/ProductionSite` → `Azure/static-web-apps-deploy@v1` |
| TLS, HSTS, CSP | set globally in `staticwebapp.config.json` |
| Indexing | **none.** Site-wide `robots.txt` is `Disallow: /` |
| Route | `/Spelling` → `/Games/Spelling/index.html` |
| Caching | `no-store` on `/Games/Spelling/*`, matching the other games |

`no-store` looks wasteful for a 336 KB app and is not. The service worker is
what makes it work offline, and it caches in CacheStorage, which is a separate
store that HTTP cache headers do not govern. What `no-store` buys is that a new
`sw.js` and a new `app.js` actually reach a tablet that already has the old
ones. Long-lived HTTP caching plus a service worker is the classic way to ship
an update that nobody ever receives.

## The two-repo problem, stated rather than hidden

**DayReview is the source of truth. `Games/Spelling/` on the site is a build
artefact.** They are different repositories, so nothing enforces that. The
mitigations are a script and a sign:

    python3 tools/deploy_to_site.py [path-to-productionsite]

It wipes and rewrites the folder, and drops a `README.md` in it naming the
source commit and saying not to edit there. Editing the deployed copy and
re-running the sync silently discards the edit.

A git submodule would enforce it properly. It was not used because a submodule
mounts a repository root, and what needs to appear at `Games/Spelling/` is this
repo's `web/` subfolder, not this repo. The site would also have acquired
`engine/`, `tests/` and `docs/`, which the deploy workflow then prunes by hand.

## What is deliberately not copied

`data/firebase.json` switches sync on. It is gitignored here, excluded by the
sync script, and the script **refuses to run** if it finds one, because shipping
it would turn on cloud sync for every visitor. That is `docs/06` standard 7,
high privacy by default, enforced rather than remembered.
`data/firebase.example.json` is developer documentation and stays out too.

## The scope question, since `docs/06` says to answer it deliberately

`docs/06` draws the line at *"your own child, on your own device, data staying
in your control"* versus *"a second family's child → a DPIA becomes legally
mandatory."* A public URL looks like it crosses that line. The reading here is
that it does not, for one reason: **nothing is processed.**

There is no account, no identifier, no name, no telemetry, no analytics and no
server. Every attempt she types is written to IndexedDB on her own iPad and
goes nowhere. What is published is a program, not a service that handles
children's data, and the publisher is not a controller of anything.

Two things would change that immediately, and both are one commit away:

1. **`data/firebase.json` appearing.** Then attempts leave the device and land
   in a database someone owns. The sync script refuses this on purpose.
2. **Analytics.** The site has Application Insights wired elsewhere. Pointing
   any of it at `/Spelling` makes visitor data real and this section wrong.

The softer question is the Children's code, which covers services *"likely to
be accessed by children", even if not aimed at them*
([ICO](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/childrens-information/childrens-code-guidance-and-resources/introduction-to-the-childrens-code/)).
A Year 6 spelling app is squarely the kind of thing that test is about. What
keeps it on the near side in practice is that it is unlisted: `robots.txt`
disallows the whole site, so the URL has to be handed to someone.

**This is a reading of the evidence in `docs/06`, not legal advice**, and it
holds only while both conditions above hold. If it is ever shared beyond the
family, `docs/06` action 2 applies: write the DPIA before launch, and let it
change the design rather than describe it afterwards.

## One change the shared origin forced

`CacheStorage` is scoped per **origin**, not per service-worker scope. The
activate handler used to delete every cache that was not its own, which is
correct on a dedicated host and destructive on a shared one — it would have
wiped the caches of every other app on `tsttalent.com`. Caches are now named
`spelling-*` and the sweep is limited to that prefix.

Nothing else about the app is aware of where it is served from. Every path in
`web/` is relative, including the service-worker registration, which is why the
whole browser suite passes unchanged against `/Games/Spelling/`:

    BASE=http://localhost:8139/Games/Spelling/ node tests/browser/run.mjs

## Still open

- **The site is a company site.** This is a personal project living on TST
  infrastructure. Fine today; worth a second thought if the app ever gets a
  backend, a cost, or a user who is not family.
- **No deploy check.** Nothing verifies that `Games/Spelling/` matches this
  repo's `web/`. A CI job on either side could compare them and fail on drift.
- **The 122 sentences are still unreviewed** (`docs/05` decision 2). The site
  being unlisted limits the exposure; it does not remove the obligation.
