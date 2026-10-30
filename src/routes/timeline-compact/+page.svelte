<script>
  import { onMount, untrack } from "svelte";
  import * as d3 from "d3";
  import { articles } from "$lib/stores";
  import { loadArticles } from "$lib/utils/loadArticles";
  import { loadReportTranslations } from "$lib/utils/reportTranslations";
  import { CATEGORIES, GRADIENT_END_AT } from "$lib/constants/categories.js";
  import { CHAR_RATIO } from "../timeline-categorical/config.js";
  import { settings } from "../timeline-categorical/settings.svelte.js";
  import StreamPanel from "./StreamPanel.svelte";
  import { paper, streamChart } from "./streamChart.js";
  import { createRenderer } from "./streamCanvas.js";
  import { exportSvg } from "./streamSvg.js";
  import { buildItems, stackOrder, streamShades } from "./streamItems.js";
  import {
    CM,
    PX_PER_PT,
    FILE,
    ASCENT,
    DESCENT,
    LINE_RATIO,
    THEMES,
    DEFAULTS,
  } from "./config.js";

  const PAD = 12;

  let params = $state({ ...DEFAULTS });
  let categories = $state(CATEGORIES.map((c) => ({ ...c })));
  let highlightFade = $state(0.25);
  let translatedMap = $state.raw({});
  let translationsReady = $state(false);

  onMount(() => {
    const css = getComputedStyle(document.documentElement);
    const highlight = css.getPropertyValue("--highlight").trim();
    const fade = parseFloat(css.getPropertyValue("--highlight-fade"));
    if (Number.isFinite(fade)) highlightFade = fade;
    const highlightEnd = css.getPropertyValue("--highlight-end").trim();
    for (const c of categories) {
      if (c.type === "canonical") continue;
      if (highlight) c.color = highlight;
      if (highlightEnd) c.colorEnd = highlightEnd;
    }
    loadArticles();
    loadReportTranslations().then((map) => {
      translatedMap = map;
      translationsReady = true;
    });
  });

  let sheet = $derived(paper(params));
  let { start, end, FS, type, W, maxH, xOf } = $derived(sheet);

  let built = $derived(
    buildItems($articles, categories, {
      start,
      end,
      showBerlin: params.showBerlin,
      showBrandenburg: params.showBrandenburg,
    }),
  );
  let order = $derived(stackOrder(categories, built.counts, params.stackMode));
  let shades = $derived(streamShades(order));

  let chart = $derived(
    streamChart(built.items, categories, params, {
      paper: sheet,
      shades,
      order,
      translatedMap,
      snip: settings.SEGMENT_SNIP_MAX,
    }),
  );
  let totalH = $derived(chart ? chart.H + FS * 5 : 0);
  let tooTall = $derived(!!chart && totalH > maxH + 1);

  let years = $derived.by(() => {
    if (!chart) return [];
    const half = 2 * FS * 3 * CHAR_RATIO;
    const out = [];
    for (let y = start.getFullYear(); new Date(y, 0, 1) <= end; y++) {
      const x = xOf(new Date(y, 0, 1));
      out.push({ year: y, x, labelX: Math.max(half, Math.min(x, chart.W - half)) });
    }
    return out;
  });

  // the longest snippets with which the chart still fits the paper
  function fitSnippets() {
    let lo = Math.max(1, Number(params.minSnip) || 20),
      hi = Math.max(lo, 600);
    while (hi - lo > 2) {
      const mid = Math.round((lo + hi) / 2);
      settings.SEGMENT_SNIP_MAX = mid;
      if (tooTall) hi = mid;
      else lo = mid;
    }
    settings.SEGMENT_SNIP_MAX = lo;
  }

  let fitTimer;
  let fitKey = $derived.by(() => {
    const { dark, autoFit, ...layout } = params;
    return JSON.stringify([
      layout,
      categories.map((c) => c.on),
      $articles.length,
      translationsReady,
    ]);
  });
  let fittedKey = $state(null);
  let ready = $derived(
    !!$articles.length &&
      translationsReady &&
      (!params.autoFit || fittedKey === fitKey),
  );
  $effect(() => {
    const key = fitKey;
    if (!params.autoFit || !$articles.length || !translationsReady) return;
    clearTimeout(fitTimer);
    fitTimer = setTimeout(() => {
      fitSnippets();
      fittedKey = key;
    }, 60);
  });

  let canvasEl = $state(null);
  let viewW = $state(800);
  let viewH = $state(600);
  let view = d3.zoomIdentity;
  let renderer = null;
  const redraw = () => renderer?.draw(view);
  const zoomer = d3
    .zoom()
    .scaleExtent([0.005, PX_PER_PT])
    .on("zoom", (e) => {
      view = e.transform;
      redraw();
    });
  let look = $derived({
    ...THEMES[params.dark ? "dark" : "light"],
    years,
    yearSize: FS * 3,
    gradientEnd: GRADIENT_END_AT / 100,
  });

  $effect(() => {
    if (!canvasEl) return;
    renderer = createRenderer(canvasEl);
    d3.select(canvasEl).call(zoomer).on("dblclick.zoom", null);
    return () => (renderer = null);
  });
  $effect(() => {
    if (!canvasEl || !chart || !ready) return;
    const style = {
      charRatio: CHAR_RATIO,
      fade: highlightFade,
      band: { height: LINE_RATIO, ascent: ASCENT, descent: DESCENT },
    };
    untrack(() => {
      renderer?.set(chart, style, look);
      fitAll();
    });
    document.fonts?.ready.then(() => untrack(() => renderer?.look(look)));
  });
  $effect(() => {
    const l = look;
    untrack(() => renderer?.look(l));
  });
  $effect(() => {
    viewW;
    viewH;
    untrack(redraw);
  });

  function zoomTo(k) {
    if (canvasEl)
      d3.select(canvasEl).call(
        zoomer.transform,
        d3.zoomIdentity.translate(PAD, PAD).scale(k),
      );
  }
  const fitAll = () =>
    chart && zoomTo(Math.min((viewW - 2 * PAD) / chart.W, (viewH - 2 * PAD) / totalH));
  const fitHeight = () => chart && zoomTo((viewH - 2 * PAD) / totalH);
  const realSize = () => canvasEl && d3.select(canvasEl).call(zoomer.scaleTo, PX_PER_PT);

  const reportAt = (e) => {
    const r = canvasEl.getBoundingClientRect();
    return renderer?.reportAt(...view.invert([e.clientX - r.left, e.clientY - r.top]));
  };
  let pointer = $state(false);
  let downAt = null;
  function onClick(e) {
    if (downAt && Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 4) return;
    const url = reportAt(e)?.raw?.URL;
    if (url) window.open(url, "_blank", "noreferrer");
  }

  // e.g. 700x450cm_25pt_de-en_berlin-brandenburg
  function fileName(ext) {
    const cm = (v) => Math.round(v / CM);
    const lang = params.langMode === "both" ? "de-en" : params.langMode;
    const districts = [params.showBerlin && "berlin", params.showBrandenburg && "brandenburg"]
      .filter(Boolean)
      .join("-");
    return `${cm(chart.W)}x${cm(totalH)}cm_${FS}pt_${lang}_${districts}.${ext}`;
  }

  let exportingPdf = $state(false);
  async function exportPDF() {
    if (!chart || !renderer) return;
    exportingPdf = true;
    await new Promise((r) => setTimeout(r, 30));
    try {
      const { exportPdf } = await import("./streamPdf.js");
      await exportPdf({
        W: chart.W,
        H: totalH,
        chartH: chart.H,
        texts: renderer.texts(),
        look,
        file: fileName("pdf"),
      });
    } finally {
      exportingPdf = false;
    }
  }
  function exportSVG() {
    if (!chart) return;
    exportSvg({
      chart,
      H: totalH,
      bands: renderer?.bands() ?? [],
      look,
      charRatio: CHAR_RATIO,
      fade: highlightFade,
      file: fileName("svg"),
    });
  }
