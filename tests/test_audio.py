"""
Pre-rendered dictation: the manifest, the files, and the text contract.

web/js/audio.js finds a clip by the EXACT text it is about to say. If the Python
renderer and the browser disagree by one comma, every item quietly falls back to
the device voice and nothing looks broken. These tests are what notice.

The coverage tests skip while nothing has been rendered (an empty manifest is a
valid state: the device voice throughout). Once clips exist, an edited sentence
without a re-render fails here, with the command that fixes it.
"""
import json
import pathlib
import re
import shutil
import subprocess
import sys
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "engine"))
sys.path.insert(0, str(ROOT / "tools"))

import derive  # noqa: E402
import render_audio  # noqa: E402
import sentences  # noqa: E402

MANIFEST = ROOT / "web" / "data" / "audio.json"
AUDIO = ROOT / "web" / "audio"
NODE = shutil.which("node")
RUNNER = ROOT / "tests" / "audio_parity_runner.mjs"
CLIP = re.compile(r"^audio/[0-9a-f]{16}\.mp3$")


def manifest():
    return json.loads(MANIFEST.read_text(encoding="utf-8"))


@unittest.skipIf(NODE is None, "node not installed")
class TestTheTextContract(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        payload = {"words": sorted(sentences.SENTENCES)}
        proc = subprocess.run([NODE, str(RUNNER)], input=json.dumps(payload),
                              capture_output=True, text=True)
        if proc.returncode != 0:
            raise AssertionError(f"node runner failed:\n{proc.stderr}")
        cls.js = json.loads(proc.stdout)

    def test_naming_line_is_identical_in_both_languages(self):
        for word in sentences.SENTENCES:
            with self.subTest(word=word):
                self.assertEqual(
                    self.js["naming"][word],
                    sentences.naming_line(word, derive.hint_for(word)),
                    "the browser would ask for a clip the renderer never made")

    def test_the_pairs_carry_their_word_class_in_the_rendered_line(self):
        self.assertEqual(self.js["naming"]["practise"], "The word is practise, the verb.")
        self.assertEqual(self.js["naming"]["advice"], "The word is advice, the noun.")
        self.assertEqual(self.js["naming"]["accommodate"], "The word is accommodate.")

    def test_an_item_needs_every_line_before_it_uses_clips(self):
        # One voice per item: half a set of clips means the device voice throughout,
        # never Stephen for the word and the tablet for the sentence.
        c = self.js["cover"]
        self.assertTrue(c["both"])
        self.assertFalse(c["namingOnly"])
        self.assertTrue(c["noSentence"])
        self.assertFalse(c["missing"])

    def test_lookup_cannot_be_fooled_by_object_prototype_names(self):
        self.assertIsNone(self.js["cover"]["prototypeKey"])


class TestTheRenderer(unittest.TestCase):
    def test_every_word_with_a_sentence_has_two_distinct_lines(self):
        lines = render_audio.utterances()
        self.assertEqual(len(lines), 2 * len(sentences.SENTENCES))
        self.assertEqual(len({t for t, _ in lines}), len(lines))

    def test_clip_names_change_with_anything_that_changes_the_audio(self):
        base = render_audio.clip_name("The word is cat.", "voiceA")
        self.assertEqual(base, render_audio.clip_name("The word is cat.", "voiceA"))
        self.assertNotEqual(base, render_audio.clip_name("The word is cat!", "voiceA"))
        self.assertNotEqual(base, render_audio.clip_name("The word is cat.", "voiceB"))
        self.assertRegex(base, r"^[0-9a-f]{16}\.mp3$")

    def test_creative_stability_is_never_used(self):
        # ElevenLabs: Creative is "prone to hallucinations". A hallucinated word is
        # the worst thing a spelling test can say.
        self.assertGreaterEqual(render_audio.VOICE_SETTINGS["stability"], 0.5)

    def test_no_key_ever_lands_in_the_served_tree(self):
        # The key is read from the environment and nowhere else. Anything under web/
        # is served to every visitor.
        for f in (ROOT / "web").rglob("*"):
            if f.is_file() and f.suffix in {".js", ".json", ".html", ".css"}:
                with self.subTest(file=str(f.relative_to(ROOT))):
                    self.assertNotRegex(f.read_text(encoding="utf-8", errors="ignore"),
                                        r"(?i)xi-api-key|sk_[0-9a-f]{20,}")


class TestTheManifest(unittest.TestCase):
    def test_it_always_exists_and_is_well_formed(self):
        # The service worker precaches it and the app fetches it at boot, so an
        # absent file is a failed install, not "no clips".
        m = manifest()
        self.assertIsInstance(m.get("clips"), dict)
        for text, url in m["clips"].items():
            with self.subTest(text=text):
                self.assertRegex(url, CLIP)

    def test_every_listed_clip_exists_and_is_audio(self):
        for text, url in manifest()["clips"].items():
            f = ROOT / "web" / url
            with self.subTest(text=text):
                self.assertTrue(f.exists(), f"{url} is listed but missing")
                head = f.read_bytes()[:3]
                self.assertTrue(head == b"ID3" or head[:1] == b"\xff",
                                f"{url} does not look like an MP3")

    def test_no_orphan_clips_are_shipped(self):
        listed = {pathlib.Path(u).name for u in manifest()["clips"].values()}
        on_disk = {f.name for f in AUDIO.glob("*.mp3")} if AUDIO.exists() else set()
        self.assertEqual(on_disk - listed, set(),
                         "clips on disk that nothing plays: re-run tools/render_audio.py")


class TestCoverageOnceRendered(unittest.TestCase):
    def setUp(self):
        self.m = manifest()
        if not self.m["clips"]:
            self.skipTest("nothing rendered yet: the device voice is used throughout")

    def test_it_was_rendered_with_the_voice_and_model_the_script_names(self):
        self.assertEqual(self.m["voice_id"], render_audio.VOICE_ID)
        self.assertEqual(self.m["model_id"], render_audio.MODEL_ID)

    def test_every_clip_is_the_requested_format(self):
        # 64 kbps, 44.1 kHz: what render_audio.OUTPUT_FORMAT asks for. A clip that
        # does not parse as frames at all is not audio the page can play.
        for text, url in self.m["clips"].items():
            with self.subTest(text=text):
                self.assertGreater(render_audio.mp3_seconds(ROOT / "web" / url), 0.3)

    def test_no_take_runs_long_or_cuts_short(self):
        # A take far too long for its text is speech the model invented; far too
        # short is a line it cut off. v3, the more expressive model, is the likelier
        # to do either, and neither is visible in a file listing.
        odd = render_audio.pace_outliers(self.m["clips"])
        self.assertEqual(odd, [], "re-render these with --only <word>; if a take "
                         "repeats, respell it in SPOKEN_OVERRIDES: " + repr(odd))

    def test_every_line_has_a_clip(self):
        missing = [t for t, _ in render_audio.utterances() if t not in self.m["clips"]]
        self.assertEqual(missing, [],
                         f"{len(missing)} line(s) would fall back to the device voice. "
                         "Run: python3 tools/render_audio.py")


if __name__ == "__main__":
    unittest.main()
