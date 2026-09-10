"""
The browser scheduler must produce the same queue as the Python one.

A queue that differs between implementations means the child practises different words
depending on where the code ran, and days_since_last_seen in the dataset stops meaning
anything. Replays tests/golden/session.json through web/js/engine/schedule.js.
"""
import json
import pathlib
import shutil
import subprocess
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
GOLDEN = ROOT / "tests" / "golden" / "session.json"
RUNNER = ROOT / "tests" / "schedule_parity_runner.mjs"
NODE = shutil.which("node")


@unittest.skipIf(NODE is None, "node not installed")
class TestSchedulerParity(unittest.TestCase):
    def test_js_replay_matches_the_python_golden_file(self):
        proc = subprocess.run([NODE, str(RUNNER)], capture_output=True, text=True)
        self.assertEqual(proc.returncode, 0, proc.stderr)
        actual = json.loads(proc.stdout)
        expected = json.loads(GOLDEN.read_text())
        self.maxDiff = None
        self.assertEqual(actual, expected,
                         "browser scheduler diverged from engine/schedule.py")


if __name__ == "__main__":
    unittest.main()
