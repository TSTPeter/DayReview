"""
The database rules are the server's half of the Firebase allowlist.

They are generated from web/js/sync.js's SCHEMA by tools/make_db_rules.py. If the
two drift, a field the app sends would be rejected, or worse, a field it should
never send would be accepted. This holds them together.
"""
import json
import pathlib
import sys
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))

import make_db_rules  # noqa: E402

RULES = json.loads((ROOT / "firebase" / "database.rules.json").read_text())


class TestRules(unittest.TestCase):
    def test_the_file_is_current(self):
        self.assertEqual((ROOT / "firebase" / "database.rules.json").read_text(),
                         make_db_rules.text(), "Run: python3 tools/make_db_rules.py")

    def test_closed_by_default(self):
        self.assertIs(RULES["rules"][".read"], False)
        self.assertIs(RULES["rules"][".write"], False)

    def test_each_sign_in_reaches_only_its_own_record(self):
        learner = RULES["rules"]["learners"]["$uid"]
        for k in (".read", ".write"):
            self.assertEqual(learner[k], "auth != null && auth.uid === $uid")

    def test_anything_off_the_allowlist_is_refused(self):
        learner = RULES["rules"]["learners"]["$uid"]
        for node in (learner, learner["days"]["$date"], learner["profile"],
                     learner["experiment"], learner["experiment"]["blend"]):
            self.assertEqual(node["$other"], {".validate": False})

    def test_her_writing_has_nowhere_to_go(self):
        day = RULES["rules"]["learners"]["$uid"]["days"]["$date"]
        for forbidden in ("attempt_text", "raw", "error_detail", "word", "trap",
                          "latency_ms", "keystroke_count", "session_id"):
            self.assertNotIn(forbidden, day)

    def test_every_schema_field_is_allowed(self):
        day = RULES["rules"]["learners"]["$uid"]["days"]["$date"]
        for key in make_db_rules.schema():
            self.assertIn(key, day)


if __name__ == "__main__":
    unittest.main()
