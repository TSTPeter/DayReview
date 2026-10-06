"""tools/deploy_to_site.py: the stamp, and the version a device reports.

The grown-up view says which version a device is showing (web/js/app.js, "updates"),
so a grown-up can tell whether a change has reached it. That only means something if
the deploy writes the version file, gives it the same stamp as the service worker, and
the worker caches it with the version it describes.
"""
import importlib.util
import json
import pathlib
import re
import shutil
import tempfile
import unittest
from contextlib import redirect_stdout
from io import StringIO

ROOT = pathlib.Path(__file__).resolve().parents[1]
_spec = importlib.util.spec_from_file_location("deploy_to_site", ROOT / "tools" / "deploy_to_site.py")
deploy = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(deploy)

STAMP = re.compile(r"const CACHE = `\$\{PREFIX\}(\w+)`;")


class DeployedVersionTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.TemporaryDirectory()
        site = pathlib.Path(cls.tmp.name)
        (site / ".git").mkdir()
        with redirect_stdout(StringIO()):
            deploy.main(["deploy_to_site.py", str(site)])
        cls.dest = site / "Games" / "Spelling"

    @classmethod
    def tearDownClass(cls):
        cls.tmp.cleanup()

    @staticmethod
    def stamp_of(dest):
        return STAMP.search((dest / "sw.js").read_text(encoding="utf-8")).group(1)

    def copy(self):
        # Each test that changes files does it to its own copy of the deployed folder.
        where = pathlib.Path(self.tmp.name) / f"copy-{self._testMethodName}"
        shutil.copytree(self.dest, where)
        return where

    def test_the_version_file_carries_the_service_workers_stamp(self):
        version = json.loads((self.dest / "data" / "version.json").read_text(encoding="utf-8"))
        self.assertRegex(self.stamp_of(self.dest), r"^[0-9a-f]{12}$")
        self.assertEqual(version["stamp"], self.stamp_of(self.dest))
        self.assertRegex(version["synced"], r"^\d{4}-\d{2}-\d{2}$")
        self.assertTrue(version["commit"])

    def test_the_stamp_is_of_the_content_not_of_the_version_file(self):
        # Written after the stamp, the version file cannot be part of what it hashes.
        dest = self.copy()
        (dest / "data" / "version.json").write_text("{}", encoding="utf-8")
        self.assertEqual(deploy.stamp_cache_version(dest), self.stamp_of(self.dest))

    def test_the_stamp_changes_when_the_content_does(self):
        dest = self.copy()
        (dest / "data" / "games.json").write_text("{}", encoding="utf-8")
        self.assertNotEqual(deploy.stamp_cache_version(dest), self.stamp_of(self.dest))


class DashRuleTest(unittest.TestCase):
    """ProductionSite bans em and en dashes in every file, UI copy included.

    The deploy check once looked only for the character. An HTML entity in the week
    screen and a JavaScript escape in the rule card both rendered a dash and both got
    through to the live site (6 October 2026), so the check now sees all three forms.
    """

    FORMS = {
        "the character": "a \u2014 b",
        "an en dash": "a \u2013 b",
        "a named entity": "a &mdash; b",
        "a named en entity": "a &ndash; b",
        "a decimal entity": "a &#8212; b",
        "a hex entity": "a &#x2014; b",
        "a script escape": "a \\u2014 b",
        "a braced script escape": "a \\u{2013} b",
    }

    def scan(self, files):
        with tempfile.TemporaryDirectory() as tmp:
            for name, text in files.items():
                pathlib.Path(tmp, name).write_text(text, encoding="utf-8")
            return deploy.dash_offenders(pathlib.Path(tmp))

    def test_every_form_is_caught(self):
        for label, text in self.FORMS.items():
            with self.subTest(form=label):
                self.assertEqual(self.scan({"page.html": text, "other.js": "clean"}), ["page.html"])

    def test_ordinary_text_is_not(self):
        clean = "co-operate, re-enter; a hyphen - and the entity &rsquo; and \\u2010 are fine"
        self.assertEqual(self.scan({"page.html": clean}), [])

    def test_everything_the_game_serves_is_clean(self):
        self.assertEqual(deploy.dash_offenders(ROOT / "web"), [])


class SourceVersionTest(unittest.TestCase):
    def test_the_service_worker_caches_the_version_file_with_its_version(self):
        self.assertIn('"data/version.json"', (ROOT / "web" / "sw.js").read_text(encoding="utf-8"))

    def test_the_development_copy_says_it_is_one(self):
        version = json.loads((ROOT / "web" / "data" / "version.json").read_text(encoding="utf-8"))
        self.assertEqual(version["stamp"], "dev")


if __name__ == "__main__":
    unittest.main()
