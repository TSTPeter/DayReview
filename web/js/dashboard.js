// The grown-up view: every habit metric in the product lives here.
//
// This is where "consistency" and "daily use plotting" belong. Shown to an
// adult they are information; shown to a nine-year-old they are a streak, and
// docs/02 rules that out on two independent grounds (Deci: engagement-
// contingent d = -0.40, worse in children; ICO Children's code standard 13 on
// nudge techniques). Same numbers, different reader, opposite effect.
//
// FORM CHOICES, made before colour, per the dataviz procedure:
//   * The four docs/04 numbers are single headline values -> STAT TILES, not
//     charts. With a few weeks of data a trend line would be drawing noise.
//   * Daily use over time is magnitude-per-day and its gaps are the point ->
//     a CALENDAR HEATMAP. One sequential hue, light to dark. It answers "how
//     often" and "how consistently" with one mark set.
//   * Pattern strength is one series of proportions -> horizontal bars, one
//     hue, no legend needed (a single series is named by its title).
// No two-scale axis anywhere, and no categorical palette, because nothing
// here encodes identity by colour.
//
// The pale end of a sequential ramp is deliberately low-contrast. The skill's
// rule is that this obligates relief: every cell carries a hover tooltip and
// there is a table view, both below.

const RAMP_LIGHT = ["#e4f0ed", "#b9dbd4", "#8ac3b8", "#5aa79a", "#357f74", "#1d5b53"];
const RAMP_DARK  = ["#173c37", "#1f584f", "#2d7a6e", "#46a294", "#74c4b6", "#a9ded4"];
const EMPTY_LIGHT = "#eee7d8";
const EMPTY_DARK  = "#2b2721";

const DAY_MS = 86400000;
const iso = (d) => d.toISOString().slice(0, 10);

function isDark() {
  return document.documentElement.dataset.theme === "dark";
}

/** Attempts -> { 'YYYY-MM-DD': {attempts, correct} } */
export function byDay(attempts) {
  const days = {};
  for (const a of attempts) {
    const d = (a.created_at || "").slice(0, 10);
    if (!d) continue;
    days[d] = days[d] || { attempts: 0, correct: 0 };
    days[d].attempts += 1;
    if (a.correct) days[d].correct += 1;
  }
  return days;
}

/**
 * Consistency, stated so it cannot flatter. Days practised out of days since
 * she started, capped at the window. Not a streak: a missed day reduces it a
 * little and nothing resets to zero, because a reset is the punitive mechanic
 * docs/02 objects to.
 */
export function consistency(days, windowDays = 28, today = new Date()) {
  const start = new Date(today.getTime() - (windowDays - 1) * DAY_MS);
  let practised = 0, available = 0;
  const first = Object.keys(days).sort()[0];
  for (let t = start.getTime(); t <= today.getTime(); t += DAY_MS) {
    const key = iso(new Date(t));
    if (first && key < first) continue;      // before she started does not count against her
    available += 1;
    if (days[key] && days[key].attempts > 0) practised += 1;
  }
  return { practised, available, rate: available ? practised / available : null, windowDays };
}

function scaleFor(max) {
  const ramp = isDark() ? RAMP_DARK : RAMP_LIGHT;
  // Fixed, readable buckets rather than a continuous scale: a parent reads
  // "a lot / a little", not a precise value, and the tooltip carries the number.
  const stops = max <= 6 ? [1, 2, 3, 4, 5, 6]
              : max <= 15 ? [1, 3, 6, 9, 12, 15]
              : [1, 5, 10, 20, 35, Math.max(36, max)];
  return { ramp, stops };
}

function colourFor(n, scale) {
  if (!n) return isDark() ? EMPTY_DARK : EMPTY_LIGHT;
  for (let i = 0; i < scale.stops.length; i++) if (n <= scale.stops[i]) return scale.ramp[i];
  return scale.ramp[scale.ramp.length - 1];
}

/**
 * Calendar heatmap, weeks as columns, weekdays as rows. Rendered as inline
 * SVG so it needs no library and prints.
 */
