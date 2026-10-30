<script>
  import { articles } from "$lib/stores";
  import { loadReportTranslations } from "$lib/utils/reportTranslations";
  import { CATEGORIES } from "$lib/constants/categories.js";
  import { CHAR_RATIO } from "../timeline-categorical/config.js";
  import { buildItems, stackOrder, streamShades } from "../timeline-compact/streamItems.js";
  import { paper, streamChart } from "../timeline-compact/streamChart.js";
  import { place } from "../timeline-compact/streamCanvas.js";
  import { ASCENT, DESCENT, LINE_RATIO, DEFAULTS } from "../timeline-compact/config.js";

  const PRINT = {
    ...DEFAULTS, // see timeline-compact/config.js
    snippet: 73, // "snippets … characters" in the panel
  };
  const COLOR = { in: "#000", out: "#dcdcdc", current: "#f00" };
  const WIDTH = "28vw"; // of the box in the corner
  const MARGIN = 8; // px
  const MARK = 4; // px, the outline that keeps the red visible in a small box

  let { reports, current } = $props();

  let translations = $state.raw(null);
  $effect(() => {
    loadReportTranslations().then((map) => (translations = map));
  });

  const graph = $derived.by(() => {
    if (!$articles.length || !translations) return null;
    const sheet = paper(PRINT);
    const { items, counts } = buildItems($articles, CATEGORIES, {
      start: sheet.start,
      end: sheet.end,
      showBerlin: PRINT.showBerlin,
      showBrandenburg: PRINT.showBrandenburg,
    });
    const order = stackOrder(CATEGORIES, counts, PRINT.stackMode);
    const chart = streamChart(items, CATEGORIES, PRINT, {
      paper: sheet,
      shades: streamShades(order),
      order,
      translatedMap: translations,
      snip: PRINT.snippet,
    });
    if (!chart) return null;
    const band = { height: LINE_RATIO, ascent: ASCENT, descent: DESCENT };
    const { texts } = place(chart, { charRatio: CHAR_RATIO, band });
    const shapes = new Map(); // report -> its rectangles
    for (const t of texts) {
      if (!t.report) continue;
      const list = shapes.get(t.report.raw) ?? [];
      shapes.set(t.report.raw, [...list, ...t.bands.map((b) => b.pts)]);
    }
    return { W: chart.W, H: chart.H, shapes };
  });

  let base = $state(null); // black and grey: only redrawn when the pile changes
  let marker = $state(null); // red: redrawn for every sheet
  let width = $state(0);
  const scale = $derived(graph ? (width - 2 * MARGIN) / graph.W : 1);

  // a canvas emptied and scaled so the print fits it
  function prepare(canvas) {
    const height = width * (graph.H / graph.W);
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    const ctx = canvas.getContext("2d");
    ctx.setTransform(scale * dpr, 0, 0, scale * dpr, MARGIN * dpr, MARGIN * dpr);
    ctx.lineWidth = MARK / scale;
    ctx.lineJoin = "round";
    return ctx;
  }

  function fill(ctx, color, rectangles, outline = false) {
    ctx.fillStyle = ctx.strokeStyle = color;
    for (const pts of rectangles) {
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.closePath();
      ctx.fill();
      if (outline) ctx.stroke();
    }
  }

  $effect(() => {
    if (!base || !graph || !width) return;
    const ctx = prepare(base);
    const inPile = new Set(reports);
    const of = (keep) =>
      [...graph.shapes].filter(([r]) => inPile.has(r) === keep).flatMap(([, list]) => list);
    fill(ctx, COLOR.out, of(false));
    fill(ctx, COLOR.in, of(true));
  });

  $effect(() => {
    if (!marker || !graph || !width) return;
    fill(prepare(marker), COLOR.current, graph.shapes.get(current) ?? [], true);
  });
</script>

{#if graph}
  <div
    class="graph"
    style:width={WIDTH}
    style:aspect-ratio="{graph.W} / {graph.H}"
    bind:clientWidth={width}
  >
    <canvas bind:this={base}></canvas>
    <canvas bind:this={marker}></canvas>
  </div>
{/if}

<style>
  .graph {
    position: fixed;
    top: 16px;
    right: 16px;
    z-index: 1;
    background: #fff;
    border: 1px solid #000;
  }
  canvas {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
  }
</style>
