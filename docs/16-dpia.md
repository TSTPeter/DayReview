# DPIA: the spelling game, shared by its address

**A draft for Peter, and for TST as the host, to review and sign off. It is not
legal advice.** Written 1 October 2026, when "Share the game" was added.

## Why this exists now

`docs/06` says a DPIA becomes mandatory the moment a second family's child uses the
app, and `docs/13` says to write it before the link goes beyond the family. A Share
button puts the link beyond the family by design, so this comes first.

The Children's Code applies to online services "likely to be accessed by children",
and it states: "if you offer an online service likely to be accessed by children,
you must do a DPIA"
([ICO](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/childrens-information/childrens-code-guidance-and-resources/age-appropriate-design-a-code-of-practice-for-online-services/2-data-protection-impact-assessments/)).
A spelling game for 9 to 11 year olds is squarely that.

## What was decided, and what was not built

Peter asked for a Share button that would connect Beatrix to friends, so that she
could see their daily progress, and her friends' friends' too. On 1 October he chose
the narrower option instead:

| Asked for | Built | Why |
|---|---|---|
| A one-time, unique QR code that connects two children | A QR code of the game's address, the same for everyone | A connection would disclose one child's activity to another. That is ICO standard 9, "Do not disclose children's data unless you can demonstrate a compelling reason" |
| Seeing friends' daily progress, points and highlights | Nothing: nobody sees anybody | Standard 5's guidance names "features which use personal data to exploit human susceptibility to reward, anticipatory and pleasure seeking behaviours, or peer pressure" |
| Seeing friends' friends ("Isla's connection") | Nothing | It would show a named child's activity to children her family does not know |

A social layer can come back later, but only after its own DPIA. It would also need
parental consent, because under 13 "an adult with parental responsibility must
provide consent"
([ICO](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/childrens-information/children-and-the-uk-gdpr/what-are-the-rules-about-an-iss-and-consent/)).

## What the service is, and what it processes

| What | Where it lives | Who can see it |
|---|---|---|
| The program: pages, word lists, recordings | TST's Azure Static Web App | Anyone with the address |
| Her learning record: attempts as typed, sessions, schedule, games, the experiment's assignments and log | IndexedDB on her own tablet | The family on that tablet. The publisher never receives it |
| Her first name, if a grown-up types it | IndexedDB on her own tablet | Only that tablet. Never synced or exported |
| Aggregates (daily counts and percentages, the experiment's tallies per arm) | The family's own Firebase project, **only if a grown-up turns sync on and pastes their own config on that tablet** | That project's owner |
| How loud the room is, while the microphone listens | Memory, for a moment | Nobody: nothing is kept, sent or turned into words |
| The QR code | A static image of the address | Anyone |

There are no accounts, no analytics, no cookies, no adverts, and no third-party
scripts. The one exception is the Firebase library, which is fetched only once sync
is on.

**The controller question.** For data on a tablet, the family using it is the only
party that ever holds it. For Firebase, the controller is whoever owns the project:
for Beatrix, Peter, as her parent. If Peter or TST ever received another child's
data, that would change, and this document would need redoing. TST hosts the files;
whether TST is content to host a children's learning game on its company domain is
for Peter to settle (`docs/13`, "Still open").

## The fifteen standards

| Standard | How the app meets it | What remains |
|---|---|---|
| 1. Best interests | Learning comes first, the evidence is cited in `docs/01` and `docs/02` | |
| 2. DPIA | This document | Sign-off |
| 3. Age-appropriate application | Every standard is applied to every user, with no age check needed | |
| 4. Transparency | The share screen and the grown-up view say what stays and what leaves, in plain words, and the share screen links a one-page notice for families (`web/privacy.html`) | Review the notice (action 1) |
| 5. Detrimental use | No streaks; points only inside games; no comparison with other children. A run in the pattern game fades when it breaks, but that is within one sitting and never carries over | Watch that games do not crowd out dictation (`docs/11`) |
| 6. Policies | No content is shared between users | |
| 7. Default settings | Sync off, microphone off, no network calls at launch | |
| 8. Data minimisation | No name in the record; only counts leave a tablet | |
| 9. Data sharing | None. Sharing is the address only | |
| 10. Geolocation | None | |
| 11. Parental controls | The grown-up view. When sync is on, her welcome page tells her: "Your grown-up can see your totals, but never the words you write." When the microphone listens, a meter shows it, and the browser shows its own sign | |
| 12. Profiling | The experiment assigns help at random, which is not profiling. A later adaptive phase would be, and would be switched on deliberately and documented | |
| 13. Nudge techniques | Sharing earns nothing, counts nothing and is never prompted: it is one labelled button on the welcome page that she has to choose to press, and no game, message or reward mentions it. The privacy switches are in the grown-up view only | Watch that it stays that way: a "share your score" prompt would be a nudge |
| 14. Connected toys and devices | The microphone listens on the tablet only (`web/js/voice.js`) | |
| 15. Online tools | Export and delete-everything in the grown-up view | |

[The 15 standards](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/childrens-information/childrens-code-guidance-and-resources/age-appropriate-design-a-code-of-practice-for-online-services/code-standards/)

## The features this build added

- **The microphone.** The risk is a child's voice. Only a volume level is
  computed, on the tablet. Browser speech recognition is deliberately not used,
  because it can send audio to Apple or Google. The microphone is off by default, has
  a visible meter, and closes when she leaves the game.
- **Firebase.** The risk is data leaving the tablet. Only counts can be sent: the
  app's typed allowlist strips everything else, and the database rules
  (`firebase/database.rules.json`) refuse any other field on the server. Sign-in is
  anonymous, and each tablet can write only its own record. The settings are pasted
  on her tablet only, so no other device syncs. Choose a European region when
  creating the database.
- **The experiment.** Help is assigned at random and logged on the tablet. Only the
  tallies per arm can leave it. Pre-registered in `experiments/`, and it starts only
  once the quotations have been reviewed.
- **Sharing.** The address and one plain sentence, with no tracking parameter and no
  reward. On 6 October Peter asked for a "Share this with your friends" function built in
  for the student and the parent, because the first one was a small link at the foot of the
  welcome page that he could not find. It is now a labelled button on the welcome page that
  opens the device's own share sheet where there is one, copies the link where there is
  not, and shows the QR code; and the grown-up view has a message to send to another
  parent. Nothing else changed: the text is fixed in the app (`SHARE` in `web/js/app.js`),
  carries no name, no result and no parameter, and nobody is told who shared it. The
  device's share sheet is the operating system's, so what it suggests (contacts, apps) is
  outside this service's control, and the notice for families says so.

## Actions

1. Review the one-page notice for families, `web/privacy.html`, drafted in this build
   and linked from the share screen.
2. Peter to settle the TST hosting question.
3. Re-check the Children's Code after the Data (Use and Access) Act revisions
   (`docs/06` action 4).
4. Any social feature: a new DPIA first, with parental consent built in.

## Conclusion, for review

**Low risk as built.** Nothing about any child leaves any tablet unless that child's
own grown-up switches sync on with their own Firebase project, and even then only
counts leave. The recommendation is to proceed with share-only once actions 1 and 2
are done.
