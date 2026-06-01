<script>
  import { filtered, filters, isMobile } from "$lib/stores";
  import { onMount, onDestroy, tick } from "svelte";
  import { browser } from "$app/environment";
  import { lang } from "$lib/i18n";
  import { translateDE_EN } from "$lib/utils/translate";
  import { shortenAroundKeyword } from "$lib/utils/textUtils";
  import TimelineExport from "$lib/components/TimelineExport.svelte";

  function typescale(size) {
    return { fontSize: size, lineHeight: Math.round(size * 1.4), dateFontSize: Math.round(size * 0.8) };
  }
  const { fontSize, lineHeight, dateFontSize } = typescale(16);
  const yOffset = 0;
  const leftPad = 120;
  const rightPad = 2500;
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
    const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    // try exact, then progressively shorter prefixes down to 4 chars
    const minLen = Math.min(4, term.length);
    for (let len = term.length; len >= minLen; len = Math.max(minLen, Math.floor(len * 0.75))) {
      const rx = new RegExp(esc(term.slice(0, len)) + "\\w*", "i");
      const m = rx.exec(text);
      if (m) return { pre: text.slice(0, m.index), hit: m[0], post: text.slice(m.index + m[0].length) };
      if (len === minLen) break;
    }
    return null;
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
        const text = a.Text || "";
        const candidates = [
          $filters.text,
          ...(Array.isArray(a.KeywordMatch) ? a.KeywordMatch : []),
          ...(Array.isArray(a.KeywordExtracted) ? a.KeywordExtracted : []),
        ].filter(Boolean);
        const kw = candidates.find(c => text.toLowerCase().includes(String(c).toLowerCase())) || candidates[0] || "";
        const snippet = shortenAroundKeyword(text, kw, 200);
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
      // use updateVisible() so visibleStart/visibleEnd are recalculated from
      // current scroll position — otherwise initial async data load renders nothing
      // because visibleEnd is still 0 when the first real rows arrive
      if (browser) { measureSectionTop(); updateVisible(); }
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
    exporting = true;
    try {
      const { svg } = await buildSVGString();
      const blob = new Blob([svg], { type: "image/svg+xml" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "timeline.svg"; a.click();
      URL.revokeObjectURL(url);
    } finally {
      exporting = false;
    }
  }

  let exportingPng = false;

  function readPageColors() {
    const style = getComputedStyle(sectionEl);
    const accent = style.getPropertyValue("--color-1").trim() || "rgb(231,233,91)";
    const bg = style.backgroundColor || "black";
    const textFill = style.color || "gainsboro";
    return { accent, bg, textFill };
  }

  async function buildSVGString(colors = readPageColors()) {
    if ($lang === "en") {
      const seen = new Set(Object.keys(translatedMap));
      const toTranslate = [];
      for (const r of rows) {
        const sKey = snippetKey(r);
        if (!seen.has(sKey)) toTranslate.push([sKey, sKey]);
        if (r.match) {
          const kKey = `__k:${r.match}`;
          if (!seen.has(kKey)) toTranslate.push([kKey, r.match]);
        }
      }
      // batch to avoid saturating the browser connection pool
      const BATCH = 6;
      for (let i = 0; i < toTranslate.length; i += BATCH) {
        const batch = toTranslate.slice(i, i + BATCH);
        const results = await Promise.all(
          batch.map(async ([k, text]) => [k, await translateDE_EN(text)])
        );
        translatedMap = { ...translatedMap, ...Object.fromEntries(results) };
      }
    }

    const { accent, bg, textFill } = colors;

    const h = rows.length * lineHeight + 50;
    let out = `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="${h}" style="background:${bg};font-family:Courier,monospace;font-size:${fontSize}px">`;

    for (const t of ticks) {
      out += `<line x1="${t.x}" y1="0" x2="${t.x}" y2="${h}" stroke="${accent}" stroke-dasharray="4 4" shape-rendering="crispEdges"/>`;
      out += `<text x="${t.x}" y="${lineHeight}" fill="${accent}" font-size="${fontSize}" dominant-baseline="middle">${escXML(fmtDate(t.d))}</text>`;
    }

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const x = normPos(r.date);
      const y = (i + 2) * lineHeight + lineHeight / 2;
      out += `<text x="${x}" y="${y}" dominant-baseline="middle" fill="${textFill}" font-style="italic">`;

      if ($lang === "en") {
        const ts = translatedMap[snippetKey(r)];
        const tk = r.match ? translatedMap[`__k:${r.match}`] : "";
        const sp = ts ? (
          splitAround(ts, tk || "") ||
          (tk && tk.includes(" ") ? tk.split(" ").reduce((acc, w) => acc || splitAround(ts, w), null) : null) ||
          splitAround(ts, r.match || "")
        ) : null;
        if (sp) {
          if (sp.pre) out += `<tspan>${escXML(sp.pre)}</tspan>`;
          if (sp.hit) out += `<tspan fill="${accent}" font-weight="700" font-style="normal">${escXML(sp.hit)}</tspan>`;
          if (sp.post) out += `<tspan>${escXML(sp.post)}</tspan>`;
        } else {
          out += `<tspan>${escXML(ts ?? snippetKey(r))}</tspan>`;
        }
      } else {
        if (r.before) out += `<tspan>${escXML(r.before)}</tspan>`;
        if (r.match) out += `<tspan fill="${accent}" font-weight="700" font-style="normal">${escXML(r.match)}</tspan>`;
        if (r.after) out += `<tspan>${escXML(r.after)}</tspan>`;
      }

      out += `<tspan fill="${accent}" font-size="${dateFontSize}" dx="2"> ${escXML(fmtDate(r.date))} ↗</tspan>`;
      out += `</text>`;
    }

    out += `</svg>`;
    return { svg: out, w: totalWidth, h };
  }

  async function exportPNG() {
    if (!rows.length || exportingPng) return;
    exportingPng = true;
    try {
      const { svg, w, h } = await buildSVGString("light");
      const blob = new Blob([svg], { type: "image/svg+xml" });
      const url = URL.createObjectURL(blob);
      await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          // Target 2× pixel density for sharpness, then clamp to browser canvas limits.
          // Chrome/Firefox support up to 32767px per side and ~256M total pixels.
          const TARGET_SCALE = 4;
          const MAX_DIM = 32767;
          const MAX_AREA = 512 * 1024 * 1024;
          const tw = w * TARGET_SCALE;
          const th = h * TARGET_SCALE;
          const scaleForDim = Math.min(1, MAX_DIM / tw, MAX_DIM / th);
          const scaleForArea = Math.sqrt(MAX_AREA / (tw * th));
          const scale = Math.min(TARGET_SCALE, TARGET_SCALE * scaleForDim, TARGET_SCALE * scaleForArea);
          const cw = Math.floor(w * scale);
          const ch = Math.floor(h * scale);

          const canvas = document.createElement("canvas");
          canvas.width = cw;
          canvas.height = ch;
          const ctx = canvas.getContext("2d");
          ctx.scale(scale, scale);
          ctx.drawImage(img, 0, 0);
          URL.revokeObjectURL(url);
          canvas.toBlob((pngBlob) => {
            if (!pngBlob) { reject(new Error("canvas.toBlob returned null")); return; }
            const pngUrl = URL.createObjectURL(pngBlob);
            const a = document.createElement("a");
            a.href = pngUrl; a.download = "timeline.png"; a.click();
            URL.revokeObjectURL(pngUrl);
            resolve(undefined);
          }, "image/png");
        };
        img.onerror = reject;
        img.src = url;
      });
    } finally {
      exportingPng = false;
    }
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
              font-size={dateFontSize}
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
            {@const enSplit = isEN && ts ? (
              splitAround(ts, tk || "") ||
              (tk && tk.includes(" ") ? tk.split(" ").reduce((acc, w) => acc || splitAround(ts, w), null) : null) ||
              splitAround(ts, item.match || "")
            ) : null}
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
                <tspan class="date" font-size={dateFontSize} dx="2"> {fmtDate(item.date)} ↗</tspan>
              </text>
            </a>
          {/each}
        </g>
      </svg>
    </div>

    <!-- <TimelineExport
      onExportSVG={exportSVG}
      onExportPNG={exportPNG}
      {exporting}
      {exportingPng}
      {translating}
      hasRows={rows.length > 0}
    /> -->
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
