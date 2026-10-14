// Fill the gap needs its word to appear once, as a whole word, in the sentence the child
// heard, or the gap would stand for two things (or none). The same function the game uses,
// run over every word of the term against the shipped sentences.
import { readFileSync } from "node:fs";
import { blank } from "../web/js/gap.js";

const read = (p) => JSON.parse(readFileSync(new URL(`../web/data/${p}`, import.meta.url), "utf8"));
const sentences = read("sentences.json").sentences;
const term = read("term.json");

let failures = 0;
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "  ok  " : "FAIL  "}${name}${detail ? "  : " + detail : ""}`);
  if (!ok) failures += 1;
};

const words = [...new Set(term.weeks.flatMap((w) => w.words))];
check("the term has the 88 words", words.length === 88, String(words.length));

const bad = words.filter((w) => !sentences[w] || !blank(sentences[w], w));
check("every term word is in its sentence exactly once, as a whole word", bad.length === 0, bad.join(", "));

const rejoined = words.filter((w) => {
  const b = blank(sentences[w], w);
  return b && (b.before + b.found + b.after) !== sentences[w];
});
check("the sentence is rebuilt exactly from its three parts", rejoined.length === 0, rejoined.join(", "));

const spelt = words.filter((w) => {
  const b = blank(sentences[w], w);
  return b && b.found.toLowerCase() !== w;
});
check("what is found is the word itself, only its capital may differ", spelt.length === 0, spelt.join(", "));

check("a word that is part of a longer one is not found",
      blank("The cat sat on the category.", "cat") !== null
      && blank("A category of things.", "cat") === null
      && blank("He is observant and observant.", "observant") === null);
check("a hyphenated word is found whole",
      blank("A man-eating shark.", "man-eating") !== null && blank("A man eating chips.", "man-eating") === null);

console.log(`\n${failures ? `${failures} CHECK(S) FAILED` : "all checks passed"}\n`);
process.exit(failures ? 1 : 0);
