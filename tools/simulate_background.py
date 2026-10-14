"""
How far does the growing background get in one round of the pattern sort?

    python3 tools/simulate_background.py

Peter said on 6 October 2026 that the ever-more-complex background seemed lost
(docs/11). The code had not changed. The question was what a child who gets six or
seven cards in ten right at the first go actually sees, so this plays ten-card rounds at
a given hit rate under two rules and counts how often an animal is on the page after the
tenth card:

  * the first build: a miss takes back two layers and the first animal is level 6;
  * the rule that replaced it, read from web/js/scene.js so the two cannot drift apart:
    a miss takes back STEP_BACK layers and the first animal is wherever PLAN puts it.

Every card right at the first go adds one layer. Hit rate is the chance of that, card by
card, independent of the one before: a simplification, but the right size of one. The seed
is fixed, so the table in docs/11 is the same every run.
"""
import pathlib
import random
import re

ROOT = pathlib.Path(__file__).resolve().parents[1]
SCENE = ROOT / "web" / "js" / "scene.js"

CARDS = 10
SITTINGS = 40000
SEED = 20261006
FIRST_BUILD = {"step_back": 2, "first_animal": 6}


def scene_rules():
    """STEP_BACK, the first animal's level and MAX, as scene.js says them."""
    text = SCENE.read_text(encoding="utf-8")
    step_back = int(re.search(r"export const STEP_BACK = (\d+)", text).group(1))
    block = re.search(r"export const PLAN = \[\n(.*?)\n\];", text, re.S).group(1)
    levels = [ln for ln in block.splitlines() if ln.strip().startswith(("null", "{"))]
    first_animal = next(i for i, ln in enumerate(levels) if 'kind: "animal"' in ln)
    return {"step_back": step_back, "first_animal": first_animal, "max": len(levels) - 1}


def round_end(rng, hit_rate, step_back, top):
    level = 0
    for _ in range(CARDS):
        if rng.random() < hit_rate:
            level = min(top, level + 1)
        else:
            level = max(0, level - step_back)
    return level


def measure(rng, hit_rate, rules, top):
    ends = [round_end(rng, hit_rate, rules["step_back"], top) for _ in range(SITTINGS)]
    return {
        "mean": sum(ends) / SITTINGS,
        "animal": sum(e >= rules["first_animal"] for e in ends) / SITTINGS,
        "plain": sum(e <= 2 for e in ends) / SITTINGS,
    }


def table(rates=(0.5, 0.6, 0.7, 0.8, 0.9)):
    rng = random.Random(SEED)
    now = scene_rules()
    top = now["max"]
    rows = []
    for rate in rates:
        before = measure(rng, rate, FIRST_BUILD, 14)
        after = measure(rng, rate, now, top)
        rows.append((rate, before, after))
    return rows, now


def main():
    rows, now = table()
    print(f"{SITTINGS} ten-card rounds per row. First build: a miss takes back "
          f"{FIRST_BUILD['step_back']}, first animal at level {FIRST_BUILD['first_animal']}. "
          f"Now: a miss takes back {now['step_back']}, first animal at level {now['first_animal']}.\n")
    print("| Right at the first go, of 10 | First build: animal on the page | "
          "First build: dots or nothing | Now: animal on the page | Now: mean level |")
    print("|---|---|---|---|---|")
    for rate, before, after in rows:
        print(f"| {round(rate * 10)} | {before['animal']:.0%} | {before['plain']:.0%} | "
              f"{after['animal']:.0%} | {after['mean']:.1f} |")


if __name__ == "__main__":
    main()