export function renderCalendar(el, days, { weeks = 12, today = new Date() } = {}) {
  const cell = 15, gap = 2, pad = 22, rowLabel = 26;
  const max = Math.max(1, ...Object.values(days).map((d) => d.attempts));
  const scale = scaleFor(max);

  // Start on the Monday of the earliest visible week.
  const end = new Date(today);
  const startRaw = new Date(end.getTime() - (weeks * 7 - 1) * DAY_MS);
  const offset = (startRaw.getDay() + 6) % 7;            // 0 = Monday
  const start = new Date(startRaw.getTime() - offset * DAY_MS);

  const w = rowLabel + weeks * (cell + gap) + pad;
  const h = pad + 7 * (cell + gap) + 20;
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
  svg.setAttribute("width", "100%");
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", `Practice per day over the last ${weeks} weeks`);

  const ink = getComputedStyle(document.body).getPropertyValue("--ink-2").trim() || "#5d564c";
  ["M", "", "W", "", "F", "", "S"].forEach((label, row) => {
    if (!label) return;
    const t = document.createElementNS(ns, "text");
    t.setAttribute("x", 0);
    t.setAttribute("y", pad + row * (cell + gap) + cell - 3);
    t.setAttribute("font-size", "10");
    t.setAttribute("fill", ink);
    t.textContent = label;
    svg.append(t);
  });

  let monthCursor = "";
  for (let col = 0; col < weeks; col++) {
    for (let row = 0; row < 7; row++) {
      const date = new Date(start.getTime() + (col * 7 + row) * DAY_MS);
      if (date > end) continue;
      const key = iso(date);
      const d = days[key] || { attempts: 0, correct: 0 };
      const r = document.createElementNS(ns, "rect");
      r.setAttribute("x", rowLabel + col * (cell + gap));
      r.setAttribute("y", pad + row * (cell + gap));
      r.setAttribute("width", cell);
      r.setAttribute("height", cell);
      r.setAttribute("rx", 4);                       // 4px rounded data-ends
      r.setAttribute("fill", colourFor(d.attempts, scale));
      r.dataset.date = key;
      r.dataset.attempts = d.attempts;
      r.dataset.correct = d.correct;
      // Relief for the low-contrast pale steps: every cell is hoverable and
      // has a native title for touch-and-hold and for screen readers.
      const title = document.createElementNS(ns, "title");
      title.textContent = d.attempts
        ? `${key}: ${d.attempts} attempts, ${d.correct} correct`
        : `${key}: nothing practised`;
      r.append(title);
      svg.append(r);

      const month = date.toLocaleDateString("en-GB", { month: "short" });
      if (row === 0 && month !== monthCursor) {
        monthCursor = month;
        const t = document.createElementNS(ns, "text");
        t.setAttribute("x", rowLabel + col * (cell + gap));
        t.setAttribute("y", pad - 8);
        t.setAttribute("font-size", "10");
        t.setAttribute("fill", ink);
        t.textContent = month;
        svg.append(t);
      }
    }
  }
  el.replaceChildren(svg);
  return { max, scale };
}

/** Legend for the sequential scale. Always present. */
export function renderLegend(el, scale) {
  el.replaceChildren();
  const wrap = document.createElement("div");
  wrap.className = "row small muted";
  wrap.style.gap = ".35rem";
  wrap.append(Object.assign(document.createElement("span"), { textContent: "fewer" }));
  for (const c of scale.ramp) {
    const s = document.createElement("i");
    s.style.cssText = `display:inline-block;width:15px;height:15px;border-radius:4px;background:${c}`;
    wrap.append(s);
  }
  wrap.append(Object.assign(document.createElement("span"), { textContent: "more attempts" }));
  el.append(wrap);
}

/** The table view the low-contrast steps oblige. */
export function renderTable(el, days) {
  const rows = Object.entries(days).sort((a, b) => (a[0] < b[0] ? 1 : -1)).slice(0, 30);
  el.replaceChildren();
  if (!rows.length) {
    el.append(Object.assign(document.createElement("p"),
      { className: "muted small", textContent: "Nothing practised yet." }));
    return;
  }
  const t = document.createElement("table");
  t.innerHTML = "<thead><tr><th>Day</th><th>Attempts</th><th>Correct</th></tr></thead>";
  const tb = document.createElement("tbody");
  for (const [date, d] of rows) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${date}</td><td>${d.attempts}</td><td>${d.correct}</td>`;
    tb.append(tr);
  }
  t.append(tb);
  el.append(t);
}

/** Pattern strength: one series, one hue, weakest first. */
export function renderPatterns(el, patternStrength) {
  const rows = Object.entries(patternStrength).sort((a, b) => a[1] - b[1]);
  el.replaceChildren();
  const mark = isDark() ? "#6cc0b1" : "#2f7d72";
  for (const [key, v] of rows) {
    const tr = document.createElement("tr");
    const name = document.createElement("td");
    name.textContent = key.replace(/-/g, " ");
    const cell = document.createElement("td");
    const bar = document.createElement("div");
    bar.className = "bar-cell";
    const i = document.createElement("i");
    i.style.cssText = `width:${Math.max(3, v * 140)}px;background:${mark}`;
    const label = document.createElement("span");
    label.className = "small";
    label.textContent = `${Math.round(v * 100)}%`;   // selective direct label
    bar.append(i, label);
    cell.append(bar);
    tr.append(name, cell);
    el.append(tr);
  }
}
