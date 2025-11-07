<script>
  import { filtered, isMobile } from "$lib/stores";
  import { onMount, onDestroy, tick } from "svelte";
  import { browser } from "$app/environment";

  const lineHeight = 12;
  const fontSize = Math.round(lineHeight * 0.9);
  const yOffset = 0;
  const leftPad = 120;
  const rightPad = 1500;
  const tickPx = 500;
  const bufferRows = 30;

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
  let start = null;
  let end = null;
  let ticks = [];
  let timelineWidth = 2400;
  let totalWidth = 2400 + leftPad + rightPad;

  function makeRowsSig(arr) {
    if (!Array.isArray(arr) || !arr.length) return "0";
    const first = arr[0]?.date ? +arr[0].date : 0;
    const last = arr[arr.length - 1]?.date ? +arr[arr.length - 1].date : 0;
    return `${arr.length}|${first}|${last}`;
  }

  let lastRowsSig = "";
  let visibleStart = 0;
  let visibleEnd = 0;
  let visible = [];
  let syncing = false;
  let lastActiveIndex = -1;
  let hScrollActive = false;
  let hScrollSettleFrames = 0;
  let hScrollLast = 0;
  let hScrollRaf = 0;
  let scheduleResetX = false;
  let filteredUnsub;

  function beginHScrollMonitor() {
    if (hScrollActive) return;
    hScrollActive = true;
    hScrollSettleFrames = 0;
    hScrollLast = timelineContainer ? timelineContainer.scrollLeft : 0;
    hScrollRaf = requestAnimationFrame(hScrollTick);
  }

  function hScrollTick() {
    const cur = timelineContainer ? timelineContainer.scrollLeft : 0;
    if (Math.abs(cur - hScrollLast) < 0.25) {
      hScrollSettleFrames += 1;
    } else {
      hScrollSettleFrames = 0;
      hScrollLast = cur;
    }
    if (hScrollSettleFrames >= 3) {
      hScrollActive = false;
      hScrollRaf = 0;
      return;
    }
    hScrollRaf = requestAnimationFrame(hScrollTick);
  }

  function updateVisible() {
    const cursorY = window.scrollY + window.innerHeight / 2;
    const rowsStartY = sectionTop + yOffset;
    const rel = cursorY - rowsStartY;
    const idx = Math.max(
      0,
      Math.min(rows.length - 1, Math.floor(rel / lineHeight))
    );
    const first = Math.max(
      0,
      Math.floor((window.scrollY - rowsStartY) / lineHeight) - bufferRows
    );
    const last = Math.min(
      rows.length,
      Math.ceil(
        (window.scrollY + window.innerHeight - rowsStartY) / lineHeight
      ) + bufferRows
    );
    visibleStart = first;
    visibleEnd = last;
    visible = rows.slice(visibleStart, visibleEnd);
    if (!hScrollActive && idx !== lastActiveIndex) {
      scrollToCenterForIndex(idx);
      lastActiveIndex = idx;
    }
  }

  async function resetX() {
    if (!browser) return;
    await tick();
    const prev = timelineContainer
      ? timelineContainer.style.scrollBehavior
      : "";
    if (timelineContainer) timelineContainer.style.scrollBehavior = "auto";
    datesBar && (datesBar.scrollLeft = 0);
    timelineContainer &&
      timelineContainer.scrollTo({ left: 0, behavior: "auto" });
    if (timelineContainer) timelineContainer.style.scrollBehavior = prev || "";
    lastActiveIndex = -1;
  }

  $: if (scheduleResetX) {
    scheduleResetX = false;
    resetX();
  }

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
      const viewportW =
        timelineContainer?.clientWidth ||
        sectionEl?.clientWidth ||
        (browser ? window.innerWidth : 1200);
      const msWeek = 7 * 24 * 60 * 60 * 1000;
      const spanWeeks = Math.max(1, Math.round((+end - +start) / msWeek));
      const density = rows.length / spanWeeks;
      const pxPerWeek = Math.min(
        40,
        Math.max(8, 20 / Math.max(0.5, Math.log10(density + 1)))
      );
      const byTime = spanWeeks * pxPerWeek;
      const byCount = rows.length * 80;
      const targetWidth = Math.max(viewportW, Math.min(byTime, byCount));
      timelineWidth = Math.min(10000, Math.round(targetWidth));
      totalWidth = leftPad + timelineWidth + rightPad;
      ticks = [];
      const nTicks = Math.max(1, Math.floor(timelineWidth / tickPx));
      for (let i = 0; i <= nTicks; i++) {
        const x = leftPad + i * tickPx;
        const frac = Math.min(1, Math.max(0, (x - leftPad) / timelineWidth));
        const t = +end - frac * (+end - +start);
        ticks.push({ x, d: new Date(t) });
      }
      const sig = makeRowsSig(rows);
      if (browser && sig !== lastRowsSig) {
        lastRowsSig = sig;
        lastActiveIndex = -1;
        updateVisible();
      }
    } else {
      start = null;
      end = null;
      ticks = [];
      lastRowsSig = "0";
      visible = [];
      visibleStart = 0;
      visibleEnd = 0;
    }
  }

  function normPos(date) {
    if (!start || !end || +end - +start === 0) return leftPad;
    return leftPad + ((+end - +date) / (+end - +start)) * timelineWidth;
  }

  function scrollToCenterForIndex(i) {
    if (!timelineContainer || !rows[i]) return;
    const x = normPos(rows[i].date);
    const padd = $isMobile ? 10 : 400;
    const target = Math.max(0, x - padd);
    timelineContainer.scrollTo({ left: target, behavior: "auto" });
  }

  function syncFromTimeline() {
    if (!datesBar || !timelineContainer || syncing) return;
    syncing = true;
    const want = timelineContainer.scrollLeft;
    if (Math.abs(datesBar.scrollLeft - want) > 1) datesBar.scrollLeft = want;
    syncing = false;
    beginHScrollMonitor();
  }

  function syncFromBar() {
    if (!datesBar || !timelineContainer || syncing) return;
    syncing = true;
    const want = datesBar.scrollLeft;
    if (Math.abs(timelineContainer.scrollLeft - want) > 1)
      timelineContainer.scrollLeft = want;
    syncing = false;
    beginHScrollMonitor();
  }

  function rafSync() {
    rafId = null;
    if (!timelineContainer) return;
    updateVisible();
    if (
      datesBar &&
      Math.abs(datesBar.scrollLeft - timelineContainer.scrollLeft) > 1
    ) {
      datesBar.scrollLeft = timelineContainer.scrollLeft;
    }
  }

  function onWinScroll() {
    if (rafId === null) rafId = requestAnimationFrame(rafSync);
  }

  function onWinResize() {
    measureSectionTop();
    onWinScroll();
  }

  onMount(() => {
    if (!browser) return;
    measureSectionTop();
    timelineContainer?.addEventListener("scroll", syncFromTimeline, {
      passive: true,
    });
    datesBar?.addEventListener("scroll", syncFromBar, { passive: true });
    window.addEventListener("scroll", onWinScroll, { passive: true });
    window.addEventListener("resize", onWinResize, { passive: true });
    filteredUnsub = filtered.subscribe(async () => {
      scheduleResetX = true;
    });
    onWinScroll();
  });

  onDestroy(() => {
    if (!browser) return;
    timelineContainer?.removeEventListener("scroll", syncFromTimeline);
    datesBar?.removeEventListener("scroll", syncFromBar);
    window.removeEventListener("scroll", onWinScroll);
    window.removeEventListener("resize", onWinResize);
    if (rafId !== null) cancelAnimationFrame(rafId);
    if (hScrollRaf) cancelAnimationFrame(hScrollRaf);
    if (filteredUnsub) filteredUnsub();
  });
