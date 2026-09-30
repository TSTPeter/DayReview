"""
The hidden-words blocks. docs/15-games.md.

A block is a small grid of letters that four or five of a week's words fill
exactly. Each word is a path through touching letters (across, down or
diagonal), every letter belongs to one word, and there is nothing else in the
block. So every letter on screen is part of a correct spelling, and she finds a
word by spelling it, one touching letter after another.

The blocks are built here, offline, and exported to web/data/games.json, so a
test can hold every one of them to these rules:

  * The words fill the block exactly, and no two steps of the generator's own
    paths cross on a diagonal, where it would be hard to see which letter went
    with which.
  * No hidden word is the start of another hidden word: the game would find
    the short one before she had finished the long one.
  * No other word on the week's list can be traced anywhere in the block.
    Tracing 'relevant' and being told it is not one of the hidden words would be
    confusing, and unfair.
  * No rude word reads in a straight line, in any of the eight directions. This
    is a screen, the kind a published word search gets by eye; a bending path
    is not screened, because nobody reads a bend by accident.

A word can often be traced along more than one route. Any route she finds is
accepted as long as the other words can still fill what is left, so the export
carries every route of every word and every way the routes tile the block. The
game checks her route against that list and never has to solve anything.

Deterministic: the same week gives the same blocks on every machine, because
the search runs on a step budget, never a clock, and every seed is a checksum
of the week and the block number.
"""
import codecs
import random
import zlib

N8 = [(-1, -1), (-1, 0), (-1, 1), (0, -1), (0, 1), (1, -1), (1, 0), (1, 1)]

# rows x columns for each number of letters: never taller than wide, at most
# eight a side, so a letter stays a comfortable size to tap on a tablet.
SHAPES = {30: (5, 6), 35: (5, 7), 36: (6, 6), 40: (5, 8), 42: (6, 7), 48: (6, 8),
          49: (7, 7), 56: (7, 8), 64: (8, 8)}

BLOCKS_PER_WEEK = 6
MAX_ROUTES = 12        # a word traceable more ways than this is too ambiguous to be fun
MAX_TILINGS = 60
STEP_BUDGET = 40000    # grow() calls per attempt
ATTEMPTS = 40          # seeds tried per word set
KEEP = 12              # good blocks compared per word set before choosing one

# The straight-line screen, ROT13 so the source does not spell them out.
_SCREEN = ("nff gvg gvgf snt phz ohz abo frk tvg shpx fuvg cvff phag pbpx qvpx gjng "
           "jnax nefr fyhg penc cbea qnza xabo gheq obbo ceng fcnm cnxv pbba encr "
           "nany nahf qlxr ubzb funt fynt ovgpu juber cevpx onfgneq obyybpxf gbffre "
           "ergneq avttre avttn cravf intvan jnaxre zvatr chffl obare ohttre")
SCREENED = tuple(codecs.decode(w, "rot13") for w in _SCREEN.split())


def _seed(*parts):
    return zlib.crc32("|".join(map(str, parts)).encode())


class _OutOfSteps(Exception):
    pass


