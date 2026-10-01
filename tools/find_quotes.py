"""
Find, and later verify, real sentences that use each word: the "story" support.

    python3 tools/find_quotes.py find      # rank candidates for every word
    python3 tools/find_quotes.py verify    # check every chosen quotation, word for word

The corpus is public-domain British fiction from Project Gutenberg, downloaded once
into .cache/gutenberg/ (gitignored). British because the spellings have to be the
ones she is being taught: an American text spells the verb "practice" and the noun
"license", which would teach the opposite of the noun/verb week.

`find` writes .cache/quote_candidates.json and a readable .cache/quote_candidates.md.
A person chooses from those. The choice is written into engine/supports.py, and
`verify` re-reads each source and fails unless the chosen sentence is in it exactly,
spelling, punctuation and all, with only whitespace and Gutenberg's _italic_
underscores normalised. A quotation that is not exactly in its book is not a quotation.

Network is needed only to fill the cache. Nothing here runs in CI.
"""
import json
import pathlib
import re
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
CACHE = ROOT / ".cache" / "gutenberg"
sys.path.insert(0, str(ROOT / "engine"))

# ebook number: (author, title as Gutenberg gives it, first published, children's book?)
CORPUS = {
    11: ("Lewis Carroll", "Alice's Adventures in Wonderland", 1865, True),
    12: ("Lewis Carroll", "Through the Looking-Glass", 1871, True),
    16: ("J. M. Barrie", "Peter Pan", 1911, True),
    113: ("Frances Hodgson Burnett", "The Secret Garden", 1911, True),
    146: ("Frances Hodgson Burnett", "A Little Princess", 1905, True),
    236: ("Rudyard Kipling", "The Jungle Book", 1894, True),
    271: ("Anna Sewell", "Black Beauty", 1877, True),
    289: ("Kenneth Grahame", "The Wind in the Willows", 1908, True),
    708: ("George MacDonald", "The Princess and the Goblin", 1872, True),
    770: ("E. Nesbit", "The Story of the Treasure Seekers", 1899, True),
    778: ("E. Nesbit", "Five Children and It", 1902, True),
    1018: ("Charles Kingsley", "The Water-Babies", 1863, True),
    1874: ("E. Nesbit", "The Railway Children", 1906, True),
    1937: ("Rudyard Kipling", "The Second Jungle Book", 1895, True),
    2781: ("Rudyard Kipling", "Just So Stories", 1902, True),
    120: ("Robert Louis Stevenson", "Treasure Island", 1883, True),
    421: ("Robert Louis Stevenson", "Kidnapped", 1886, True),
    105: ("Jane Austen", "Persuasion", 1817, False),
    121: ("Jane Austen", "Northanger Abbey", 1817, False),
    141: ("Jane Austen", "Mansfield Park", 1814, False),
    158: ("Jane Austen", "Emma", 1815, False),
    161: ("Jane Austen", "Sense and Sensibility", 1811, False),
    1342: ("Jane Austen", "Pride and Prejudice", 1813, False),
    46: ("Charles Dickens", "A Christmas Carol", 1843, False),
    98: ("Charles Dickens", "A Tale of Two Cities", 1859, False),
    580: ("Charles Dickens", "The Pickwick Papers", 1837, False),
    730: ("Charles Dickens", "Oliver Twist", 1838, False),
    766: ("Charles Dickens", "David Copperfield", 1850, False),
    786: ("Charles Dickens", "Hard Times", 1854, False),
    963: ("Charles Dickens", "Little Dorrit", 1857, False),
    967: ("Charles Dickens", "Nicholas Nickleby", 1839, False),
    1023: ("Charles Dickens", "Bleak House", 1853, False),
    1400: ("Charles Dickens", "Great Expectations", 1861, False),
    1260: ("Charlotte Bront\u00eb", "Jane Eyre", 1847, False),
    768: ("Emily Bront\u00eb", "Wuthering Heights", 1847, False),
    145: ("George Eliot", "Middlemarch", 1871, False),
    550: ("George Eliot", "Silas Marner", 1861, False),
    1661: ("Arthur Conan Doyle", "The Adventures of Sherlock Holmes", 1892, False),
    2852: ("Arthur Conan Doyle", "The Hound of the Baskervilles", 1902, False),
    308: ("Jerome K. Jerome", "Three Men in a Boat", 1889, False),
    35: ("H. G. Wells", "The Time Machine", 1895, False),
    36: ("H. G. Wells", "The War of the Worlds", 1898, False),
    521: ("Daniel Defoe", "The Life and Adventures of Robinson Crusoe", 1719, False),
    829: ("Jonathan Swift", "Gulliver's Travels", 1726, False),
}

