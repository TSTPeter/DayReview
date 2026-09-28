"""
The autumn 2026 term's spelling lists, as the school sent them home.

The sheet says: "Spellings are taught on Monday in school and the spelling test is
on Friday each week." Six weeks arrived on one page (there is no list for the week
of 14 September). Each week is ten words that share a pattern and five from the
statutory Year 5/6 list, which the sheet prints in bold.

Loading the whole term here means each Monday's list switches itself on, with the
test that Friday, instead of an adult retyping it every Sunday. A list the adult
edits in the app still wins for its own week: see scheduled_week() in weekly.py
and boot() in web/js/app.js.

The theme is a few words for the welcome page ("This week: -ant, -ance and -ancy").
It is written by hand because it names the teaching point, which the letters alone
do not always show.

    python3 engine/export.py     writes web/data/term.json from this file
"""
from datetime import date

import weekly

TERM = [
    {"set_on": "2026-09-07", "theme": "Strong describing words",
     "pattern": ["aggressive", "hostile", "awkward", "obstinate", "desperate", "frantic",
                 "disastrous", "calamitous", "marvellous", "spectacular"],
     "statutory": ["accommodate", "accompany", "according", "achieve", "amateur"]},
    {"set_on": "2026-09-21", "theme": "Nouns with c, verbs with s",
     "pattern": ["advice", "advise", "device", "devise", "licence", "license",
                 "practice", "practise", "prophecy", "prophesy"],
     "statutory": ["ancient", "apparent", "appreciate", "attached", "available"]},
    {"set_on": "2026-09-28", "theme": "-ant, -ance and -ancy",
     "pattern": ["observant", "observance", "expectant", "expectancy", "hesitant",
                 "hesitancy", "tolerant", "tolerance", "relevant", "relevance"],
     "statutory": ["average", "awkward", "bargain", "bruise", "category"]},
    {"set_on": "2026-10-05", "theme": "-ent, -ence and -ency",
     "pattern": ["innocent", "innocence", "decent", "decency", "excellent", "excellence",
                 "confident", "confidence", "existent", "existence"],
     "statutory": ["cemetery", "committee", "communicate", "community", "competition"]},
    {"set_on": "2026-10-12", "theme": "Hyphens after co- and re-",
     "pattern": ["co-operate", "co-ordinate", "co-own", "co-author", "re-enter",
                 "re-educate", "re-examine", "re-evaluate", "re-energise", "re-elect"],
     "statutory": ["conscience", "conscious", "controversy", "convenience", "correspond"]},
    {"set_on": "2026-10-19", "theme": "Hyphens that join two words",
     "pattern": ["man-eating", "little-used", "rock-bottom", "wide-eyed", "pig-headed",
                 "tight-fisted", "cold-hearted", "stone-faced", "green-eyed",
                 "short-tempered"],
     "statutory": ["criticise", "curiosity", "definite", "desperate", "determined"]},
]


def weeks():
    """Each week as a weekly list, exactly as if an adult had pasted it that Monday."""
    out = []
    for week in TERM:
        words = week["pattern"] + week["statutory"]
        lst = weekly.make_list("\n".join(words), date.fromisoformat(week["set_on"]))
        lst.update(theme=week["theme"], pattern=week["pattern"],
                   statutory=week["statutory"], source="term")
        out.append(lst)
    return out


def words():
    """Every word on the sheet, once, in term order."""
    seen, out = set(), []
    for week in TERM:
        for w in week["pattern"] + week["statutory"]:
            if w not in seen:
                seen.add(w)
                out.append(w)
    return out
