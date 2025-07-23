<script>
  import { articles, filtered } from "$lib/stores";

  const lineHeight = 16;
  const fontSize = Math.round(lineHeight * 0.9);
  const timelineWidth = 2000;
  const tickInterval = 120;
  const yOffset = 40;

  let data = [];
  let uniqueDates = [];
  let initialStart = null;
  let initialEnd = null;
  let timelineHeight = 0;

  function parseDate(dStr, tStr = "00:00") {
    const [d, m, y] = dStr.split(".");
    const [hh = "00", mm = "00"] = tStr.split(":");
    return new Date(+y, +m - 1, +d, +hh, +mm);
  }

  const ABBREVS = ["Nr", "Dr", "z.B", "etc", "u.a"];

  function escapeRegExp(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function isAbbrevBoundary(text, idx) {
    for (const ab of ABBREVS) {
      if (text.slice(idx - ab.length, idx) === ab) return true;
    }
    return false;
  }

  function findPrevBoundary(text, pos) {
    let candidate = Math.max(
      text.lastIndexOf(".", pos - 1),
      text.lastIndexOf("!", pos - 1),
      text.lastIndexOf("?", pos - 1)
    );
    while (
      candidate > -1 &&
      text[candidate] === "." &&
      isAbbrevBoundary(text, candidate)
    ) {
      candidate = Math.max(
        text.lastIndexOf(".", candidate - 1),
        text.lastIndexOf("!", candidate - 1),
        text.lastIndexOf("?", candidate - 1)
      );
    }
    return candidate;
  }

  function findNextBoundary(text, pos) {
    let dots = [
      text.indexOf(".", pos),
      text.indexOf("!", pos),
      text.indexOf("?", pos),
    ].filter((i) => i >= 0);
    let candidate = dots.length ? Math.min(...dots) : -1;
    while (
      candidate > -1 &&
      text[candidate] === "." &&
      isAbbrevBoundary(text, candidate)
    ) {
      dots = [
        text.indexOf(".", candidate + 1),
        text.indexOf("!", candidate + 1),
        text.indexOf("?", candidate + 1),
      ].filter((i) => i >= 0);
      candidate = dots.length ? Math.min(...dots) : -1;
    }
    return candidate;
  }

  function extractSnippet(text, terms) {
    if (!terms || !terms.length) {
      const snippet = text.slice(0, 200);
      return { before: snippet, match: "", after: "" };
    }
    let matchObj = null;
    let term = "";
    for (const t of terms) {
      const esc = escapeRegExp(t);
      const re = new RegExp(`\\b${esc}\\b`, "i");
      const m = re.exec(text);
      if (m) {
        matchObj = m;
        term = m[0];
        break;
      }
    }
    if (!matchObj) {
      const snippet = text.slice(0, 200);
      return { before: snippet, match: "", after: "" };
    }
    const idx = matchObj.index;
    const len = term.length;
    const startBoundary = findPrevBoundary(text, idx);
    const endBoundaryRaw = findNextBoundary(text, idx + len);
    const endBoundary = endBoundaryRaw > -1 ? endBoundaryRaw : text.length - 1;
    const snippet = text.slice(startBoundary + 1, endBoundary + 1);
    const relIdx = idx - (startBoundary + 1);
    return {
      before: snippet.slice(0, relIdx),
      match: snippet.slice(relIdx, relIdx + len),
      after: snippet.slice(relIdx + len),
    };
  }

  function fmtDate(d) {
    return d.toLocaleDateString("de-DE", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }

  function normPos(date) {
    if (!initialStart || !initialEnd || initialEnd - initialStart === 0)
      return 0;
    return ((initialEnd - date) / (initialEnd - initialStart)) * timelineWidth;
  }

  $: {
    const all = $articles;
    const vis = new Set(
      $filtered.map((a) => `${a.ExtractedDate}|${a.ExtractedTime[0]}|${a.URL}`)
    );
    if (Array.isArray(all) && all.length) {
      data = all
        .map((a) => {
          const terms = a.KeywordExtracted || [];
          const { before, match, after } = extractSnippet(a.Text, terms);
          const date = parseDate(a.ExtractedDate, a.ExtractedTime[0]);
          const key = `${a.ExtractedDate}|${a.ExtractedTime[0]}|${a.URL}`;
          return {
            date,
            before,
            match,
            after,
            url: a.URL,
            visible: vis.has(key),
          };
        })
        .sort((a, b) => b.date - a.date);

      const dates = data.map((d) => d.date.getTime());
      uniqueDates = Array.from(new Set(dates))
        .sort((a, b) => a - b)
        .map((ms) => new Date(ms));

      if (!initialStart) {
        initialStart = uniqueDates[0];
        initialEnd = uniqueDates[uniqueDates.length - 1];
      }

      timelineHeight = yOffset + data.length * lineHeight + 40;
    }
  }
</script>

<section>
  {#if !data.length}
    <p>Loading snippets…</p>
  {:else}
    <div class="timeline-container">
      <svg
        width={timelineWidth + 2500}
        height={timelineHeight}
      >
        <g class="dates">
          {#each uniqueDates as d, i}
            {#if i % tickInterval === 0}
              <text
                class="date"
                x={normPos(d)}
                y={yOffset - lineHeight / 2}
                font-size={fontSize}
                dominant-baseline="middle"
                text-anchor="left">{fmtDate(d)}</text
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
          {#each data as item, i}
            <text
              x={normPos(item.date)}
              y={yOffset + i * lineHeight + lineHeight / 2}
              font-size={fontSize}
              dominant-baseline="middle"
              opacity={item.visible ? 1 : 0.2}
            >
              <tspan class="text">{item.before}</tspan>
              <tspan
                class="highlight"
                fill={item.visible ? "var(--color-1)" : "#999"}
              >
                {item.match}
              </tspan>
              <tspan class="text">{item.after}</tspan>
              <a href={item.url} target="_blank">
                <tspan class="date" dx="2"> {fmtDate(item.date)} ↗</tspan>
              </a>
            </text>
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
    font-size: 13px; /* Match to JS fontSize variable for clarity */
  }

  a tspan:hover {
    fill: var(--color-1);
    text-decoration: underline;
  }

  .text {
    font-style: italic;
  }

  .highlight {
    font-weight: bold;
  }

  .date,
  a {
    fill: #666;
    font-size: 0.8em;
  }

  line {
    stroke: #b6b6b6;
    stroke-dasharray: 4, 4;
  }
</style>