# Sentences a ten-year-old should not be handed as a spelling example: violence,
# death, drink, and the racist and antisemitic language some of these books contain.
UNSUITABLE = re.compile(r"\b(" + "|".join([
    "kill\\w*", "murder\\w*", "blood\\w*", "dead", "death\\w*", "die", "died", "dying",
    "corpse\\w*", "hang\\w*", "hung", "stab\\w*", "shot", "shoot\\w*", "gun\\w*",
    "pistol\\w*", "whip\\w*", "beat", "beaten", "flog\\w*", "drunk\\w*", "gin",
    "brandy", "rum", "beer", "wine", "liquor", "devil\\w*", "damn\\w*", "hell",
    "slave\\w*", "savage\\w*", "negro\\w*", "nigger\\w*", "jew\\w*", "gipsy",
    "gypsy", "gipsies", "heathen\\w*", "chinaman", "coolie\\w*", "suicide",
    "poison\\w*", "grave", "graves", "coffin\\w*", "funeral\\w*", "widow\\w*",
    "breast\\w*", "naked", "bosom\\w*", "lust\\w*", "mistress", "wench\\w*",
]) + r")\b", re.I)

ARCHAIC = re.compile(r"\b(thee|thou|thy|thine|hath|doth|'tis|shew\w*|ere|wherefore|"
                     r"art|wilt|shalt|'em|ain't|wot|hisself|ye)\b", re.I)


def fetch(ebook):
    CACHE.mkdir(parents=True, exist_ok=True)
    path = CACHE / f"pg{ebook}.txt"
    if not path.exists():
        # curl rather than urllib: it copes with the proxies this runs behind, and retries.
        url = f"https://www.gutenberg.org/cache/epub/{ebook}/pg{ebook}.txt"
        tmp = path.with_suffix(".part")
        subprocess.run(["curl", "-sSfL", "--retry", "4", "--retry-delay", "2",
                        "--max-time", "120", "-o", str(tmp), url], check=True)
        tmp.rename(path)
    return path.read_text(encoding="utf-8", errors="replace")


def body(raw):
    """The book itself, without Gutenberg's header and licence."""
    start = re.search(r"\*\*\* ?START OF (THE|THIS) PROJECT GUTENBERG EBOOK[^\n]*\n", raw)
    end = re.search(r"\*\*\* ?END OF (THE|THIS) PROJECT GUTENBERG EBOOK", raw)
    return raw[start.end() if start else 0:end.start() if end else len(raw)]


def title_of(raw):
    m = re.search(r"Title: *(.+)", raw)
    return m.group(1).strip() if m else ""


def normalise(text):
    """Whitespace collapsed and _italic_ marks dropped: the only changes allowed."""
    return re.sub(r"\s+", " ", text.replace("_", "")).strip()


def paragraphs(text):
    for p in re.split(r"\n\s*\n", text):
        p = normalise(p)
        if p:
            yield p


# A sentence ends at . ! or ?, plus any closing quotation marks, before a capital.
# Titles like "Mr." are protected first, or "Mrs. Medlock looked..." would be cut
# into a fragment starting "Medlock looked...", which is not what the book says.
ABBREV = re.compile(r"\b(Mr|Mrs|Messrs|Dr|St|Mme|Mlle|Capt|Col|Gen|Prof|Rev|Sr|Jr|No|Mt|Esq)\.")
CLOSE = "\"'\u201d\u2019)]"
OPEN = "\"'\u201c\u2018(["
END = re.compile("[.!?]+[" + re.escape(CLOSE) + "]*(?=\\s+[" + re.escape(OPEN) + "]?[A-Z0-9]|\\s*$)")


def sentences(flat):
    guarded = ABBREV.sub(lambda m: m.group(0)[:-1] + "\u0001", flat)
    out, start = [], 0
    for m in END.finditer(guarded):
        out.append(guarded[start:m.end()].strip())
        start = m.end()
    if guarded[start:].strip():
        out.append(guarded[start:].strip())
    return [x.replace("\u0001", ".") for x in out if x]


def chapters(text):
    """(offset, heading) for each chapter heading, to say where a quotation is."""
    out = []
    for m in re.finditer(r"^\s*(CHAPTER|Chapter|BOOK|STAVE)\s+[^\n]{1,60}$", text, re.M):
        out.append((m.start(), normalise(m.group(0))))
    return out


