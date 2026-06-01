<script>
  import { onMount } from "svelte";
  import * as d3 from "d3";
  import { articles } from "$lib/stores";
  import { loadArticles } from "$lib/utils/loadArticles";
  import { parseDateLoose } from "$lib/utils/parseDate";
  import { detectRegion } from "$lib/utils/detectRegion";
  import { lang, setLang, availableLangs } from "$lib/i18n";
  import { translateDE_EN } from "$lib/utils/translate";
  import CatPanel from "./CatPanel.svelte";
  import TimelineExport from "$lib/components/TimelineExport.svelte";
  import TimelineGrid from "./TimelineGrid.svelte";
  import TimelineItems from "./TimelineItems.svelte";
  import CategoryMarkers from "./CategoryMarkers.svelte";
  import {
    TOP_PAD, H_PAD, PX_PER_DAY, LINE_H,
    DEFAULT_CATEGORIES,
    DEFAULT_SHOW_BILANZ, DEFAULT_SHOW_BERLIN, DEFAULT_SHOW_BRANDENBURG,
    DEFAULT_REVERSED, DEFAULT_DISPLAY_MODE,
  } from "./config.js";
  import { matchesCategory, snippetFor, placeItems, wrapText } from "./catTimeline.js";

  let categories    = $state(DEFAULT_CATEGORIES.map(c => ({ ...c })));
  let showBilanz    = $state(DEFAULT_SHOW_BILANZ);
  let showBerlin    = $state(DEFAULT_SHOW_BERLIN);
  let showBrandenburg = $state(DEFAULT_SHOW_BRANDENBURG);
  let reversed      = $state(DEFAULT_REVERSED);
  let displayMode   = $state(DEFAULT_DISPLAY_MODE);
  let panelOpen     = $state(true);

  // ── filters ───────────────────────────────────────────────────
  function passesRegion(a) {
    if (!showBerlin && !showBrandenburg) return true;
    const r = detectRegion(a);
    if (showBerlin && r === "Berlin") return true;
    if (showBrandenburg && r === "Brandenburg") return true;
    return false;
  }

  function passesBilanz(a) {
    if (showBilanz) return true;
    return !/bilanz/i.test(a.Title || "");
  }

  // ── state ─────────────────────────────────────────────────────
  let hasInitialFit = false;
  /** @type {any[]} */ let ticks = $state([]);
  /** @type {any[]} */ let placed = $state([]);
  /** @type {any[]} */ let catMarkers = $state([]);
  /** @type {Record<string,number>} */ let counts = $state({});
  let dataSvgW = $state(4000);
  let svgH = $state(600);
  let baselineY = $state(480);

  const baseline = () => baselineY;

  function build() {
    const arts = $articles.filter(a => passesRegion(a) && passesBilanz(a));
    if (!arts.length) {
      placed = [];
      counts = {};
      return;
    }
    if (!categories.length) {
      placed = [];
      return;
    }

    const MIN_DATE = new Date("2020-01-01");
    const parsed = arts.flatMap((a) => {
      const d = parseDateLoose(a.ExtractedDate || a.Date);
      if (!d || d < MIN_DATE) return [];
      return [
        {
          date: d,
          title: (a.Title || "").trim(),
          text: (a.Text || "").trim(),
          raw: a,
        },
      ];
    });
    if (!parsed.length) return;

    const allDates = parsed.map((p) => +p.date);
    const dMin = new Date(Math.min(...allDates));
    const dMax = new Date(Math.max(...allDates));
    const days = (+dMax - +dMin) / 86400000;
    const span = +dMax - +dMin;

    const minW =
      typeof window !== "undefined"
        ? window.innerWidth - (panelOpen ? 252 : 40)
        : 1200;
    const W = Math.max(minW, Math.ceil(days * PX_PER_DAY) + 2 * H_PAD);
    dataSvgW = W;

    const xScale = d3
      .scaleTime()
      .domain([new Date(dMin.getFullYear(), 0, 1), dMax])
      .range(reversed ? [W - H_PAD, H_PAD] : [H_PAD, W - H_PAD]);

    const locale = $lang === "de" ? "de-DE" : "en-GB";
    const makeTick = (/** @type {Date} */ d) => ({
      x: xScale(d),
      isYear: d.getMonth() === 0,
      month: d.toLocaleString(locale, { month: "short" }),
      year: d.getFullYear(),
    });
    const monthTicks = xScale.ticks(d3.timeMonth.every(1)).map(makeTick);
    const lastTick = makeTick(dMax);
    const lastMonthX = monthTicks.at(-1)?.x ?? -Infinity;
    const allTicks = Math.abs(lastTick.x - lastMonthX) > 4
      ? [...monthTicks, lastTick]
      : monthTicks;
    // mark boundary ticks so the grid can label them with month+year
    if (allTicks.length) {
      allTicks[0] = { ...allTicks[0], isFirst: true };
      allTicks[allTicks.length - 1] = { ...allTicks[allTicks.length - 1], isLast: true };
    }
    ticks = allTicks;

    const preItems = [];
    /** @type {Record<string,number>} */ const newCounts = {};

    for (const cat of categories) {
      const catItems = parsed
        .filter((p) => matchesCategory(p.raw, cat))
        .map((p) => ({ ...p, catId: cat.id, color: cat.color, active: cat.on }));
      newCounts[cat.id] = catItems.length;
      [...catItems]
        .sort((a, b) => (reversed ? +b.date - +a.date : +a.date - +b.date))
        .forEach((it, i) => preItems.push({ ...it, desiredRow: i }));
    }

    const labelFn =
      displayMode === "text"
        ? (it) => snippetFor(it, categories)
        : (it) => it.title || it.text || "";
    const allPlaced = placeItems(preItems, xScale, labelFn);

    counts = newCounts;
    const maxY = allPlaced.reduce((m, p) => Math.max(m, p.y + LINE_H), 0);
    const bl = TOP_PAD + maxY;
    baselineY = bl;
    placed = allPlaced;

    // ── category markers ────────────────────────────────────────
    const CAT_CW = 9 * 0.601;
    const DESC_CW = 7 * 0.601;
    const DESC_LINE_H = 10;
    const LABEL_H = 13;
    const ROW_GAP = 10;
    const WRAP_CHARS = Math.floor(340 / DESC_CW);

    const markers = categories.map((cat) => {
      const items = allPlaced.filter((p) => p.catId === cat.id);
      const descLines = cat.desc ? wrapText(cat.desc, WRAP_CHARS) : [];
      if (!items.length)
        return { cat, x: H_PAD, hasTick: false, descLines };
      const first = items.reduce((a, b) => (a.x < b.x ? a : b));
      return {
        cat,
        x: Math.max(H_PAD, first.x),
        hasTick: true,
        descLines,
      };
    });

    markers.sort((a, b) => a.x - b.x);
    const rowEndX2 = new Map();
    const passOne = markers.map((m) => {
      const xStart = m.x;
      const maxLen = Math.max(
        m.cat.label.length * CAT_CW,
        ...m.descLines.map((l) => l.length * DESC_CW),
      );
      const xEnd = xStart + maxLen + 8;
      let row = 0;
      while ((rowEndX2.get(row) ?? -Infinity) > xStart) row++;
      rowEndX2.set(row, xEnd);
      return { ...m, row };
    });

    const rowMaxLines = new Map();
    for (const m of passOne)
      rowMaxLines.set(
        m.row,
        Math.max(rowMaxLines.get(m.row) ?? 0, m.descLines.length),
      );

    const maxRow = passOne.reduce((mx, m) => Math.max(mx, m.row), 0);
    const rowY = [0];
    for (let r = 0; r < maxRow; r++)
      rowY.push(
        rowY[r] + LABEL_H + (rowMaxLines.get(r) ?? 0) * DESC_LINE_H + ROW_GAP,
      );

    catMarkers = passOne.map((m) => ({ ...m, yOff: rowY[m.row] }));
    const lastRowH = LABEL_H + (rowMaxLines.get(maxRow) ?? 0) * DESC_LINE_H;
    svgH = bl + 36 + rowY[maxRow] + lastRowH + 20;

    if (!hasInitialFit) { hasInitialFit = true; requestAnimationFrame(fitContent); }
  }

  $effect(() => {
    for (const c of categories) {
      void c.on;
      void c.label;
      void c.query;
      void c.type;
    }
    void categories.length;
    void reversed;
    void showBerlin;
    void showBrandenburg;
    void displayMode;
    void $lang;
    if ($articles.length) build();
  });

  onMount(() => {
    loadArticles();
  });

  // ── translation ───────────────────────────────────────────────
  /** @type {Record<string,string>} */ let translatedMap = $state({});
  let translating = $state(false);

  async function translateLabels() {
    if ($lang !== "en") return;
    if (translating) return;
    const itemLabels   = placed.map(p => p.label);
    const catLabels    = catMarkers.map(m => m.cat.label);
    const unique = [...new Set([...itemLabels, ...catLabels].filter(Boolean))];
    const toAdd = unique.filter(l => !(l in translatedMap));
    if (!toAdd.length) return;
    translating = true;
    const BATCH = 15;
    try {
      for (let i = 0; i < toAdd.length; i += BATCH) {
        const batch = toAdd.slice(i, i + BATCH);
        const results = await Promise.all(batch.map(async l => [l, await translateDE_EN(l)]));
        translatedMap = { ...translatedMap, ...Object.fromEntries(results) };
      }
    } finally {
      translating = false;
    }
  }

  $effect(() => {
    void placed.length;
    void catMarkers.length;
    void $lang;
    translateLabels();
  });

  // ── zoom ──────────────────────────────────────────────────────
  /** @type {SVGSVGElement|null} */ let svgEl = $state(null);
  let zoomTransform = $state(d3.zoomIdentity);
  let zoomBehavior = /** @type {any} */ (null);

  $effect(() => {
    if (!svgEl) return;
    zoomBehavior = d3
      .zoom()
      .scaleExtent([0.1, 10])
      .on("zoom", (e) => {
        zoomTransform = e.transform;
      });
    d3.select(svgEl).call(zoomBehavior);
    return () => {
      d3.select(svgEl).on(".zoom", null);
    };
  });

  function fitContent() {
    if (!svgEl || !zoomBehavior) return;
    const cW = svgEl.clientWidth;
    const cH = svgEl.clientHeight;
    if (!cW || !cH) return;
    const scale = Math.min(cW / dataSvgW, cH / svgH) * 0.97;
    const tx = (cW - dataSvgW * scale) / 2;
    const ty = Math.max(4, (cH - svgH * scale) / 2);
    d3.select(svgEl).call(
      zoomBehavior.transform,
      d3.zoomIdentity.translate(tx, ty).scale(scale),
    );
  }

  function resetZoom() {
    fitContent();
  }

  // ── export ────────────────────────────────────────────────────
  let exporting = $state(false);
  let exportingPng = $state(false);

  /** Appends a category legend to a cloned SVG; returns added height. */
  function appendLegend(clone) {
    const ns = "http://www.w3.org/2000/svg";
    const FONT = "Courier, monospace";
    const activeCats = categories.filter(c => (counts[c.id] ?? 0) > 0);
    if (!activeCats.length) return 0;

    const chipW = 130; const chipH = 13; const gap = 6; const padX = H_PAD;
    const cols = Math.max(1, Math.floor((dataSvgW - padX) / (chipW + gap)));
    const rows = Math.ceil(activeCats.length / cols);
    const legendY = svgH + 16;

    const g = document.createElementNS(ns, "g");
    activeCats.forEach((cat, i) => {
      const color = cat.color ?? "#999";
      const label = ($lang === "en" ? (translatedMap[cat.label] ?? cat.label) : cat.label);
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = padX + col * (chipW + gap);
      const y = legendY + row * (chipH + gap);

      const rect = document.createElementNS(ns, "rect");
      rect.setAttribute("x", String(x)); rect.setAttribute("y", String(y));
      rect.setAttribute("width", String(chipW)); rect.setAttribute("height", String(chipH));
      rect.setAttribute("fill", color);

      const text = document.createElementNS(ns, "text");
      text.setAttribute("x", String(x + 3)); text.setAttribute("y", String(y + chipH - 3));
      text.setAttribute("font-family", FONT); text.setAttribute("font-size", "9");
      text.setAttribute("fill", "#000");
      text.textContent = label;

      g.appendChild(rect); g.appendChild(text);
    });
    clone.appendChild(g);
    return 16 + rows * (chipH + gap) + 10;
  }

  function exportSVG() {
    if (!svgEl) return;
    exporting = true;
    const clone = /** @type {SVGSVGElement} */ (svgEl.cloneNode(true));
    clone.setAttribute("width", String(dataSvgW));
    clone.querySelector(".zoom-group")?.setAttribute("transform", "");
    const legendH = appendLegend(clone);
    clone.setAttribute("height", String(svgH + legendH));
    const blob = new Blob([new XMLSerializer().serializeToString(clone)], {
      type: "image/svg+xml",
    });
    const a = Object.assign(document.createElement("a"), {
      href: URL.createObjectURL(blob),
      download: "timeline-categories.svg",
    });
    a.click();
    URL.revokeObjectURL(a.href);
    exporting = false;
  }

  async function exportPNG() {
    if (!svgEl) return;
    exportingPng = true;
    const clone = /** @type {SVGSVGElement} */ (svgEl.cloneNode(true));
    clone.setAttribute("width", String(dataSvgW));
    clone.querySelector(".zoom-group")?.setAttribute("transform", "");
    const legendH = appendLegend(clone);
    const totalH = svgH + legendH;
    clone.setAttribute("height", String(totalH));
    const s = new XMLSerializer().serializeToString(clone);
    const canvas = document.createElement("canvas");
    canvas.width = dataSvgW;
    canvas.height = totalH;
    const ctx = canvas.getContext("2d");
    const img = new Image();
    await new Promise((r) => {
      img.onload = r;
      img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(s);
    });
    if (ctx) {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
    }
    const a = Object.assign(document.createElement("a"), {
      href: canvas.toDataURL("image/png"),
      download: "timeline-categories.png",
    });
    a.click();
    exportingPng = false;
  }
