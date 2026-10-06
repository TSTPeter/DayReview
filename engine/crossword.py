"""
The mini crosswords. docs/15-games.md.

A puzzle is a small crossword built from words on the term's lists. Each answer is a word
the school has set, the clue is its meaning, and the words cross one another, so a letter
she has already put in is a start on the next word. She types a whole answer, never into a
cell, so no wrong letter is ever left in the grid: a right answer fills its cells and a
wrong one is marked against the word and then shown.

The puzzles are built here, offline, and exported to web/data/games.json, so a test can hold
every one of them to these rules:

  * Every answer is a word on the term's lists up to that week, with no hyphen. A hyphen
    cannot be a letter in a cell, and the hyphen weeks are about the hyphen, which a
    crossword would have to give away.
  * Every run of two or more letters, across or down, is exactly one of the answers.
    Nothing is spelt by accident, so nothing in the grid is anything but a correct spelling.
  * Every answer crosses another, and the whole grid is one piece.
  * No clue gives its answer away (the meanings are the games' own, held to that already).
  * The grid is at most 11 squares wide, so a cell stays big enough to see on a phone.

This week's words come first, because the test is on Friday; the rest of each puzzle is
earlier weeks' words, so a puzzle is also spaced retrieval of the term so far.

Deterministic: the same week gives the same puzzles on every machine. The search uses a
seeded generator and a fixed number of attempts, never a clock.
"""
import random
import zlib

ACROSS, DOWN = "a", "d"
MAX_COLS = 11
MAX_ROWS = 13
MIN_WORDS = 5
MAX_WORDS = 7
MIN_LEN = 4
MAX_LEN = 11
PUZZLES_PER_WEEK = 3
ATTEMPTS = 300


def _seed(*parts):
    return zlib.crc32("|".join(map(str, parts)).encode())


def usable(word, meanings):
    """A word can be an answer if it is plain letters, a sensible length, and has a clue."""
    return word.isalpha() and word.islower() and MIN_LEN <= len(word) <= MAX_LEN and word in meanings


class Grid:
    """A sparse crossword under construction. Coordinates may go negative; render() crops."""

    def __init__(self):
        self.cells = {}        # (row, col) -> letter
        self.dirs = {}         # (row, col) -> the directions of the words through it
        self.placed = []       # (word, row, col, direction)
        self.crossings = 0

    @staticmethod
    def step(direction):
        return (0, 1) if direction == ACROSS else (1, 0)

    def box(self, extra=None):
        """Height and width of everything placed, and of one more word if given."""
        spots = list(self.cells)
        if extra:
            word, r, c, d = extra
            dr, dc = self.step(d)
            spots += [(r + i * dr, c + i * dc) for i in range(len(word))]
        rows = [r for r, _ in spots]
        cols = [c for _, c in spots]
        return max(rows) - min(rows) + 1, max(cols) - min(cols) + 1

    def fits(self, word, r, c, d):
        """How many crossings the word would make, or None if it cannot go there."""
        dr, dc = self.step(d)
        if (r - dr, c - dc) in self.cells or (r + len(word) * dr, c + len(word) * dc) in self.cells:
            return None
        crossings = 0
        for i, ch in enumerate(word):
            cell = (r + i * dr, c + i * dc)
            if cell in self.cells:
                # A crossing: the same letter, and the other way across from what is there.
                if self.cells[cell] != ch or d in self.dirs[cell]:
                    return None
                crossings += 1
            else:
                # A new letter must not sit beside another word's letter, or it would spell
                # something that is not an answer.
                side = [(cell[0] + dc, cell[1] + dr), (cell[0] - dc, cell[1] - dr)]
                if any(s in self.cells for s in side):
                    return None
        if self.placed and not crossings:
            return None
        rows, cols = self.box((word, r, c, d))
        if rows > MAX_ROWS or cols > MAX_COLS:
            return None
        return crossings

    def put(self, word, r, c, d, crossings):
        dr, dc = self.step(d)
        for i, ch in enumerate(word):
            cell = (r + i * dr, c + i * dc)
            self.cells[cell] = ch
            self.dirs.setdefault(cell, set()).add(d)
        self.placed.append((word, r, c, d))
        self.crossings += crossings

    def options(self, word):
        """Every place the word could go, as (crossings, row, col, direction)."""
        found = set()
        for (r, c), letter in self.cells.items():
            for i, ch in enumerate(word):
                if ch != letter:
                    continue
                for d in (ACROSS, DOWN):
                    if d in self.dirs[(r, c)]:
                        continue
                    dr, dc = self.step(d)
                    found.add((r - i * dr, c - i * dc, d))
        out = []
        for r, c, d in sorted(found):
            n = self.fits(word, r, c, d)
            if n:
                out.append((n, r, c, d))
        return out


