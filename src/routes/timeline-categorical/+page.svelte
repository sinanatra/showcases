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
    CAT_COLORS, STORAGE_KEY, DEFAULT_CATEGORIES,
  } from "./config.js";
  import { matchesCategory, snippetFor, placeItems, wrapText } from "./catTimeline.js";

  // ── persistence ───────────────────────────────────────────────
  function loadState() {
    if (typeof localStorage === "undefined") return null;
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    } catch {
      return null;
    }
  }
  function saveState(cats, opts) {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ cats, opts }));
  }

  const saved = loadState();
  let categories = $state(saved?.cats ?? DEFAULT_CATEGORIES);
  let showBerlin = $state(saved?.opts?.showBerlin ?? true);
  let showBrandenburg = $state(saved?.opts?.showBrandenburg ?? false);
  let reversed = $state(saved?.opts?.reversed ?? false);
  let displayMode = $state(saved?.opts?.displayMode ?? "title");
  let panelOpen = $state(true);

  $effect(() => {
    saveState(
      categories.map((c) => ({ ...c })),
      { showBerlin, showBrandenburg, reversed, displayMode },
    );
  });

  // ── filters ───────────────────────────────────────────────────
  function passesRegion(a) {
    if (!showBerlin && !showBrandenburg) return true;
    const r = detectRegion(a);
    if (showBerlin && r === "Berlin") return true;
    if (showBrandenburg && r === "Brandenburg") return true;
    return false;
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
    const arts = $articles.filter(passesRegion);
    if (!arts.length) {
      placed = [];
      counts = {};
      return;
    }
    if (!categories.length) {
      placed = [];
      return;
    }

    const parsed = arts.flatMap((a) => {
      const d = parseDateLoose(a.ExtractedDate || a.Date);
      if (!d) return [];
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
      .domain([new Date(+dMin - span * 0.01), new Date(+dMax + span * 0.01)])
      .range(reversed ? [W - H_PAD, H_PAD] : [H_PAD, W - H_PAD]);

    ticks = xScale.ticks(d3.timeMonth.every(1)).map((d) => ({
      x: xScale(d),
      isYear: d.getMonth() === 0,
      isQuarter: d.getMonth() % 3 === 0,
      month: d.toLocaleString($lang === "de" ? "de-DE" : "en-GB", { month: "short" }),
      label: d.getFullYear(),
    }));

    const preItems = [];
    /** @type {Record<string,number>} */ const newCounts = {};

    for (const cat of categories) {
      const colorIdx = categories.indexOf(cat);
      const catItems = parsed
        .filter((p) => matchesCategory(p.raw, cat))
        .map((p) => ({ ...p, catId: cat.id, colorIdx, active: cat.on }));
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
      const colorIdx = categories.indexOf(cat);
      const descLines = cat.desc ? wrapText(cat.desc, WRAP_CHARS) : [];
      if (!items.length)
        return { cat, x: H_PAD, colorIdx, hasTick: false, descLines };
      const first = items.reduce((a, b) => (a.x < b.x ? a : b));
      return {
        cat,
        x: Math.max(H_PAD, first.x),
        colorIdx,
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

  function exportSVG() {
    if (!svgEl) return;
    exporting = true;
    const clone = /** @type {SVGSVGElement} */ (svgEl.cloneNode(true));
    clone.setAttribute("width", String(dataSvgW));
    clone.setAttribute("height", String(svgH));
    clone.querySelector(".zoom-group")?.setAttribute("transform", "");
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
    clone.setAttribute("height", String(svgH));
    clone.querySelector(".zoom-group")?.setAttribute("transform", "");
    const s = new XMLSerializer().serializeToString(clone);
    const canvas = document.createElement("canvas");
    canvas.width = dataSvgW;
    canvas.height = svgH;
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
            <TimelineItems {placed} baseline={baseline()} {translatedMap} lang={$lang} catColors={CAT_COLORS} />
            <CategoryMarkers {catMarkers} {counts} baseline={baseline()} {translatedMap} lang={$lang} catColors={CAT_COLORS} />
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
    catColors={CAT_COLORS}
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