</script>

<section bind:this={sectionEl}>
  {#if rows.length === 0}
    <p></p>
  {:else}
    <div class="datesBar" bind:this={datesBar} aria-hidden="false">
      <svg width={totalWidth} height="36" class="datesSvg">
        <g class="dates">
          {#each ticks as t}
            <text
              class="date"
              x={t.x}
              y={18}
              font-size={fontSize}
              dominant-baseline="middle"
              text-anchor="start">{fmtDate(t.d)}</text
            >
          {/each}
        </g>
      </svg>
    </div>

    <div class="timelineContainer" bind:this={timelineContainer}>
      <svg width={totalWidth} height={yOffset + rows.length * lineHeight + 40}>
        <g class="dates">
          {#each ticks as t}
            <line
              x1={t.x}
              y1={yOffset - 0.5 * lineHeight}
              x2={t.x}
              y2={yOffset + rows.length * lineHeight + 40}
            />
          {/each}
        </g>
        <g>
          {#each visible as item, i}
            <a href={item.url} target="_blank" rel="noopener">
              <text
                x={normPos(item.date)}
                y={yOffset + (visibleStart + i) * lineHeight + lineHeight / 2}
                font-size={fontSize}
                dominant-baseline="middle"
                text-anchor="start"
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
  .datesBar {
    position: sticky;
    top: 0;
    background-color: black;
    fill: white;
    overflow-x: auto;
    overflow-y: hidden;
    height: 35px;
    will-change: scroll-position;
  }
  .datesBar::-webkit-scrollbar {
    width: 0;
    height: 0;
    display: none;
  }
  .datesSvg {
    display: block;
  }
  .timelineContainer {
    overflow: auto;
    flex-grow: 1;
    will-change: scroll-position;
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
    fill: var(--color-1);
  }
  line {
    stroke: var(--color-1);
    stroke-dasharray: 4 4;
    shape-rendering: crispEdges;
  }
</style>
