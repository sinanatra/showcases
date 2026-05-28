<script>
  import { filtered, filters, isMobile } from "$lib/stores";
  import { onMount, onDestroy, tick } from "svelte";
  import { browser } from "$app/environment";
  import { lang } from "$lib/i18n";
  import { translateDE_EN } from "$lib/utils/translate";
  import { shortenAroundKeyword } from "$lib/utils/textUtils";

  const lineHeight = 16;
  const fontSize = Math.round(lineHeight * 0.9);
  const yOffset = 0;
  const leftPad = 120;
  const rightPad = 1500;
  const tickPx = 500;
  const bufferRows = 60;

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

  let fmtDate;
  $: {
    const locale = $lang === "de" ? "de-DE" : "en-GB";
    fmtDate = (d) =>
      d.toLocaleDateString(locale, {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
  }

  // Translation
  let translatedMap = {};
  function snippetKey(item) { return item.before + item.match + item.after; }
  function splitAround(text, term) {
    if (!term || !text) return null;
    const rx = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    const m = rx.exec(text);
    if (!m) return null;
    return { pre: text.slice(0, m.index), hit: m[0], post: text.slice(m.index + m[0].length) };
  }
  let translating = false;
  async function translateVisible() {
    const seen = new Set(Object.keys(translatedMap));
    const toAdd = new Map();
    for (const item of visible) {
      const sKey = snippetKey(item);
      if (!seen.has(sKey)) toAdd.set(sKey, translateDE_EN(sKey));
      if (item.match) {
        const kKey = `__k:${item.match}`;
        if (!seen.has(kKey)) toAdd.set(kKey, translateDE_EN(item.match));
      }
    }
    if (!toAdd.size) return;
    translating = true;
    const results = await Promise.all([...toAdd.entries()].map(async ([k, p]) => [k, await p]));
    translatedMap = { ...translatedMap, ...Object.fromEntries(results) };
    translating = false;
  }
  $: if ($lang === "en" && visible.length) translateVisible();

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
    if (hScrollSettleFrames >= 1) {
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
    if (first !== visibleStart || last !== visibleEnd) {
      visibleStart = first;
      visibleEnd = last;
      visible = rows.slice(visibleStart, visibleEnd);
    }
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
        const kwFromMatch = (Array.isArray(a.KeywordMatch) && a.KeywordMatch[0])
          || (Array.isArray(a.KeywordExtracted) && a.KeywordExtracted[0])
          || "";
        // text search takes priority; keyword as fallback
        const kw = $filters.text || kwFromMatch;
        const snippet = shortenAroundKeyword(a.Text || "", kw, 200);
        const sp = kw ? splitAround(snippet, kw) : null;
        const before = sp ? sp.pre : snippet;
        const match = sp ? sp.hit : "";
        const after = sp ? sp.post : "";
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
      }
      // always refresh visible slice when rows rebuild (content may have changed)
      if (browser) visible = rows.slice(visibleStart, visibleEnd);
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
    window.addEventListener("scroll", onWinScroll, { passive: true });
    window.addEventListener("resize", onWinResize, { passive: true });
    filteredUnsub = filtered.subscribe(async () => {
      scheduleResetX = true;
    });
    onWinScroll();
  });

  onDestroy(() => {
    if (!browser) return;
    window.removeEventListener("scroll", onWinScroll);
    window.removeEventListener("resize", onWinResize);
    if (rafId !== null) cancelAnimationFrame(rafId);
    if (hScrollRaf) cancelAnimationFrame(hScrollRaf);
    if (filteredUnsub) filteredUnsub();
  });

  // SVG export
  let exporting = false;

  function escXML(s) {
    return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  async function exportSVG() {
    if (!rows.length || exporting) return;

    if ($lang === "en") {
      exporting = true;
      const seen = new Set(Object.keys(translatedMap));
      const toAdd = new Map();
      for (const r of rows) {
        const sKey = snippetKey(r);
        if (!seen.has(sKey)) toAdd.set(sKey, translateDE_EN(sKey));
        if (r.match) {
          const kKey = `__k:${r.match}`;
          if (!seen.has(kKey)) toAdd.set(kKey, translateDE_EN(r.match));
        }
      }
      if (toAdd.size) {
        const results = await Promise.all([...toAdd.entries()].map(async ([k, p]) => [k, await p]));
        translatedMap = { ...translatedMap, ...Object.fromEntries(results) };
      }
      exporting = false;
    }

    const color = "rgb(231,233,91)";
    const h = rows.length * lineHeight + 50;
    let out = `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="${h}" style="background:black;font-family:Courier,monospace;font-size:${fontSize}px">`;

    for (const t of ticks) {
      out += `<line x1="${t.x}" y1="0" x2="${t.x}" y2="${h}" stroke="${color}" stroke-dasharray="4 4" shape-rendering="crispEdges"/>`;
      out += `<text x="${t.x}" y="${lineHeight}" fill="${color}" font-size="${fontSize}" dominant-baseline="middle">${escXML(fmtDate(t.d))}</text>`;
    }

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const x = normPos(r.date);
      const y = (i + 2) * lineHeight + lineHeight / 2;
      out += `<text x="${x}" y="${y}" dominant-baseline="middle" fill="gainsboro" font-style="italic">`;

      if ($lang === "en") {
        const ts = translatedMap[snippetKey(r)];
        const tk = r.match ? translatedMap[`__k:${r.match}`] : "";
        const sp = ts ? splitAround(ts, tk || "") : null;
        if (sp) {
          if (sp.pre) out += `<tspan>${escXML(sp.pre)}</tspan>`;
          if (sp.hit) out += `<tspan fill="${color}" font-weight="700" font-style="normal">${escXML(sp.hit)}</tspan>`;
          if (sp.post) out += `<tspan>${escXML(sp.post)}</tspan>`;
        } else {
          out += `<tspan>${escXML(ts ?? snippetKey(r))}</tspan>`;
        }
      } else {
        if (r.before) out += `<tspan>${escXML(r.before)}</tspan>`;
        if (r.match) out += `<tspan fill="${color}" font-weight="700" font-style="normal">${escXML(r.match)}</tspan>`;
        if (r.after) out += `<tspan>${escXML(r.after)}</tspan>`;
      }

      out += `<tspan fill="${color}" font-size="${Math.round(fontSize * 0.8)}" dx="2"> ${escXML(fmtDate(r.date))} ↗</tspan>`;
      out += `</text>`;
    }

    out += `</svg>`;
    const blob = new Blob([out], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "timeline.svg"; a.click();
    URL.revokeObjectURL(url);
  }
</script>

<section bind:this={sectionEl}>
  {#if rows.length === 0}
    <p></p>
  {:else}
    <div
      class="datesBar"
      bind:this={datesBar}
      aria-hidden="false"
      on:scroll|passive={syncFromBar}
    >
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

    <div
      class="timelineContainer"
      bind:this={timelineContainer}
      on:scroll|passive={syncFromTimeline}
    >
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
          {#each visible as item, i (visibleStart + i)}
            {@const isEN = $lang === "en"}
            {@const sKey = snippetKey(item)}
            {@const ts = translatedMap[sKey]}
            {@const tk = item.match ? translatedMap[`__k:${item.match}`] : ""}
            {@const enSplit = isEN && ts ? splitAround(ts, tk || "") : null}
            <a href={item.url} target="_blank" rel="noopener">
              <text
                x={normPos(item.date)}
                y={yOffset + (visibleStart + i) * lineHeight + lineHeight / 2}
                font-size={fontSize}
                dominant-baseline="middle"
                text-anchor="start"
              >
                {#if isEN}
                  {#if enSplit}
                    <tspan class="text">{enSplit.pre}</tspan><tspan class="highlight">{enSplit.hit}</tspan><tspan class="text">{enSplit.post}</tspan>
                  {:else}
                    <tspan class="text">{ts ?? sKey}</tspan>
                  {/if}
                {:else}
                  <tspan class="text">{item.before}</tspan>
                  <tspan class="highlight">{item.match}</tspan>
                  <tspan class="text">{item.after}</tspan>
                {/if}
                <tspan class="date" dx="2"> {fmtDate(item.date)} ↗</tspan>
              </text>
            </a>
          {/each}
        </g>
      </svg>
    </div>

    <button class="export" on:click={exportSVG} disabled={exporting}>
      {exporting ? "translating…" : "↓ SVG"}
    </button>

    {#if translating}
      <span class="tl-loading">translating…</span>
    {/if}
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
  .export {
    position: fixed;
    bottom: 3.5rem;
    right: 1rem;
    background: #111;
    color: #eee;
    border: none;
    cursor: pointer;
    padding: 0.35rem 0.6rem;
    font-family: Courier, monospace;
    z-index: 10;
  }
  .export:hover { background: white; color: black; }
  .tl-loading {
    position: fixed;
    bottom: 6rem;
    right: 1rem;
    font-family: Courier, monospace;
    font-size: 0.75rem;
    color: var(--color-1);
    z-index: 10;
    opacity: 0.8;
  }
</style>