</script>

<div class="page">
  <div class="chart-wrap" bind:clientWidth={viewW} bind:clientHeight={viewH}>
    {#if !ready}
      <p class="overlay">{$articles.length ? "Preparing…" : "Loading…"}</p>
    {/if}
    {#if $articles.length && chart}
      <canvas
        bind:this={canvasEl}
        class:pointer
        onmousemove={(e) => (pointer = !!reportAt(e)?.raw?.URL)}
        onmousedown={(e) => (downAt = [e.clientX, e.clientY])}
        onclick={onClick}
      ></canvas>
    {/if}
  </div>

  <StreamPanel
    bind:params
    bind:categories
    counts={built.counts}
    {shades}
    {type}
    {chart}
    paperCm={ready ? [Math.round(W / CM), Math.round(totalH / CM)] : null}
    fitting={!!$articles.length && !ready}
    {tooTall}
    {exportingPdf}
    onFit={fitAll}
    onFitHeight={fitHeight}
    onRealSize={realSize}
    onFitSnippets={fitSnippets}
    onExportPdf={exportPDF}
    onExportSvg={exportSVG}
  />
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
  }
  .chart-wrap {
    position: relative;
    flex: 1;
    min-width: 0;
    overflow: hidden;
  }
  canvas {
    display: block;
    width: 100%;
    height: 100%;
    cursor: grab;
  }
  canvas.pointer {
    cursor: pointer;
  }
  .overlay {
    position: absolute;
    inset: 0;
    z-index: 1;
    margin: 0;
    padding: 32px;
    background: #fff;
    color: #aaa;
    font-size: 13px;
    font-family: var(--font-mono);
  }
</style>
