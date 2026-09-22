// Prints what the browser would ask the clip manifest for, for test_audio.py to
// compare against the Python side. A clip is found by its EXACT text, so these
// strings have to match to the character.
import { readFileSync } from "node:fs";
import { namingLine, setClips, clipsCover, clipFor } from "../web/js/audio.js";
import { hintFor } from "../web/js/engine/derive.js";

const input = JSON.parse(readFileSync(0, "utf8"));
const naming = {};
for (const w of input.words) naming[w] = namingLine(w, hintFor(w));

// clipsCover must need BOTH lines: one voice per item.
setClips({ clips: { "The word is cat.": "audio/a.mp3", "A cat sat.": "audio/b.mp3" } });
const cover = {
  both: clipsCover("cat", "A cat sat."),
  namingOnly: clipsCover("cat", "A different sentence."),
  noSentence: clipsCover("cat", ""),
  missing: clipsCover("dog", "A cat sat."),
  prototypeKey: clipFor("constructor"),   // must not find Object.prototype
};
process.stdout.write(JSON.stringify({ naming, cover }));