def word_pattern(word):
    return re.compile(r"(?<![A-Za-z-])" + re.escape(word) + r"(?![A-Za-z-])", re.I)


def score(sentence, children):
    n = len(sentence)
    s = 10 - abs(n - 95) / 15
    s += 3 if children else 0
    s -= sentence.count(";") * 1.5 + sentence.count(":")
    s -= 4 if ARCHAIC.search(sentence) else 0
    s -= 2 if sentence.count("'") > 4 else 0
    return round(s, 2)


def balanced(sentence):
    # A curly closing single quote doubles as the apostrophe, so it can only be
    # checked one way: every opening mark must have its closing one.
    return (sentence.count("\u201c") == sentence.count("\u201d")
            and sentence.count("\u2018") <= sentence.count("\u2019")
            and sentence.count('"') % 2 == 0 and sentence.count("(") == sentence.count(")"))


def candidates(words, per_word=6):
    found = {w: [] for w in words}
    patterns = {w: word_pattern(w) for w in words}
    for ebook, (author, title, year, children) in CORPUS.items():
        try:
            raw = fetch(ebook)
        except subprocess.CalledProcessError:
            print(f"  ! pg{ebook} ({title}): could not download, skipped", file=sys.stderr)
            continue
        got = title_of(raw)
        if not got.lower().startswith(title.lower()[:12]):
            print(f"  ! pg{ebook}: expected {title!r}, Gutenberg says {got!r}", file=sys.stderr)
            continue
        text = body(raw)
        heads = chapters(text)
        pos = 0
        for para in re.split(r"\n\s*\n", text):
            start = text.find(para, pos)
            pos = start + len(para) if start >= 0 else pos
            flat = normalise(para)
            if not flat:
                continue
            chapter = next((h for off, h in reversed(heads) if off <= start), "")
            for sentence in sentences(flat):
                if not (30 <= len(sentence) <= 200) or UNSUITABLE.search(sentence):
                    continue
                if not balanced(sentence):
                    continue
                for w, pat in patterns.items():
                    if len(pat.findall(sentence)) == 1:
                        found[w].append({"text": sentence, "ebook": ebook, "author": author,
                                         "title": title, "year": year, "chapter": chapter,
                                         "score": score(sentence, children)})
    for w in found:
        found[w].sort(key=lambda c: -c["score"])
        # One sentence per book at most, so the shortlist is varied.
        seen, short = set(), []
        for c in found[w]:
            if c["ebook"] not in seen:
                short.append(c)
                seen.add(c["ebook"])
            if len(short) == per_word:
                break
        found[w] = short
    return found


def experiment_words():
    import games
    from words import WORDS
    return sorted({w["word"] for w in WORDS} | set(games.ENTRIES))


def main_find():
    words = experiment_words()
    found = candidates(words)
    out = ROOT / ".cache"
    (out / "quote_candidates.json").write_text(json.dumps(found, indent=1, ensure_ascii=False))
    lines = []
    for w in words:
        lines.append(f"## {w} ({len(found[w])})")
        for i, c in enumerate(found[w]):
            lines.append(f"{i}. [{c['score']}] {c['text']}  ({c['author']}, {c['title']}, "
                         f"pg{c['ebook']}, {c['chapter']})")
        lines.append("")
    (out / "quote_candidates.md").write_text("\n".join(lines))
    missing = [w for w in words if not found[w]]
    print(f"{len(words)} words, {len(words) - len(missing)} with candidates; none for: "
          f"{', '.join(missing)}")


def main_verify():
    import supports
    bad = []
    for word, (ebook, quote) in supports.QUOTES.items():
        text = normalise(body(fetch(ebook)))
        # A trailing "..." marks a cut: what comes before it must be in the book exactly.
        kept = quote[:-3] if quote.endswith("...") else quote
        if normalise(kept) not in text:
            bad.append(f"{word}: not found word for word in pg{ebook}")
        elif len(word_pattern(word).findall(quote)) != 1:
            bad.append(f"{word}: the quotation does not contain the word exactly once")
        elif supports.BOOKS.get(ebook) is None:
            bad.append(f"{word}: pg{ebook} is not in supports.BOOKS")
    for line in bad:
        print("  FAIL", line)
    print(f"{len(supports.QUOTES) - len(bad)} of {len(supports.QUOTES)} quotations verified "
          "word for word against their Gutenberg texts")
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    {"find": main_find, "verify": main_verify}[sys.argv[1] if len(sys.argv) > 1 else "find"]()
