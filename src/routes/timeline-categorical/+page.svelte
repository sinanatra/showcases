<script>
  import { onMount, tick } from "svelte";
  import * as d3 from "d3";
  import { articles } from "$lib/stores";
  import { loadArticles } from "$lib/utils/loadArticles";
  import { parseDateLoose } from "$lib/utils/parseDate";
  import { detectRegion } from "$lib/utils/detectRegion";
  import { normalizeDistrict } from "$lib/constants/districts";
  import CatPanel from "./CatPanel.svelte";
  import TimelineGrid from "./TimelineGrid.svelte";
  import TimelineItems from "./TimelineItems.svelte";
  import CategoryMarkers from "./CategoryMarkers.svelte";
  import { jsPDF } from "jspdf";
  import {
    TOP_PAD, H_PAD, PX_PER_DAY, LINE_H, LINE_H_BOTH, CHAR_W, DIST_CW, DIST_GAP,
    AXIS_PAD, MARKER_LABEL_DY, MARKER_LABEL_FS,
    PDF_WIDTH_CM, PDF_HEIGHT_CM,
    DEFAULT_CATEGORIES,
    DEFAULT_SHOW_BERLIN, DEFAULT_SHOW_BRANDENBURG,
    DEFAULT_REVERSED, DEFAULT_TEXT_ALIGN,
  } from "./config.js";
