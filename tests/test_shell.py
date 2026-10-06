"""The offline shell: everything the game loads has to be in the service worker's list.

web/sw.js caches a fixed list of files, cache-first, so the game works with no network.
A module that is imported but not listed loads fine online and then fails offline, on the
one device where nobody can tell why. Six games were added to this app in two months, each
with a module of its own, so this checks the list against the files rather than trusting it.
"""
import pathlib
import re
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
WEB = ROOT / "web"
SW = (WEB / "sw.js").read_text(encoding="utf-8")
SHELL = set(re.findall(r'"([^"]+)"', re.search(r"const SHELL = \[(.*?)\];", SW, re.S).group(1)))

# Loaded when needed, not part of the shell: recordings (several megabytes), the icons the
# manifest names, and a config that is never served.
NOT_IN_SHELL = {"data/firebase.json", "apple-touch-icon.png"}


class TestTheShell(unittest.TestCase):
    def test_every_listed_file_exists(self):
        for name in sorted(SHELL):
            if name == "./":
                continue
            with self.subTest(file=name):
                self.assertTrue((WEB / name).is_file(), f"{name} is in the shell but not in web/")

    def test_every_script_and_stylesheet_is_listed(self):
        for kind in ("js", "css"):
            for path in sorted((WEB / kind).rglob(f"*.{kind}")):
                name = path.relative_to(WEB).as_posix()
                with self.subTest(file=name):
                    self.assertIn(name, SHELL, f"{name} would fail offline: add it to SHELL in web/sw.js")

    def test_every_data_file_is_listed(self):
        for path in sorted((WEB / "data").glob("*.json")):
            name = path.relative_to(WEB).as_posix()
            if name in NOT_IN_SHELL:
                continue
            with self.subTest(file=name):
                self.assertIn(name, SHELL, f"{name} would fail offline: add it to SHELL in web/sw.js")

    def test_every_module_an_import_names_is_listed(self):
        for path in sorted((WEB / "js").rglob("*.js")):
            for target in re.findall(r'from "(\./[^"]+\.js)"', path.read_text(encoding="utf-8")):
                name = (path.parent / target).resolve().relative_to(WEB.resolve()).as_posix()
                with self.subTest(importer=path.name, imports=name):
                    self.assertIn(name, SHELL)


if __name__ == "__main__":
    unittest.main()
