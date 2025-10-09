<script>
  import { filtered } from "$lib/stores";

  const lineHeight = 16;
  const fontSize = Math.round(lineHeight * 0.9);
  const timelineWidth = 2000;
  const yOffset = 40;
  const tickEvery = 180;

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

  const fmtDate = (d) =>
    d.toLocaleDateString("de-DE", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

  let rows = [];
  let uniqueDates = [];
  let start = null,
    end = null;
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
    const dateMsAsc = Array.from(new Set(mapped.map((r) => +r.date))).sort(
      (a, b) => a - b
    );
    uniqueDates = dateMsAsc.map((ms) => new Date(ms));
    start = uniqueDates[0] || null;
    end = uniqueDates[uniqueDates.length - 1] || null;

    timelineHeight = yOffset + rows.length * lineHeight + 40;
  }

  function normPos(date) {
    if (!start || !end || +end - +start === 0) return 0;
    return ((+end - +date) / (+end - +start)) * timelineWidth;
  }
</script>

<section>
  {#if rows.length === 0}
    <p>No results for the current filters.</p>
  {:else}
    <div class="timeline-container">
      <svg width={timelineWidth + 250} height={timelineHeight}>
        <g class="dates">
          {#each uniqueDates as d, i}
            {#if i % tickEvery === 0}
              <text
                class="date"
                x={normPos(d)}
                y={yOffset - lineHeight / 2}
                font-size={fontSize}
                dominant-baseline="middle"
                text-anchor="start">{fmtDate(d)}</text
              >
              <line
                x1={normPos(d)}
                y1={yOffset - 0.5 * lineHeight}
                x2={normPos(d)}
                y2={timelineHeight}
              />
            {/if}
          {/each}
        </g>

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
                <!-- <a href={item.url} target="_blank" rel="noopener"> -->
                <tspan class="date" dx="2"> {fmtDate(item.date)} ↗</tspan>
                <!-- </a> -->
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
    font-weight: 700;
    fill: var(--color-1);
  }
  .date,
  a {
    fill: #666;
    font-size: 0.8em;
  }

  line {
    stroke: #b6b6b6;
    stroke-dasharray: 4 4;
  }
</style>
