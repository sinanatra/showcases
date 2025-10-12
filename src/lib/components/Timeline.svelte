<script>
  import { filtered } from "$lib/stores";

  const lineHeight = 16;
  const fontSize = Math.round(lineHeight * 0.9);
  const timelineWidth = 2000;
  const yOffset = 40;

  function parseDate(dStr, tStr = "00:00") {
    if (!dStr) return null;
    const [d, m, y] = String(dStr).split(".");
    const [hh = "00", mm = "00"] = String(tStr || "00:00").split(":");
    const dt = new Date(+y, (+m || 1) - 1, +d, +hh, +mm);
    return isNaN(+dt) ? null : dt;
  }

  const ABBREVS = ["Nr", "Dr", "z.B", "etc", "u.a"];
  const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const isAbbrevBoundary = (txt, i) =>
    ABBREVS.some((ab) => txt.slice(i - ab.length, i) === ab);

  function findPrevBoundary(text, pos) {
    let cand = Math.max(
      text.lastIndexOf(".", pos - 1),
      text.lastIndexOf("!", pos - 1),
      text.lastIndexOf("?", pos - 1)
    );
    while (cand > -1 && text[cand] === "." && isAbbrevBoundary(text, cand)) {
      cand = Math.max(
        text.lastIndexOf(".", cand - 1),
        text.lastIndexOf("!", cand - 1),
        text.lastIndexOf("?", cand - 1)
      );
    }
    return cand;
  }
  function findNextBoundary(text, pos) {
    let dots = [
      text.indexOf(".", pos),
      text.indexOf("!", pos),
      text.indexOf("?", pos),
    ].filter((i) => i >= 0);
    let cand = dots.length ? Math.min(...dots) : -1;
    while (cand > -1 && text[cand] === "." && isAbbrevBoundary(text, cand)) {
      dots = [
        text.indexOf(".", cand + 1),
        text.indexOf("!", cand + 1),
        text.indexOf("?", cand + 1),
      ].filter((i) => i >= 0);
      cand = dots.length ? Math.min(...dots) : -1;
    }
    return cand;
  }
  function extractSnippet(text = "", terms = []) {
    if (!terms.length) {
      const snippet = text.slice(0, 200);
      return { before: snippet, match: "", after: "" };
    }
    let match = null,
      term = "";
    for (const t of terms) {
      const m = new RegExp(`\\b${escapeRegExp(String(t))}\\b`, "i").exec(text);
      if (m) {
        match = m;
        term = m[0];
        break;
      }
    }
    if (!match) {
      const snippet = text.slice(0, 200);
      return { before: snippet, match: "", after: "" };
    }
    const idx = match.index,
      len = term.length;
    const start = findPrevBoundary(text, idx);
    const endRaw = findNextBoundary(text, idx + len);
    const end = endRaw > -1 ? endRaw : text.length - 1;
    const snippet = text.slice(start + 1, end + 1);
    const rel = idx - (start + 1);
    return {
      before: snippet.slice(0, rel),
      match: snippet.slice(rel, rel + len),
      after: snippet.slice(rel + len),
    };
  }

  const MS = {
    day: 24 * 60 * 60 * 1000,
    week: 7 * 24 * 60 * 60 * 1000,
    month: 30 * 24 * 60 * 60 * 1000,
    quarter: 91 * 24 * 60 * 60 * 1000,
    year: 365 * 24 * 60 * 60 * 1000,
  };

  function chooseStep(start, end, maxTicks = 8) {
    const span = +end - +start;
    if (span <= 45 * MS.day) return { unit: "day", step: 1 };
    if (span <= 6 * MS.month) return { unit: "week", step: 1 };
    if (span <= 18 * MS.month) return { unit: "month", step: 1 };
    if (span <= 4 * MS.year) return { unit: "quarter", step: 1 };

    const years = span / MS.year;
    const approx = Math.ceil(years / maxTicks);
    const nice = [1, 2, 5, 10].find((n) => n >= approx) || approx;
    return { unit: "year", step: nice };
  }

  function floorToUnit(d, unit) {
    const x = new Date(d);
    if (unit === "day") x.setHours(0, 0, 0, 0);
    if (unit === "week") {
      const day = x.getDay();
      const diff = (day + 6) % 7;
      x.setDate(x.getDate() - diff);
      x.setHours(0, 0, 0, 0);
    }
    if (unit === "month") {
      x.setDate(1);
      x.setHours(0, 0, 0, 0);
    }
    if (unit === "quarter") {
      const qStart = Math.floor(x.getMonth() / 3) * 3;
      x.setMonth(qStart, 1);
      x.setHours(0, 0, 0, 0);
    }
    if (unit === "year") {
      x.setMonth(0, 1);
      x.setHours(0, 0, 0, 0);
    }
    return x;
  }

  function addUnit(d, unit, step) {
    const x = new Date(d);
    if (unit === "day") x.setDate(x.getDate() + step);
    if (unit === "week") x.setDate(x.getDate() + 7 * step);
    if (unit === "month") x.setMonth(x.getMonth() + step);
    if (unit === "quarter") x.setMonth(x.getMonth() + 3 * step);
    if (unit === "year") x.setFullYear(x.getFullYear() + step);
    return x;
  }

  function formatTick(d, unit) {
    const locale = "de-DE";
    if (unit === "year")
      return d.toLocaleDateString(locale, { year: "numeric" });
    if (unit === "quarter") {
      const q = Math.floor(d.getMonth() / 3) + 1;
      return `Q${q} ${d.getFullYear()}`;
    }
    if (unit === "month")
      return d.toLocaleDateString(locale, { month: "long", year: "numeric" });
    return d.toLocaleDateString(locale, {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }

  function makeTicks(start, end, maxTicks = 8) {
    if (!start || !end || +end <= +start) return [];
    const { unit, step } = chooseStep(start, end, maxTicks);
    let t = floorToUnit(start, unit);
    const out = [];
    while (+t <= +end) {
      out.push({ d: new Date(t), unit });
      t = addUnit(t, unit, step);
    }
    return out;
  }

  const fmtDate = (d) =>
    d.toLocaleDateString("de-DE", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

  let rows = [];
  let start = null,
    end = null;
  let ticks = [];
  let timelineHeight = 0;

  $: {
    const src = Array.isArray($filtered) ? $filtered : [];
    const mapped = src
      .map((a) => {
        const t0 =
          Array.isArray(a.ExtractedTime) && a.ExtractedTime[0]
            ? a.ExtractedTime[0]
            : "00:00";
        const d = parseDate(a.ExtractedDate || a.Date, t0);
        if (!d) return null;
        const { before, match, after } = extractSnippet(
          a.Text || "",
          a.KeywordExtracted || a.KeywordMatch || []
        );
        return { date: d, before, match, after, url: a.URL };
      })
      .filter(Boolean)
      .sort((a, b) => b.date - a.date);

    rows = mapped;
    const dates = mapped.map((r) => r.date);
    start = dates.length ? new Date(Math.min(...dates)) : null;
    end = dates.length ? new Date(Math.max(...dates)) : null;

    ticks = makeTicks(start, end, 8);
    timelineHeight = yOffset + rows.length * lineHeight + 40;
  }

  function normPos(date) {
    if (!start || !end || +end - +start === 0) return 0;
    return ((+end - +date) / (+end - +start)) * timelineWidth;
  }
</script>

<section>
  {#if rows.length === 0}
    <p></p>
  {:else}
    <div class="timeline-container">
      <svg width={timelineWidth + 250} height={timelineHeight}>
        <!-- ticks dinamici -->
        <g class="dates">
          {#each ticks as t}
            <text
              class="date"
              x={normPos(t.d)}
              y={yOffset - lineHeight / 2}
              font-size={fontSize}
              dominant-baseline="middle"
              text-anchor="start">{formatTick(t.d, t.unit)}</text
            >
            <line
              x1={normPos(t.d)}
              y1={yOffset - 0.5 * lineHeight}
              x2={normPos(t.d)}
              y2={timelineHeight}
            />
          {/each}
        </g>

        <!-- righe -->
        <g>
          {#each rows as item, i}
            <a href={item.url} target="_blank" rel="noopener">
              <text
                x={normPos(item.date)}
                y={yOffset + i * lineHeight + lineHeight / 2}
                font-size={fontSize}
                dominant-baseline="middle"
              >
                <tspan class="text">{item.before}</tspan>
                <tspan class="highlight">{item.match}</tspan>
                <tspan class="text">{item.after}</tspan>
                <tspan class="date" dx="2"> {fmtDate(item.date)} ↗</tspan>
              </text>
            </a>
          {/each}
        </g>
      </svg>
    </div>
  {/if}
</section>

<style>
  section {
    display: flex;
    flex-direction: column;
    padding: 10px;
    color: white;
    background-color: black;
    min-height: 100vh;
    text-rendering: geometricPrecision;
  }

  .timeline-container {
    overflow: auto;
    flex-grow: 1;
  }

  .timeline-container text,
  .timeline-container tspan {
    font-size: 13px;
  }

  a:hover {
    fill: var(--color-1);
    text-decoration: underline;
  }

  .text {
    font-style: italic;
  }
  .highlight {
    font-weight: 400;
    fill: var(--color-1);
  }

  .date,
  a {
    font-size: 0.8em;
    fill: gainsboro;
  }
  .date {
    fill: #444;
  }

  line {
    stroke: #444;
    stroke-dasharray: 4 4;
  }
</style>