def tile(words, rows, cols, rnd, budget=STEP_BUDGET):
    """Lay the words into a rows x cols block as bending paths that fill it.

    Returns (letters, paths): letters row by row, and each word's path as a list of
    cell indices. None if the budget runs out first.
    """
    if sum(map(len, words)) != rows * cols:
        raise ValueError("the words must fill the block exactly")
    letter = {}
    links = set()          # frozenset({a, b}) for every diagonal step taken
    steps = [0]
    inside = lambda y, x: 0 <= y < rows and 0 <= x < cols

    def nbrs(p):
        y, x = p
        return [(y + dy, x + dx) for dy, dx in N8 if inside(y + dy, x + dx)]

    def free_degree(p):
        return sum(1 for q in nbrs(p) if q not in letter)

    def crosses(p, q):
        if p[0] == q[0] or p[1] == q[1]:
            return False
        return frozenset({(p[0], q[1]), (q[0], p[1])}) in links

    def fillable(rest):
        # Every pocket of empty cells must be exactly fillable by some of the
        # words still to place. Necessary, not sufficient, and it prunes most of
        # the search.
        sums = {0}
        for w in rest:
            sums |= {s + len(w) for s in sums}
        seen = set()
        for y in range(rows):
            for x in range(cols):
                if (y, x) in letter or (y, x) in seen:
                    continue
                stack, size = [(y, x)], 0
                seen.add((y, x))
                while stack:
                    c = stack.pop()
                    size += 1
                    for q in nbrs(c):
                        if q not in letter and q not in seen:
                            seen.add(q)
                            stack.append(q)
                if size not in sums:
                    return False
        return True

    order = sorted(words, key=len, reverse=True)      # long words first: they need room
    paths = {}

    def place(i):
        if i == len(order):
            return True
        empties = [(y, x) for y in range(rows) for x in range(cols) if (y, x) not in letter]
        rnd.shuffle(empties)
        empties.sort(key=free_degree)                 # corners and edges first
        for start in empties[:6]:
            path = [start]
            if grow(order[i], path, i):
                return True
        return False

    def grow(w, path, i):
        steps[0] += 1
        if steps[0] > budget:
            raise _OutOfSteps
        p = path[-1]
        letter[p] = w[len(path) - 1]
        if len(path) == len(w):
            paths[i] = list(path)
            if fillable(order[i + 1:]) and place(i + 1):
                return True
            paths.pop(i, None)
        else:
            nxt = [q for q in nbrs(p) if q not in letter and not crosses(p, q)]
            rnd.shuffle(nxt)
            nxt.sort(key=free_degree)                 # Warnsdorff: tightest first
            for q in nxt:
                diagonal = p[0] != q[0] and p[1] != q[1]
                if diagonal:
                    links.add(frozenset({p, q}))
                path.append(q)
                if grow(w, path, i):
                    return True
                path.pop()
                if diagonal:
                    links.discard(frozenset({p, q}))
        del letter[p]
        return False

    try:
        if not place(0):
            return None
    except _OutOfSteps:
        return None
    grid = "".join(letter[(y, x)] for y in range(rows) for x in range(cols))
    by_word = {w: [y * cols + x for y, x in paths[i]] for i, w in enumerate(order)}
    return grid, [by_word[w] for w in words]


def routes(grid, rows, cols, word, cap=MAX_ROUTES + 1):
    """Every way to trace the word through touching cells, each cell once."""
    out = []

    def go(path):
        if len(out) >= cap:
            return
        if len(path) == len(word):
            out.append(list(path))
            return
        y, x = divmod(path[-1], cols)
        for dy, dx in N8:
            ny, nx = y + dy, x + dx
            if 0 <= ny < rows and 0 <= nx < cols:
                q = ny * cols + nx
                if q not in path and grid[q] == word[len(path)]:
                    path.append(q)
                    go(path)
                    path.pop()

    for c, ch in enumerate(grid):
        if ch == word[0]:
            go([c])
    return out


def tilings(word_routes, cells, cap=MAX_TILINGS + 1):
    """Every choice of one route per word that uses each cell exactly once."""
    masks = [[sum(1 << c for c in r) for r in rs] for rs in word_routes]
    order = sorted(range(len(masks)), key=lambda i: len(masks[i]))
    full = (1 << cells) - 1
    out = []
    pick = [0] * len(masks)

    def go(k, used):
        if len(out) >= cap:
            return
        if k == len(order):
            if used == full:
                out.append(list(pick))
            return
        i = order[k]
        for j, m in enumerate(masks[i]):
            if not m & used:
                pick[i] = j
                go(k + 1, used | m)

    go(0, 0)
    return out


def straight_lines(grid, rows, cols):
    """Every row, column and diagonal, read both ways."""
    lines = []
    for y in range(rows):
        lines.append(grid[y * cols:(y + 1) * cols])
    for x in range(cols):
        lines.append(grid[x::cols])
    for d in range(-(rows - 1), cols):
        lines.append("".join(grid[y * cols + y + d] for y in range(rows) if 0 <= y + d < cols))
        lines.append("".join(grid[y * cols + (cols - 1 - y - d)] for y in range(rows)
                             if 0 <= cols - 1 - y - d < cols))
    return lines + [line[::-1] for line in lines]


def screened(grid, rows, cols):
    """The first screened word that reads in a straight line, or None."""
    for line in straight_lines(grid, rows, cols):
        for w in SCREENED:
            if w in line:
                return w
    return None


