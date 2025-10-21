<script>
  import { filtered } from "$lib/stores";
  import { onMount, onDestroy } from "svelte";
  import { browser } from "$app/environment";

  const lineHeight = 10;
  const fontSize = Math.round(lineHeight * 0.9);
  const yOffset = 0;

  let sectionEl;
  let timelineContainer;
  let datesBar;

  let sectionTop = 0;
  let rafId = null;

  function measureSectionTop() {
    if (!sectionEl) return;
    sectionTop = sectionEl.getBoundingClientRect().top + window.scrollY;
  }

  function parseDate(dStr, tStr = "00:00") {
    if (!dStr) return null;
    const [d, m, y] = String(dStr).split(".");
    const [hh = "00", mm = "00"] = String(tStr || "00:00").split(":");
    const dt = new Date(+y, (+m || 1) - 1, +d, +hh, +mm);
    return isNaN(+dt) ? null : dt;
  }

  function extractSnippet(text = "", terms = []) {
    const snippet = text.slice(0, 200);
    if (!terms.length) return { before: snippet, match: "", after: "" };
    const rx = new RegExp(
      `\\b${String(terms[0]).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`,
      "i"
    );
    const m = rx.exec(text);
    if (!m) return { before: snippet, match: "", after: "" };
    const idx = m.index,
      len = m[0].length;
    const start = Math.max(0, idx - 80);
    const end = Math.min(text.length, idx + len + 80);
    const s = text.slice(start, end);
    const rel = idx - start;
    return {
      before: s.slice(0, rel),
      match: s.slice(rel, rel + len),
      after: s.slice(rel + len),
    };
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
  let timelineWidth = 2400;
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

    if (rows.length) {
      const dates = rows.map((r) => +r.date);
      const minDate = new Date(Math.min(...dates));
      const maxDate = new Date(Math.max(...dates));

      start = minDate;
      end = maxDate;

      const msWeek = 7 * 24 * 60 * 60 * 1000;
      const spanWeeks = Math.max(1, Math.round((+end - +start) / msWeek));

      const viewportW =
        timelineContainer?.clientWidth ||
        sectionEl?.clientWidth ||
        (browser ? window.innerWidth : 1200);

      const density = rows.length / spanWeeks;
      const pxPerWeek = Math.min(
        40,
        Math.max(8, 20 / Math.max(0.5, Math.log10(density + 1)))
      );

      const byTime = spanWeeks * pxPerWeek;
      const byCount = rows.length * 80;
      const targetWidth = Math.max(viewportW, Math.min(byTime, byCount));
      timelineWidth = Math.min(10000, Math.round(targetWidth));

      timelineHeight = yOffset + rows.length * lineHeight + 40;

      const targetTicks = 30;
      const approxStep = spanWeeks / targetTicks;
      const candidates = [1, 2, 4, 8, 13, 26, 52, 104];
      const stepWeeks =
        candidates.reduce((best, c) =>
          Math.abs(c - approxStep) < Math.abs(best - approxStep) ? c : best
        ) || 4;

      const stepMs = stepWeeks * msWeek;
      ticks = [];
      for (let t = +start; t <= +end; t += stepMs) {
        ticks.push(new Date(t));
      }
    }
  }

  function normPos(date) {
    if (!start || !end || +end - +start === 0) return 0;
    return ((+end - +date) / (+end - +start)) * timelineWidth;
  }

  function scrollToCenterForIndex(i) {
    if (!timelineContainer || !rows[i]) return;
    const x = normPos(rows[i].date);

    const target = Math.max(0, x - 400);
    timelineContainer.scrollTo({ left: target, behavior: "instant" });
  }

  let syncing = false;
  function syncFromTimeline() {
    if (!datesBar || !timelineContainer || syncing) return;
    syncing = true;
    datesBar.scrollLeft = timelineContainer.scrollLeft;
    syncing = false;
  }
  function syncFromBar() {
    if (!datesBar || !timelineContainer || syncing) return;
    syncing = true;
    timelineContainer.scrollLeft = datesBar.scrollLeft;
    syncing = false;
  }

  function activeIndexFromScrollY() {
    if (!rows.length) return 0;
    const cursorY = window.scrollY + window.innerHeight / 2;
    const rowsStartY = sectionTop + yOffset;
    const rel = cursorY - rowsStartY;
    const idx = Math.floor(rel / lineHeight);
    return Math.max(0, Math.min(rows.length - 1, idx));
  }

  function rafSync() {
    rafId = null;
    if (!timelineContainer) return;
    const idx = activeIndexFromScrollY();
    scrollToCenterForIndex(idx);
    if (datesBar) datesBar.scrollLeft = timelineContainer.scrollLeft;
  }

  function onWinScroll() {
    if (rafId === null) rafId = requestAnimationFrame(rafSync);
  }

  function onWinResize() {
    measureSectionTop();
    onWinScroll();
  }

  let ro;
  onMount(() => {
    if (!browser) return;

    measureSectionTop();

    if ("ResizeObserver" in window) {
      ro = new ResizeObserver(onWinResize);
      ro.observe(document.documentElement);
    } else {
      window.addEventListener("resize", onWinResize);
    }

    timelineContainer?.addEventListener("scroll", syncFromTimeline, {
      passive: true,
    });
    datesBar?.addEventListener("scroll", syncFromBar, { passive: true });
    window.addEventListener("scroll", onWinScroll, { passive: true });

    onWinScroll();
  });

  onDestroy(() => {
    if (!browser) return;
    timelineContainer?.removeEventListener("scroll", syncFromTimeline);
    datesBar?.removeEventListener("scroll", syncFromBar);
    window.removeEventListener("scroll", onWinScroll);
    window.removeEventListener("resize", onWinResize);
    if (ro) ro.disconnect();
    if (rafId !== null) cancelAnimationFrame(rafId);
  });
</script>

<section bind:this={sectionEl}>
  {#if rows.length === 0}
    <p></p>
  {:else}
    <div class="dates-bar" bind:this={datesBar} aria-hidden="false">
      <svg width={timelineWidth + 250} height="36" class="dates-svg">
        <g class="dates">
          {#each ticks as d}
            <text
              class="date"
              x={normPos(d)}
              y={18}
              font-size={fontSize}
              dominant-baseline="middle"
              text-anchor="start">{fmtDate(d)}</text
            >
          {/each}
        </g>
      </svg>
    </div>

    <div class="timeline-container" bind:this={timelineContainer}>
      <svg
        width={timelineWidth}
        height={yOffset + rows.length * lineHeight + 40}
      >
        <g class="dates">
          {#each ticks as d}
            <line
              x1={normPos(d)}
              y1={yOffset - 0.5 * lineHeight}
              x2={normPos(d)}
              y2={yOffset + rows.length * lineHeight + 40}
            />
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
    color: white;
    background-color: black;
    min-height: 100vh;
    text-rendering: geometricPrecision;
  }

  .dates-bar {
    position: sticky;
    top: 0;
    background-color: black;
    fill: white;
    overflow-x: auto;
    overflow-y: hidden;
    height: 35px;
    will-change: scroll-position;
  }
  .dates-bar::-webkit-scrollbar {
    width: 0;
    height: 0;
    display: none;
  }
  .dates-bar svg {
    display: block;
  }

  .timeline-container {
    overflow: auto;
    flex-grow: 1;
    scroll-behavior: smooth;
    will-change: scroll-position;
  }

  /* .timeline-container text,
  .timeline-container tspan {
    font-size: 13px;
  } */

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
    fill: var(--color-1);
  }

  line {
    stroke: var(--color-1);
    stroke-dasharray: 4 4;
  }
</style>
