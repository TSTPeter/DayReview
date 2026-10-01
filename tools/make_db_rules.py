"""
Write firebase/database.rules.json from the allowlist in web/js/sync.js.

    python3 tools/make_db_rules.py

The rules are the server's half of the allowlist: an anonymous sign-in may write its
own record and nothing else, and every field that is not on sync.js's typed list is
rejected, so even a broken app could not store a word she wrote. Generated from
sync.js's SCHEMA so the two cannot drift; tests/test_firebase_rules.py checks that.
Paste the file into the Firebase console (Realtime Database, Rules) when setting up.
"""
import json
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / "firebase" / "database.rules.json"
ARMS = ("etymology", "story", "say", "blend")
RULE = {
    "string": "newData.isString() && newData.val().length <= 64",
    "count": "newData.isNumber() && newData.val() >= 0 && newData.val() % 1 === 0",
    "ratio": "newData.isNumber() && newData.val() >= 0 && newData.val() <= 1",
}


def schema():
    sync = (ROOT / "web" / "js" / "sync.js").read_text()
    block = sync[sync.index("const SCHEMA = Object.freeze({"):sync.index("});", sync.index("const SCHEMA"))]
    return dict(re.findall(r"^  (\w+): \"(string|count|ratio|ratiomap)\",", block, re.M))


def fields():
    out = {}
    for key, kind in schema().items():
        out[key] = ({"$pattern": {".validate": RULE["ratio"]}} if kind == "ratiomap"
                    else {".validate": RULE[kind]})
    out["$other"] = {".validate": False}
    return out


def rules():
    day = fields()
    day[".validate"] = "$date.matches(/^\\d{4}-\\d{2}-\\d{2}$/) && newData.child('date').val() === $date"
    tally = {k: {".validate": RULE["count"]} for k in ("words", "outcomes", "correct")}
    tally["$other"] = {".validate": False}
    tally[".validate"] = "newData.hasChildren(['words', 'outcomes', 'correct'])"
    experiment = {arm: dict(tally) for arm in ARMS}
    experiment["updated_at"] = {".validate": RULE["string"]}
    experiment["$other"] = {".validate": False}
    return {"rules": {
        ".read": False, ".write": False,
        "learners": {"$uid": {
            ".read": "auth != null && auth.uid === $uid",
            ".write": "auth != null && auth.uid === $uid",
            "days": {"$date": day},
            "profile": fields(),
            "experiment": experiment,
            "$other": {".validate": False},
        }},
    }}


def text():
    return json.dumps(rules(), indent=2) + "\n"


if __name__ == "__main__":
    OUT.parent.mkdir(exist_ok=True)
    OUT.write_text(text())
    print(f"wrote {OUT.relative_to(ROOT)}  {len(schema())} allowlisted fields")