</script>

<div class="page">
  <!-- chart -->
  <div class="data-col">
    <div class="chart-wrap">
      {#if !$articles.length}
        <p class="loading">Loading…</p>
      {:else}
        <svg bind:this={svgEl}>
          <g class="zoom-group" transform={zoomTransform}>
            <TimelineGrid {ticks} baseline={baseline()} {dataSvgW} />
            <TimelineItems {placed} baseline={baseline()} {translatedMap} lang={$lang} />
            <CategoryMarkers {catMarkers} {counts} baseline={baseline()} {translatedMap} lang={$lang} />
          </g>
        </svg>
      {/if}
    </div>

    <!-- zoom reset / fit -->
    <button class="zoom-reset" onclick={resetZoom} title="Fit to viewport"
      >fit</button
    >
  </div>

  <CatPanel
    bind:categories
    {counts}
    bind:showBilanz
    bind:showBerlin
    bind:showBrandenburg
    bind:reversed
    bind:displayMode
    bind:panelOpen
    onRebuild={build}
  />
</div>

<TimelineExport
  hasRows={placed.length > 0}
  {exporting}
  {exportingPng}
  {translating}
  onExportSVG={exportSVG}
  onExportPNG={exportPNG}
/>

<div class="lang-switch">
  {#each availableLangs as l}
    <button class:active={$lang === l} onclick={() => setLang(l)}>{l.toUpperCase()}</button>
  {/each}
</div>

<style>
  :global(body) {
    margin: 0;
    background: #fff;
    overflow: hidden;
  }

  .page {
    display: flex;
    width: 100vw;
    height: 100vh;
    background: #fff;
    overflow: hidden;
  }
  .data-col {
    flex: 1;
    overflow: hidden;
    min-width: 0;
    position: relative;
  }
  .chart-wrap {
    width: 100%;
    height: 100%;
    overflow: hidden;
  }

  svg {
    display: block;
    width: 100%;
    height: 100%;
  }

  :global(.item) { cursor: pointer; }
  :global(.item:hover) { opacity: 0.55 !important; }
  :global(.item-link) { cursor: pointer; }

  .loading {
    padding: 32px;
    color: #aaa;
    font-size: 13px;
    font-family: Courier, monospace;
  }

  .zoom-reset {
    position: absolute;
    top: 8px;
    left: 8px;
    z-index: 5;
    background: rgba(244, 243, 239, 0.92);
    border: 1px solid #ccc;
    font-family: Courier, monospace;
    font-size: 12px;
    cursor: pointer;
    padding: 3px 8px;
    color: #666;
  }
  .zoom-reset:hover {
    background: #111;
    color: #fff;
    border-color: #111;
  }

  .lang-switch {
    position: fixed;
    bottom: 1rem;
    right: 1rem;
    z-index: 10;
    display: flex;
    gap: 0.4rem;
  }
  .lang-switch button {
    background: #111;
    color: #eee;
    border: none;
    cursor: pointer;
    padding: 0.35rem 0.6rem;
    font-family: Courier, monospace;
    font-size: 11px;
  }
  .lang-switch button.active {
    background: #fff;
    color: #000;
    outline: 1px solid #ccc;
  }
  .lang-switch button:hover:not(.active) {
    background: #333;
  }
</style>