import { matchesCategory, snippetSegments, placeItems, groupBranchesBySentence } from "./catTimeline.js";

  let categories    = $state(DEFAULT_CATEGORIES.map(c => ({ ...c })));
  let showBerlin    = $state(DEFAULT_SHOW_BERLIN);
  let showBrandenburg = $state(DEFAULT_SHOW_BRANDENBURG);
  /** @type {"de"|"en"|"both"} */ let langMode = $state("both");

  const SIDEBAR_W = 220;

  const reversed = DEFAULT_REVERSED;
  const textAlign = DEFAULT_TEXT_ALIGN;

  // Mutable so a custom PDF width+height (see exportPDF) can re-lay-out the
  // chart itself — spreading dates out (or packing them tighter) shifts how
  // many rows the greedy packer needs, which is what actually changes the
  // chart's aspect ratio — instead of just stretching a fixed layout to fit.
  let pxPerDay = $state(PX_PER_DAY);

  /** @type {Record<string,string>} */ let translatedMap = $state({});
  async function loadTranslations() {
    try {
      const res = await fetch("/translations.json");
      if (!res.ok) return;
      translatedMap = await res.json();
    } catch {}
  }

  // ── filters ───────────────────────────────────────────────────
  function passesRegion(a) {
    if (!showBerlin && !showBrandenburg) return true;
    const r = detectRegion(a);
    if (showBerlin && r === "Berlin") return true;
    if (showBrandenburg && r === "Brandenburg") return true;
    return false;
  }

  function passesBilanz(a) {
    return !/bilanz/i.test(a.Title || "");
  }

  // ── state ─────────────────────────────────────────────────────
  let hasInitialFit = false;
  /** @type {any[]} */ let ticks = $state([]);
  /** @type {any[]} */ let placed = $state([]);
  /** @type {any[]} */ let branchPaths = $state([]);
  /** @type {any[]} */ let debugPaths = $state([]);
  /** @type {Record<string,number>} */ let counts = $state({});
  let dataSvgW = $state(4000);
  let svgH = $state(600);
  let baselineY = $state(480);

  const baseline = () => baselineY;

  /** @type {any[]} */ let builtItems = [];
  /** @type {any[]} */ let branchCats = [];

  function computeItems() {
    const arts = $articles.filter(a => passesRegion(a) && passesBilanz(a));
    if (!arts.length || !categories.length) {
      builtItems = [];
      counts = {};
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
          district: normalizeDistrict(a.ExtractedDistrict, detectRegion(a)),
        },
      ];
    });
    if (!parsed.length) {
      builtItems = [];
      return;
    }

    branchCats = categories.filter((c) => c.type === "canonical");
    const highlightCats = categories.filter((c) => c.type !== "canonical");

    const items = [];
    /** @type {Record<string,number>} */ const newCounts = {};
    for (const cat of categories) newCounts[cat.id] = 0;

    for (const p of parsed) {
      const matchedBranches = branchCats.filter((cat) => matchesCategory(p.raw, cat));
      if (!matchedBranches.length) continue; // no PMK category → not shown

      const matchedHighlight = highlightCats.find(
        (cat) => cat.on && matchesCategory(p.raw, cat),
      );
      if (matchedHighlight) newCounts[matchedHighlight.id]++;

     
      for (const catIds of groupBranchesBySentence(p, matchedBranches)) {
        for (const id of catIds) newCounts[id]++;
        const primaryCat = matchedBranches.find((c) => c.id === catIds[0]);
        const pre = {
          ...p,
          catId: catIds[0],
          catIds,
          color: matchedHighlight ? matchedHighlight.color : primaryCat.color,
          highlightId: matchedHighlight?.id ?? null,
        };
        items.push({ ...pre, segments: snippetSegments(pre, categories) });
      }
    }

    builtItems = items;
    counts = newCounts;
  }

  function layout(ignoreMinWidth = false) {
    if (!builtItems.length) {
      placed = [];
      ticks = [];
      branchPaths = [];
      return;
    }

    const onCatIds = new Set(categories.filter((c) => c.on).map((c) => c.id));
    const visibleItems = [];
    for (const it of builtItems) {
      const segs = it.segments.filter((s) => s.on !== false);
      if (!segs.length) continue;
      const catIds = it.catIds.filter((id) => onCatIds.has(id));
      visibleItems.push({ ...it, segments: segs, catIds: catIds.length ? catIds : it.catIds });
    }
    if (!visibleItems.length) {
      placed = [];
      ticks = [];
      branchPaths = [];
      return;
    }

    const allDates = visibleItems.map((p) => +p.date);
    const dMin = new Date(Math.min(...allDates));
    const dMax = new Date(Math.max(...allDates));
    const days = (+dMax - +dMin) / 86400000;

    const minW = ignoreMinWidth
      ? 0
      : typeof window !== "undefined"
        ? window.innerWidth - SIDEBAR_W
        : 1200;
    const W = Math.max(minW, Math.ceil(days * pxPerDay) + 2 * H_PAD);
    dataSvgW = W;

    const xScale = d3
      .scaleTime()
      .domain([new Date(dMin.getFullYear(), 0, 1), dMax])
      .range(reversed ? [W - H_PAD, H_PAD] : [H_PAD, W - H_PAD]);

    const pad2 = (/** @type {number} */ n) => String(n).padStart(2, "0");
    const makeTick = (/** @type {Date} */ d) => ({
      x: xScale(d),
      isYear: d.getMonth() === 0,
      label: `${pad2(d.getDate())}-${pad2(d.getMonth() + 1)}-${pad2(d.getFullYear() % 100)}`,
    });
    const monthTicks = xScale.ticks(d3.timeMonth.every(1)).map(makeTick);
    const lastTick = makeTick(dMax);
    const lastMonthX = monthTicks.at(-1)?.x ?? -Infinity;
    const majorTicks = Math.abs(lastTick.x - lastMonthX) > 4
      ? [...monthTicks, lastTick]
      : monthTicks;

    const midTicks = majorTicks.slice(0, -1).map((t, i) => ({
      x: (t.x + majorTicks[i + 1].x) / 2,
      isWeek: true,
    }));

    ticks = [...majorTicks, ...midTicks];

    const labelFn = (it) =>
      it.segments
        .map((s) => {
          const translated = translatedMap[s.text];
          const de = langMode !== "en" || !translated ? s.text : "";
          const en = langMode !== "de" && translated ? translated : "";
          return `${de}${en}`;
        })
        .join(" ");
    const itemWidth = (it) => {
      const districtW = it.district ? Math.ceil(it.district.length * DIST_CW) + DIST_GAP : 0;
      const itemTw = (it.segments?.length ? it.segments : [{ text: it.label }]).reduce((sum, s) => {
        const translated = translatedMap[s.text];
        const showEn = langMode !== "de" && !!translated;
        const showDe = langMode !== "en" || !translated;
        const de = showDe ? s.text : "";
        const en = showEn ? translated : "";
        const stacked = langMode === "both" && !!de && !!en;
        const tw = stacked
          ? Math.ceil(Math.max(de.length, en.length) * CHAR_W)
          : Math.ceil((de.length + en.length) * CHAR_W);
        return sum + tw;
      }, 0);
      return districtW + itemTw;
    };
    const rowH = langMode === "both" ? LINE_H_BOTH : LINE_H;
    const placedRaw = placeItems(visibleItems, xScale, labelFn, textAlign, rowH, itemWidth);

    const usedRows = [...new Set(placedRaw.map((p) => Math.round(p.y / rowH - 0.2)))].sort((a, b) => a - b);
    const rowRank = new Map(usedRows.map((r, i) => [r, i]));
    const allPlaced = placedRaw.map((p) => ({
      ...p,
      y: (/** @type {number} */ (rowRank.get(Math.round(p.y / rowH - 0.2))) + 0.2) * rowH,
    }));

    const maxY = allPlaced.reduce((m, p) => Math.max(m, p.y + rowH), 0);
    const bl = TOP_PAD + maxY;
    baselineY = bl;
    placed = allPlaced;

    // ── branch labels ────────────────────────────────────────────
    const LABEL_CLEARANCE = 50;
    const OUTLIER_PX = 100;
    const LABEL_CW = MARKER_LABEL_FS * 1.1;
    const LABEL_GAP_PX = 40;
    const MAX_TILT_DEG = 130;
    const MAX_REPEATS = 3;
    const LABEL_START_RATIO = 0.3;

    /** @param {any} cat */
    const wordsFor = (cat) => {
      if (langMode === "de") return [cat.labelDe || cat.label];
      if (langMode === "en") return [cat.label];
      return [cat.labelDe || cat.label, cat.label];
    };

    /** @type {any[]} */ const debugList = [];
    /** @type {any[]} */ const labels = [];
    /** @type {any[]} */ const labelBounds = [];

    for (const cat of branchCats.filter((c) => c.on)) {
      const items = allPlaced
        .filter((p) => p.catId === cat.id)
        .sort((a, b) => a.x - b.x);
      if (!items.length) continue;

      const raw = items.map((it) => ({ x: it.x, y: bl - it.y }));
      /** @type {any[]} */ const trend = [raw[0]];
      let stuck = 0;
      for (let i = 1; i < raw.length; i++) {
        const prev = trend[trend.length - 1];
        if (Math.abs(raw[i].y - prev.y) > OUTLIER_PX) {
          stuck++;
          if (stuck < 3) continue;
        }
        trend.push(raw[i]);
        stuck = 0;
      }
      if (trend.length < 2) continue;

      const pathD = d3.line()
        .x(/** @param {any} p */ (p) => p.x)
        .y(/** @param {any} p */ (p) => p.y)
        .curve(d3.curveMonotoneX)(trend);
      debugList.push({ id: `debug-run-${cat.id}`, d: pathD, color: cat.color ?? "red" });

      /** @type {number[]} */ const segLens = [];
      let length = 0;
      for (let i = 1; i < trend.length; i++) {
        const l = Math.hypot(trend[i].x - trend[i - 1].x, trend[i].y - trend[i - 1].y);
        segLens.push(l);
        length += l;
      }
      if (!length) continue;

      const pointAt = (/** @type {number} */ offset) => {
        let acc = 0;
        for (let i = 0; i < segLens.length; i++) {
          if (acc + segLens[i] >= offset || i === segLens.length - 1) {
            const t = segLens[i] ? (offset - acc) / segLens[i] : 0;
            const a = trend[i], b = trend[i + 1];
            return {
              x: a.x + (b.x - a.x) * Math.min(1, Math.max(0, t)),
              y: a.y + (b.y - a.y) * Math.min(1, Math.max(0, t)),
              dx: b.x - a.x, dy: b.y - a.y,
            };
          }
          acc += segLens[i];
        }
        const a = trend[trend.length - 2], b = trend[trend.length - 1];
        return { x: b.x, y: b.y, dx: b.x - a.x, dy: b.y - a.y };
      };

      const words = wordsFor(cat);
      for (let wi = 0; wi < MAX_REPEATS; wi++) {
        const word = words[wi % words.length];
        const halfW = (word.length * LABEL_CW) / 2;
        const progress = MAX_REPEATS > 1 ? wi / (MAX_REPEATS - 1) : 0;
        const labelStart = length * LABEL_START_RATIO +
          (length * (1 - LABEL_START_RATIO) - halfW * 2) * progress;
        const offset = labelStart + halfW;
        const p = pointAt(offset);
        const tiltDeg = Math.abs(Math.atan2(p.dy, p.dx) * 180 / Math.PI);

        if (tiltDeg <= MAX_TILT_DEG) {
          const segStart = offset - halfW;
          const segEnd = offset + halfW;
          const SUB_SAMPLES = 5;
          /** @type {any[]} */ const subPts = [];
          for (let s = 0; s < SUB_SAMPLES; s++) {
            const off = segStart + ((segEnd - segStart) * s) / (SUB_SAMPLES - 1);
            const sp = pointAt(off);
            subPts.push({ x: sp.x, y: sp.y - LABEL_CLEARANCE });
          }
          const d = d3.line()
            .x(/** @param {any} sp */ (sp) => sp.x)
            .y(/** @param {any} sp */ (sp) => sp.y)
            .curve(d3.curveCatmullRom.alpha(1.8))(subPts);
          let pathLen = 0;
          for (let s = 1; s < subPts.length; s++)
            pathLen += Math.hypot(subPts[s].x - subPts[s - 1].x, subPts[s].y - subPts[s - 1].y);
          const collisionPad = MARKER_LABEL_FS * 0.65;
          const bounds = {
            left: Math.min(...subPts.map((sp) => sp.x)) - collisionPad,
            right: Math.max(...subPts.map((sp) => sp.x)) + collisionPad,
            top: Math.min(...subPts.map((sp) => sp.y)) + MARKER_LABEL_DY - collisionPad,
            bottom: Math.max(...subPts.map((sp) => sp.y)) + MARKER_LABEL_DY + collisionPad,
          };
          const overlapsLabel = labelBounds.some((other) =>
            bounds.left < other.right && bounds.right > other.left &&
            bounds.top < other.bottom && bounds.bottom > other.top,
          );
          if (!overlapsLabel) {
            labels.push({ cat, id: `branch-label-${cat.id}-${labels.length}`, d, startOffset: pathLen / 2, text: word });
            labelBounds.push(bounds);
            debugList.push({ id: `debug-seg-${labels.length}`, d, color: "red", thick: true });
          }
        }
      }
    }

    branchPaths = labels;
    debugPaths = debugList;

    svgH = bl + AXIS_PAD;

    if (!hasInitialFit) { hasInitialFit = true; requestAnimationFrame(fitContent); }
  }

  function build() {
    computeItems();
    layout();
  }

  $effect(() => {
    for (const c of categories) {
      void c.on;
      void c.label;
      void c.query;
      void c.type;
    }
    void categories.length;
    void showBerlin;
    void showBrandenburg;
    if ($articles.length) build();
  });

  // Language mode / translations change the width of every box on screen,
  // so re-layout (not a full re-match) is enough to keep spacing correct.
  $effect(() => {
    void langMode;
    void translatedMap;
    if (builtItems.length) layout();
  });

  let fitDebounceTimer = /** @type {ReturnType<typeof setTimeout>|null} */ (null);
  $effect(() => {
    const w = pdfWidthCm, h = pdfHeightCm;
    if (fitDebounceTimer) clearTimeout(fitDebounceTimer);
    if (!w || !h || !builtItems.length) return;
    fitDebounceTimer = setTimeout(() => fitChartToRatio(w / h), 400);
  });

  onMount(() => {
    loadArticles();
    loadTranslations();
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
    // Widen the scaleExtent floor to include the fit scale first — otherwise d3 silently
    // clamps transform() to the old floor, desyncing it from the computed (tx, ty).
    zoomBehavior.scaleExtent([Math.min(0.1, scale), 10]);
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
  let exportingPdf = $state(false);
  /** UI-editable PDF page size (cm); null = auto. Seeded from config.js defaults. */
  let pdfWidthCm = $state(PDF_WIDTH_CM);
  let pdfHeightCm = $state(PDF_HEIGHT_CM);

  /** Cached base64 font data so we only fetch once per session. */
  let _fontB64 = /** @type {string|null} */ (null);
  /** Same font, pre-converted to TTF (quadratic outlines) for PDF embedding — see exportPDF. */
  let _fontTtfB64 = /** @type {string|null} */ (null);

  async function injectFontStyle(clone) {
    if (!_fontB64) {
      const buf = await (await fetch('/fonts/Pitch_Semibold.otf')).arrayBuffer();
      const bytes = new Uint8Array(buf);
      let bin = '';
      for (const b of bytes) bin += String.fromCharCode(b);
      _fontB64 = btoa(bin);
    }
    const ns = 'http://www.w3.org/2000/svg';
    let defs = clone.querySelector('defs');
    if (!defs) {
      defs = document.createElementNS(ns, 'defs');
      clone.insertBefore(defs, clone.firstChild);
    }
    const style = document.createElementNS(ns, 'style');
    style.textContent = [
      ':root, svg { --font-mono: "Pitch Sans", Courier, monospace; }',
      '@font-face {',
      '  font-family: "Pitch Sans";',
      `  src: url("data:font/otf;base64,${_fontB64}") format("opentype");`,
      '  font-weight: 600; font-style: normal;',
      '}',
    ].join('\n');
    defs.insertBefore(style, defs.firstChild);
  }

  /**
   * fitContent() sizes the zoom viewport to (dataSvgW × svgH), but actual
   * content — long district labels hanging left of an item, branch-curve
   * label placement extrapolating past the plotted range — can spill
   * slightly outside that nominal box, most visibly at the timeline's start
   * where items sit close to x=0. Exports need the *real* bounds so nothing
   * at the edges gets clipped by the SVG/canvas/PDF viewport.
   */
  function getContentBounds() {
    const fallback = { minX: 0, minY: 0, maxX: dataSvgW, maxY: svgH };
    if (!svgEl) return fallback;
    const group = /** @type {SVGGraphicsElement|null} */ (svgEl.querySelector(".zoom-group"));
    if (!group || typeof group.getBBox !== "function") return fallback;
    try {
      const bbox = group.getBBox();
      return {
        minX: Math.min(0, bbox.x),
        minY: Math.min(0, bbox.y),
        maxX: Math.max(dataSvgW, bbox.x + bbox.width),
        maxY: Math.max(svgH, bbox.y + bbox.height),
      };
    } catch {
      return fallback;
    }
  }

  async function exportSVG() {
    if (!svgEl) return;
    exporting = true;
    const clone = /** @type {SVGSVGElement} */ (svgEl.cloneNode(true));
    clone.querySelector(".zoom-group")?.setAttribute("transform", "");
    const { minX, minY, maxX, maxY } = getContentBounds();
    const width = maxX - minX;
    const height = maxY - minY;
    clone.setAttribute("viewBox", `${minX} ${minY} ${width} ${height}`);
    clone.setAttribute("width", String(width));
    clone.setAttribute("height", String(height));
    await injectFontStyle(clone);
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

  /** Rasterizes the chart to a canvas at up to 3× scale, within Chrome's canvas limits. */
  async function renderCanvas() {
    if (!svgEl) return null;
    const clone = /** @type {SVGSVGElement} */ (svgEl.cloneNode(true));
    clone.querySelector(".zoom-group")?.setAttribute("transform", "");
    const { minX, minY, maxX, maxY } = getContentBounds();
    const totalW = maxX - minX;
    const totalH = maxY - minY;

    {
      const ns = "http://www.w3.org/2000/svg";
      let defs = clone.querySelector("defs");
      if (!defs) { defs = document.createElementNS(ns, "defs"); clone.insertBefore(defs, clone.firstChild); }
      const style = document.createElementNS(ns, "style");
      style.textContent = ':root, svg { --font-mono: "Pitch Sans", Courier, monospace; }';
      defs.insertBefore(style, defs.firstChild);
    }

    // Scale up to 3× but stay within Chrome's canvas limits:
    // 32 767 px per side, 268 M px total area.
    const MAX_DIM  = 32767;
    const MAX_AREA = 268_000_000;
    const scale = Math.min(
      3,
      MAX_DIM / totalW,
      MAX_DIM / totalH,
      Math.sqrt(MAX_AREA / (totalW * totalH)),
    );
    const outW = Math.round(totalW * scale);
    const outH = Math.round(totalH * scale);
    clone.setAttribute("viewBox", `${minX} ${minY} ${totalW} ${totalH}`);
    clone.setAttribute("width",  String(outW));
    clone.setAttribute("height", String(outH));

    const s = new XMLSerializer().serializeToString(clone);
    const svgBlob = new Blob([s], { type: "image/svg+xml" });
    const svgUrl = URL.createObjectURL(svgBlob);
    const img = new Image();
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = svgUrl;
    });
    URL.revokeObjectURL(svgUrl);

    const canvas = document.createElement("canvas");
    canvas.width  = outW;
    canvas.height = outH;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, outW, outH);
      ctx.drawImage(img, 0, 0, outW, outH);
    }
    return { canvas, outW, outH };
  }

  async function exportPNG() {
    exportingPng = true;
    const rendered = await renderCanvas();
    if (rendered) {
      const { canvas } = rendered;
      await new Promise((resolve) => {
        canvas.toBlob((pngBlob) => {
          if (!pngBlob) { resolve(); return; }
          const pngUrl = URL.createObjectURL(pngBlob);
          Object.assign(document.createElement("a"), {
            href: pngUrl, download: "timeline-categories.png",
          }).click();
          setTimeout(() => URL.revokeObjectURL(pngUrl), 1000);
          resolve();
        }, "image/png");
      });
    }
    exportingPng = false;
  }

  /**
   * svg2pdf.js has no support for <textPath>, so the curved branch labels
   * (drawn along a bent micro-path, see `labels.push` in layout()) can't be
   * handed to it as-is. Instead we manually lay out each character along the
   * same path — position + tangent read via the browser's native path
   * geometry (getPointAtLength) — which reproduces the curve using plain,
   * individually rotated <text> glyphs that svg2pdf can render.
   */
  function flattenBranchLabels(clone) {
    const ns = "http://www.w3.org/2000/svg";
    const textPaths = clone.querySelectorAll("text > textPath");
    if (!textPaths.length) return;

    const measureSvg = document.createElementNS(ns, "svg");
    measureSvg.style.cssText = "position:absolute;width:0;height:0;overflow:hidden;";
    const measurePath = document.createElementNS(ns, "path");
    measureSvg.appendChild(measurePath);
    document.body.appendChild(measureSvg);

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) { document.body.removeChild(measureSvg); return; }
    // svg2pdf.js ignores `paint-order` and always paints fill then stroke, so
    // a single element with both would draw the white halo *over* the black
    // fill and eat into the glyph. Emulate stroke-then-fill by hand instead:
    // one stroke-only halo element, followed by a fill-only element on top.
    const HALO_ATTRS = ["dy", "font-size", "stroke", "stroke-width"];
    const FILL_ATTRS = ["dy", "font-size", "fill", "style"];

    textPaths.forEach((textPathEl) => {
      const textEl = textPathEl.parentNode;
      const href = textPathEl.getAttribute("href") ||
        textPathEl.getAttributeNS("http://www.w3.org/1999/xlink", "href");
      const bp = branchPaths.find((b) => `#${b.id}` === href);
      if (!bp) { textEl.remove(); return; }

      measurePath.setAttribute("d", bp.d);
      const len = measurePath.getTotalLength();
      const fontSize = parseFloat(textEl.getAttribute("font-size")) || MARKER_LABEL_FS;
      ctx.font = `${fontSize}px Courier, monospace`;
      const word = bp.text;
      const totalW = ctx.measureText(word).width;
      const hasHalo = textEl.getAttribute("stroke") && textEl.getAttribute("stroke") !== "none";

      const frag = document.createDocumentFragment();
      let cursor = bp.startOffset - totalW / 2;
      for (const ch of word) {
        const chW = ctx.measureText(ch).width;
        const mid = Math.min(Math.max(cursor + chW / 2, 0), len);
        const p0 = measurePath.getPointAtLength(mid);
        const p1 = measurePath.getPointAtLength(Math.min(mid + 0.5, len));
        const angle = (Math.atan2(p1.y - p0.y, p1.x - p0.x) * 180) / Math.PI;
        const transform = `translate(${p0.x},${p0.y}) rotate(${angle})`;

        if (hasHalo) {
          const halo = document.createElementNS(ns, "text");
          for (const attr of HALO_ATTRS) {
            const v = textEl.getAttribute(attr);
            if (v != null) halo.setAttribute(attr, v);
          }
          halo.setAttribute("fill", "none");
          halo.setAttribute("text-anchor", "middle");
          halo.setAttribute("transform", transform);
          halo.textContent = ch;
          frag.appendChild(halo);
        }

        const t = document.createElementNS(ns, "text");
        for (const attr of FILL_ATTRS) {
          const v = textEl.getAttribute(attr);
          if (v != null) t.setAttribute(attr, v);
        }
        t.setAttribute("text-anchor", "middle");
        t.setAttribute("transform", transform);
        t.textContent = ch;
        frag.appendChild(t);
        cursor += chW;
      }
      textEl.replaceWith(frag);
    });

    document.body.removeChild(measureSvg);
  }

  async function fitChartToRatio(targetRatio) {
    if (!builtItems.length || !Number.isFinite(targetRatio) || targetRatio <= 0) return;
    let lo = 0.5, hi = 2000;
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2;
      pxPerDay = mid;
      layout(true);
      const ratio = dataSvgW / svgH;
      if (ratio > targetRatio) hi = mid; else lo = mid;
    }
    pxPerDay = (lo + hi) / 2;
    layout(true);
    await tick();
    requestAnimationFrame(fitContent);
  }

  async function exportPDF() {
    if (!svgEl) return;
    exportingPdf = true;
    try {
      // svg2pdf.js touches browser globals on import, so it must stay out of
      // the SSR bundle — load it lazily, client-side only.
      await import("svg2pdf.js");

      // A width *and* height (cm) together imply a specific target ratio —
      // re-lay-out the chart itself to match it (see fitChartToRatio) rather
      // than stretching a fixed layout onto a differently-shaped page.
      if (pdfWidthCm && pdfHeightCm) {
        await fitChartToRatio(pdfWidthCm / pdfHeightCm);
      }

      const clone = /** @type {SVGSVGElement} */ (svgEl.cloneNode(true));
      clone.querySelector(".zoom-group")?.setAttribute("transform", "");
      const { minX, minY, maxX, maxY } = getContentBounds();
      const totalW = maxX - minX;
      const totalH = maxY - minY;
      clone.setAttribute("width", String(totalW));
      clone.setAttribute("height", String(totalH));
      clone.setAttribute("viewBox", `${minX} ${minY} ${totalW} ${totalH}`);

      flattenBranchLabels(clone);

      // svg2pdf can't resolve CSS custom properties, so resolve the font
      // stack by hand: real embedded Pitch Sans first, standard Courier as
      // the fallback svg2pdf uses if a glyph is missing from our font.
      clone.querySelectorAll("[style]").forEach((el) => {
        const s = el.getAttribute("style");
        if (s && s.includes("var(--font-mono)")) {
          el.setAttribute("style", s.replace(/var\(--font-mono\)/g, '"Pitch Sans", Courier, monospace'));
        }
      });

      const PX_TO_PT = 0.75;
      const CM_TO_PT = 28.3465;
      const MAX_PDF_PT = 14400;
      const aspect = totalW / totalH;
      let outW, outH;
      if (pdfWidthCm) {
        outW = pdfWidthCm * CM_TO_PT;
        outH = outW / aspect;
      } else if (pdfHeightCm) {
        outH = pdfHeightCm * CM_TO_PT;
        outW = outH * aspect;
      } else {
        const scale = Math.min(1, MAX_PDF_PT / (Math.max(totalW, totalH) * PX_TO_PT));
        outW = totalW * PX_TO_PT * scale;
        outH = totalH * PX_TO_PT * scale;
      }
      if (Math.max(outW, outH) > MAX_PDF_PT) {
        const clampScale = MAX_PDF_PT / Math.max(outW, outH);
        outW *= clampScale;
        outH *= clampScale;
      }

      const pdf = new jsPDF({
        orientation: outW >= outH ? "landscape" : "portrait",
        unit: "pt",
        format: [outW, outH],
        compress: true,
      });

      // jsPDF only embeds TrueType (glyf) outlines, but our webfont is a
      // CFF-flavored .otf — Pitch_Semibold.ttf is a pre-converted (quadratic
      // outline) copy of the same font kept alongside it for this purpose.
      const ttfB64 = await (async () => {
        if (!_fontTtfB64) {
          const buf = await (await fetch("/fonts/Pitch_Semibold.ttf")).arrayBuffer();
          const bytes = new Uint8Array(buf);
          let bin = "";
          for (const b of bytes) bin += String.fromCharCode(b);
          _fontTtfB64 = btoa(bin);
        }
        return _fontTtfB64;
      })();
      pdf.addFileToVFS("PitchSans-Semibold.ttf", ttfB64);
      pdf.addFont("PitchSans-Semibold.ttf", "Pitch Sans", "normal");
      pdf.addFont("PitchSans-Semibold.ttf", "Pitch Sans", "bold");

      await pdf.svg(clone, { x: 0, y: 0, width: outW, height: outH });
      pdf.save("timeline-categories.pdf");
    } finally {
      exportingPdf = false;
    }
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
            <CategoryMarkers {branchPaths} />
            <TimelineItems {placed} baseline={baseline()} {textAlign} {translatedMap} {langMode} />
            <!-- {#each debugPaths as dp}
              <path id={dp.id} d={dp.d} fill="none" stroke={dp.color} stroke-width={dp.thick ? 6 : 2} opacity={dp.thick ? 0.9 : 0.5} />
            {/each} -->
          </g>
        </svg>
      {/if}
    </div>
  </div>

  <CatPanel
    bind:categories
    bind:showBerlin
    bind:showBrandenburg
    bind:langMode
    bind:pdfWidthCm
    bind:pdfHeightCm
    {counts}
    hasRows={placed.length > 0}
    {exporting}
    {exportingPng}
    {exportingPdf}
    onRebuild={build}
    onResetZoom={resetZoom}
    onExportSVG={exportSVG}
    onExportPNG={exportPNG}
    onExportPDF={exportPDF}
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
    font-family: var(--font-mono);
  }
</style>