def build(words, rnd, limit=MAX_WORDS):
    """Place as many of the words as will go, longest first, each where it crosses most."""
    order = sorted(words, key=lambda w: -len(w) + 2.5 * rnd.random())
    grid = Grid()
    first = order[0]
    grid.put(first, 0, 0, ACROSS, 0)
    waiting = order[1:]
    for _ in range(2):                       # a second pass: new letters open new places
        left = []
        for word in waiting:
            if len(grid.placed) >= limit:
                left.append(word)
                continue
            options = grid.options(word)
            if not options:
                left.append(word)
                continue
            # Most crossings first, then the smallest grid, then luck.
            def cost(o):
                n, r, c, d = o
                rows, cols = grid.box((word, r, c, d))
                return (-n, rows * cols, rnd.random())
            n, r, c, d = min(options, key=cost)
            grid.put(word, r, c, d, n)
        waiting = left
    return grid


def score(grid, must, now):
    """More answers, this puzzle's own words, this week's other words, crossings, then small."""
    rows, cols = grid.box()
    placed = [w for w, *_ in grid.placed]
    return (100 * len(placed) + 60 * sum(w in must for w in placed)
            + 25 * sum(w in now and w not in must for w in placed)
            + 12 * grid.crossings - rows * cols // 2)


def render(grid, meanings):
    """The puzzle as the browser gets it: the letters, and the answers with their clues."""
    rows_all = [r for r, _ in grid.cells]
    cols_all = [c for _, c in grid.cells]
    top, left = min(rows_all), min(cols_all)
    rows, cols = grid.box()
    letters = [["."] * cols for _ in range(rows)]
    for (r, c), ch in grid.cells.items():
        letters[r - top][c - left] = ch
    starts = {(r - top, c - left, d): w for w, r, c, d in grid.placed}
    entries, number = [], 0
    for r in range(rows):
        for c in range(cols):
            if letters[r][c] == ".":
                continue
            across = (r, c, ACROSS) in starts
            down = (r, c, DOWN) in starts
            if not (across or down):
                continue
            number += 1
            for d, there in ((ACROSS, across), (DOWN, down)):
                if there:
                    word = starts[(r, c, d)]
                    entries.append({"n": number, "dir": d, "row": r, "col": c, "word": word,
                                    "clue": meanings[word]})
    return {"rows": rows, "cols": cols, "grid": ["".join(row) for row in letters],
            "entries": entries}


def problems(puzzle):
    """Everything wrong with a puzzle, in words. Empty means it is sound."""
    out = []
    rows, cols, grid = puzzle["rows"], puzzle["cols"], puzzle["grid"]
    if len(grid) != rows or any(len(row) != cols for row in grid):
        return ["the grid is not rows by cols"]
    if cols > MAX_COLS or rows > MAX_ROWS:
        out.append(f"{cols} by {rows} is too big")
    entries = puzzle["entries"]
    if not MIN_WORDS <= len(entries) <= MAX_WORDS:
        out.append(f"{len(entries)} answers")
    # Every run of two or more letters is exactly one answer, and every answer is a run.
    runs = {}
    for r in range(rows):
        for c in range(cols):
            if grid[r][c] == ".":
                continue
            if (c == 0 or grid[r][c - 1] == ".") and c + 1 < cols and grid[r][c + 1] != ".":
                end = c
                while end + 1 < cols and grid[r][end + 1] != ".":
                    end += 1
                runs[(r, c, ACROSS)] = grid[r][c:end + 1]
            if (r == 0 or grid[r - 1][c] == ".") and r + 1 < rows and grid[r + 1][c] != ".":
                end = r
                while end + 1 < rows and grid[end + 1][c] != ".":
                    end += 1
                runs[(r, c, DOWN)] = "".join(grid[i][c] for i in range(r, end + 1))
    given = {(e["row"], e["col"], e["dir"]): e["word"] for e in entries}
    if runs != given:
        out.append(f"the runs of letters are not the answers: {sorted(set(runs.items()) ^ set(given.items()))}")
    # Every answer crosses another, and the grid is one piece.
    cells = {(r, c) for r in range(rows) for c in range(cols) if grid[r][c] != "."}
    covers = {}
    for e in entries:
        dr, dc = (0, 1) if e["dir"] == ACROSS else (1, 0)
        for i in range(len(e["word"])):
            covers.setdefault((e["row"] + i * dr, e["col"] + i * dc), []).append(e["word"])
    if set(covers) != cells:
        out.append("a letter in the grid belongs to no answer")
    for e in entries:
        dr, dc = (0, 1) if e["dir"] == ACROSS else (1, 0)
        if not any(len(covers[(e["row"] + i * dr, e["col"] + i * dc)]) > 1 for i in range(len(e["word"]))):
            out.append(f"{e['word']} crosses nothing")
    seen, todo = set(), [next(iter(cells))] if cells else []
    while todo:
        r, c = todo.pop()
        if (r, c) in seen:
            continue
        seen.add((r, c))
        todo += [x for x in ((r + 1, c), (r - 1, c), (r, c + 1), (r, c - 1)) if x in cells]
    if seen != cells:
        out.append("the grid is in more than one piece")
    # Numbers run in reading order and the clues are given once each.
    order = sorted(((e["row"], e["col"]) for e in entries))
    numbers = {}
    for e in entries:
        numbers.setdefault((e["row"], e["col"]), e["n"])
        if numbers[(e["row"], e["col"])] != e["n"]:
            out.append("two numbers on one square")
    if [numbers[k] for k in sorted(set(order))] != list(range(1, len(set(order)) + 1)):
        out.append("the numbers do not run 1, 2, 3 in reading order")
    return out


def week_puzzles(week_id, this_week, earlier, meanings, count=PUZZLES_PER_WEEK):
    """The week's puzzles: this week's words shared among them, earlier words to fill."""
    now = [w for w in this_week if usable(w, meanings)]
    before = [w for w in earlier if usable(w, meanings) and w not in now]
    # Share this week's words round the puzzles, so each gets a few and none is left out.
    groups = [now[k::count] for k in range(count)]
    puzzles = []
    for k in range(count):
        must = groups[k]
        rnd = random.Random(_seed("crossword", week_id, k))
        best, best_score = None, None
        for _ in range(ATTEMPTS):
            # A few of this week's other words and a few earlier ones, to fill the grid.
            others = [w for w in now if w not in must]
            rnd.shuffle(others)
            older = list(before)
            rnd.shuffle(older)
            words = must + others[:rnd.randint(1, 3)] + older[:rnd.randint(2, 4)]
            if len(words) < 2:
                continue
            grid = build(words, rnd)
            if len(grid.placed) < MIN_WORDS:
                continue
            s = score(grid, set(must), set(now))
            if best_score is None or s > best_score:
                best, best_score = grid, s
        if best is None:
            raise ValueError(f"no crossword could be built for {week_id}, puzzle {k + 1}")
        puzzles.append(render(best, meanings))
    return puzzles