def check(block, week_words):
    """The reasons a block breaks the rules above; empty when it keeps them."""
    rows, cols, grid, words = block["rows"], block["cols"], block["letters"], block["words"]
    problems = []
    if len(grid) != rows * cols or sum(map(len, words)) != rows * cols:
        problems.append("the words do not fill the block exactly")
    for a in words:
        for b in words:
            if a != b and b.startswith(a):
                problems.append(f"{a} is the start of {b}")
    for w in week_words:
        if w not in words and routes(grid, rows, cols, w, cap=1):
            problems.append(f"{w} is on the list and can be traced, but is not hidden")
    rude = screened(grid, rows, cols)
    if rude:
        problems.append("a screened word reads in a straight line")
    for w, rs in zip(words, block["routes"]):
        if not rs or len(rs) > MAX_ROUTES:
            problems.append(f"{w} has {len(rs)} routes")
        for r in rs:
            if "".join(grid[c] for c in r) != w:
                problems.append(f"a route for {w} does not spell it")
    if not block["tilings"] or len(block["tilings"]) > MAX_TILINGS:
        problems.append(f"{len(block['tilings'])} tilings")
    for t in block["tilings"]:
        cells = [c for w, j in enumerate(t) for c in block["routes"][w][j]]
        if sorted(cells) != list(range(rows * cols)):
            problems.append("a tiling does not use every cell exactly once")
            break
    return problems


def make_block(words, week_words, seed):
    """The best block for these words, or None if none keeps the rules."""
    rows, cols = SHAPES[sum(map(len, words))]
    found = []
    for attempt in range(ATTEMPTS):
        rnd = random.Random(_seed(seed, attempt))
        laid = tile(words, rows, cols, rnd)
        if not laid:
            continue
        grid, own = laid
        rs = [routes(grid, rows, cols, w) for w in words]
        if any(len(r) > MAX_ROUTES for r in rs):
            continue
        # The generator's own tiling goes first: the game's hints follow it.
        rs = [[p] + [r for r in word_rs if r != p] for p, word_rs in zip(own, rs)]
        ts = tilings(rs, rows * cols)
        if len(ts) > MAX_TILINGS:
            continue
        own_pick = [0] * len(words)
        ts = [own_pick] + [t for t in ts if t != own_pick]
        block = {"rows": rows, "cols": cols, "letters": grid, "words": list(words),
                 "routes": rs, "tilings": ts}
        if check(block, week_words):
            continue
        # A route that is in no tiling spells the word but would leave the block
        # unfinishable. The game still accepts it, and moves the word's colour to
        # the nearest route that fits (games.js huntTrace), but fewer is better.
        in_tiling = {(w, t[w]) for t in ts for w in range(len(words))}
        orphans = sum(1 for w, r in enumerate(rs) for j in range(len(r)) if (w, j) not in in_tiling)
        found.append(((orphans, sum(map(len, rs)), len(ts), attempt), block))
        if len(found) >= KEEP:
            break
    return min(found, key=lambda f: f[0])[1] if found else None


def _candidate_sets(words, uses, rnd, size):
    """Word sets of the given size that fill a shape, least-used words first."""
    pool = sorted(words, key=lambda w: (uses[w], rnd.random()))[:max(size + 5, 10)]
    out = []

    def go(start, chosen):
        if len(chosen) == size:
            if sum(map(len, chosen)) in SHAPES and not any(
                    a != b and b.startswith(a) for a in chosen for b in chosen):
                out.append(list(chosen))
            return
        for i in range(start, len(pool)):
            chosen.append(pool[i])
            go(i + 1, chosen)
            chosen.pop()

    go(0, [])
    # Most of the least-used words first; ties keep the pool's order.
    rank = {w: i for i, w in enumerate(pool)}
    out.sort(key=lambda s: (sum(uses[w] for w in s), sum(rank[w] for w in s)))
    return out


def week_blocks(week_id, week_words, count=BLOCKS_PER_WEEK):
    """The week's blocks: five words where they fit a shape, four where not."""
    words = list(dict.fromkeys(week_words))
    uses = {w: 0 for w in words}
    blocks = []
    for n in range(count):
        rnd = random.Random(_seed(week_id, "sets", n))
        block = None
        for size in (5, 4):
            for chosen in _candidate_sets(words, uses, rnd, size)[:20]:
                order = list(chosen)
                rnd.shuffle(order)
                block = make_block(order, words, _seed(week_id, n, *order))
                if block:
                    break
            if block:
                break
        if not block:
            raise RuntimeError(f"no block could be built for {week_id}, number {n + 1}")
        for w in block["words"]:
            uses[w] += 1
        blocks.append(block)
    return blocks
