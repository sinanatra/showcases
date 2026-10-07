<script>
  import { onMount, tick, untrack } from "svelte";
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
    PDF_WIDTH_CM, PDF_HEIGHT_CM, PRINT_TEXT_PT,
    DEFAULT_CATEGORIES,
    DEFAULT_SHOW_BERLIN, DEFAULT_SHOW_BRANDENBURG,
    DEFAULT_REVERSED, DEFAULT_TEXT_ALIGN,
  } from "./config.js";
  import { settings, charW, distCW, lineH, lineHBoth, axisPad } from "./settings.svelte.js";
  import { matchesCategory, snippetSegments, placeItems, groupBranchesBySentence, segmentText, findBoilerplate } from "./catTimeline.js";
  import { loadReportTranslations } from "$lib/utils/reportTranslations";

  let categories    = $state(DEFAULT_CATEGORIES.map(c => ({ ...c })));
  let langMode = $state("both");

  const SIDEBAR_W = 220;

  const reversed = DEFAULT_REVERSED;
  const textAlign = DEFAULT_TEXT_ALIGN;

  let pxPerDay = $state(settings.PX_PER_DAY);
  $effect(() => { pxPerDay = settings.PX_PER_DAY; });

  let translatedMap = $state.raw({});
  async function loadTranslations() {
    translatedMap = await loadReportTranslations();
  }

  // ── filters ───────────────────────────────────────────────────
  let showBerlin = $state(DEFAULT_SHOW_BERLIN);
  let showBrandenburg = $state(DEFAULT_SHOW_BRANDENBURG);
  function passesRegion(a) {
    const r = detectRegion(a);
    if (r === "Berlin") return showBerlin;
    if (r === "Brandenburg") return showBrandenburg;
    return true;
  }

  function passesBilanz(a) {
    return !/bilanz/i.test(a.Title || "");
  }

  // ── state ─────────────────────────────────────────────────────
  let hasInitialFit = false;
  let ticks = $state.raw([]);
  let placed = $state.raw([]);
  let branchPaths = $state.raw([]);
  let counts = $state.raw({});
  let dataSvgW = $state(4000);
  let svgH = $state(600);
  let baselineY = $state(480);

  const baseline = () => baselineY;

  let builtItems = [];
  let branchCats = [];

  function computeItems() {
    findBoilerplate($articles);
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
    const newCounts = {};
    for (const cat of categories) newCounts[cat.id] = 0;

    for (const p of parsed) {
      const matchedBranches = branchCats.filter((cat) => matchesCategory(p.raw, cat));
      if (!matchedBranches.length) continue;

      const matchedHighlights = highlightCats.filter(
        (cat) => cat.on && matchesCategory(p.raw, cat),
      );
      for (const cat of matchedHighlights) newCounts[cat.id]++;
      const matchedHighlight = matchedHighlights[0];

     
      for (const catIds of groupBranchesBySentence(p, matchedBranches)) {
        for (const id of catIds) newCounts[id]++;
        const primaryCat = matchedBranches.find((c) => c.id === catIds[0]);
        const pre = {
          ...p,
          catId: catIds[0],
          catIds,
          color: matchedHighlight ? matchedHighlight.color : primaryCat.color,
          colorEnd: matchedHighlight ? matchedHighlight.colorEnd : primaryCat.colorEnd,
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
    const W = Math.max(minW, Math.ceil(days * pxPerDay) + 2 * settings.H_PAD);
    dataSvgW = W;

    const xScale = d3
      .scaleTime()
      .domain([new Date(dMin.getFullYear(), 0, 1), dMax])
      .range(reversed ? [W - settings.H_PAD, settings.H_PAD] : [settings.H_PAD, W - settings.H_PAD]);

    const pad2 = (n) => String(n).padStart(2, "0");
    const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const formatTick = (d) =>
      settings.TICK_LABEL_FORMAT.replace(/YYYY|YY|MMM|MM|DD/g, (token) =>
        token === "YYYY" ? String(d.getFullYear())
        : token === "YY" ? pad2(d.getFullYear() % 100)
        : token === "MMM" ? MONTHS[d.getMonth()]
        : token === "MM" ? pad2(d.getMonth() + 1)
        : pad2(d.getDate()));
    const makeTick = (d) => ({
      x: xScale(d),
      isYear: d.getMonth() === 0,
      label: formatTick(d),
      year: d.getFullYear(),
    });
    const monthTicks = xScale.ticks(d3.timeMonth.every(Math.max(1, Math.round(settings.TICK_EVERY_MONTHS) || 1))).map(makeTick);
    const lastTick = makeTick(dMax);
    const lastMonthX = monthTicks.at(-1)?.x ?? -Infinity;
    const majorTicks = Math.abs(lastTick.x - lastMonthX) > 4
      ? [...monthTicks, lastTick]
      : monthTicks;

    const midTicks = !settings.TICK_MID_LINES ? [] : majorTicks.slice(0, -1).map((t, i) => ({
      x: (t.x + majorTicks[i + 1].x) / 2,
      isWeek: true,
    }));

    ticks = [...majorTicks, ...midTicks];

    const labelFn = (it) =>
      it.segments
        .map((seg) => {
          const t = segmentText(seg, translatedMap, langMode);
          return `${t.de}${t.en}`;
        })
        .join(" ");
    const DIST_CW = distCW();
    const itemWidth = (it) => {
      const districtW = it.district ? Math.ceil(it.district.length * DIST_CW) + settings.DIST_GAP : 0;
      const itemTw = (it.segments?.length ? it.segments : [{ text: it.label }]).reduce(
        (sum, seg) => sum + segmentText(seg, translatedMap, langMode).tw,
        0,
      );
      return districtW + itemTw;
    };
    const rowH = langMode === "both" && settings.LANG_STACKED ? lineHBoth() : lineH();
    const gapRows = Math.max(0, Math.round(settings.BRANCH_START_GAP) || 0);
    const perCat = new Map();
    for (const it of visibleItems) perCat.set(it.catId, (perCat.get(it.catId) ?? 0) + 1);
    const startRows = new Map(
      [...perCat.entries()].sort((a, b) => a[1] - b[1]).map(([id], i) => [id, i * gapRows]),
    );
    const placedRaw = placeItems(visibleItems, xScale, labelFn, textAlign, rowH, itemWidth, startRows);

    const rowOf = (p) => Math.round(p.y / rowH - 0.2);
    const isStacked = (p) =>
      (p.segments ?? []).some((seg) => segmentText(seg, translatedMap, langMode).stacked);
    const tallRows = new Set(placedRaw.filter(isStacked).map(rowOf));
    const laneTop = gapRows * Math.max(0, startRows.size - 1);
    const used = new Set(placedRaw.map(rowOf));
    const maxRow = Math.max(-1, ...used);
    const usedRows = [];
    const keepEmpty = (Math.round(settings.BRANCH_CLEARANCE) || 0) > 0;
    for (let r = 0; r <= maxRow; r++) if (used.has(r) || r < laneTop || keepEmpty) usedRows.push(r);
    const rowY = new Map();
    let maxY = 0;
    for (const r of usedRows) {
      const h = tallRows.has(r) ? lineHBoth() : lineH();
      rowY.set(r, maxY + 0.2 * lineH());
      maxY += h;
    }
    const allPlaced = placedRaw.map((p) => ({ ...p, y: rowY.get(rowOf(p)) }));

    const bl = settings.TOP_PAD + maxY;
    baselineY = bl;
    placed = allPlaced;

    // ── branch labels ────────────────────────────────────────────
    const LABEL_CLEARANCE = 50;
    const OUTLIER_PX = 100;
    const MARKER_LABEL_FS = settings.MARKER_LABEL_FS;
    const MARKER_LABEL_DY = settings.MARKER_LABEL_DY;
    const LABEL_CW = MARKER_LABEL_FS * (settings.CHAR_RATIO + 0.03);
    const LABEL_GAP_PX = 40;
    const MAX_TILT_DEG = 130;
    const MAX_REPEATS = Math.max(1, Math.round(settings.MARKER_LABEL_REPEATS) || 1);
    const LABEL_START_RATIO = Math.min(0.95, Math.max(0, settings.MARKER_LABEL_START / 100));

    const wordsFor = (cat) => {
      if (langMode === "de") return [cat.labelDe || cat.label];
      if (langMode === "en") return [cat.label];
      return [cat.labelDe || cat.label, cat.label];
    };

    const labels = [];
    const labelBounds = [];

    for (const cat of branchCats.filter((c) => c.on)) {
      const items = allPlaced
        .filter((p) => p.catId === cat.id)
        .sort((a, b) => a.x - b.x);
      if (!items.length) continue;

      const raw = items.map((it) => ({ x: it.x, y: bl - it.y }));
      const trend = [raw[0]];
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
      if (trend.length < 2) {
        const longest = Math.max(...wordsFor(cat).map((w) => w.length)) * LABEL_CW;
        trend.push({ x: trend[0].x + longest, y: trend[0].y });
      }

      const segLens = [];
      let length = 0;
      for (let i = 1; i < trend.length; i++) {
        const l = Math.hypot(trend[i].x - trend[i - 1].x, trend[i].y - trend[i - 1].y);
        segLens.push(l);
        length += l;
      }
      if (!length) continue;

      const pointAt = (offset) => {
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

      const place = (word, start, force = false) => {
        const halfW = (word.length * LABEL_CW) / 2;
        const offset = start + halfW;
        const p = pointAt(offset);
        const tiltDeg = Math.abs(Math.atan2(p.dy, p.dx) * 180 / Math.PI);
        if (tiltDeg > MAX_TILT_DEG && !force) return false;

        const SUB_SAMPLES = 5;
        const subPts = [];
        for (let k = 0; k < SUB_SAMPLES; k++) {
          const sp = pointAt(start + (halfW * 2 * k) / (SUB_SAMPLES - 1));
          subPts.push({ x: sp.x, y: sp.y - LABEL_CLEARANCE });
        }
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
        if (overlapsLabel && !force) return false;

        // The path is made a little longer than the name at both ends: a name
        // wider than its path loses the letters that fall off the ends.
        const extend = (from, to) => {
          const len = Math.hypot(to.x - from.x, to.y - from.y) || 1;
          const pad = halfW * 0.2 + MARKER_LABEL_FS;
          return { x: to.x + ((to.x - from.x) / len) * pad, y: to.y + ((to.y - from.y) / len) * pad };
        };
        const pathPts = [
          extend(subPts[1], subPts[0]),
          ...subPts,
          extend(subPts[subPts.length - 2], subPts[subPts.length - 1]),
        ];
        const d = d3.line()
          .x((sp) => sp.x)
          .y((sp) => sp.y)
          .curve(d3.curveCatmullRom.alpha(1.8))(pathPts);
        let pathLen = 0;
        for (let k = 1; k < pathPts.length; k++)
          pathLen += Math.hypot(pathPts[k].x - pathPts[k - 1].x, pathPts[k].y - pathPts[k - 1].y);
        labels.push({ cat, id: `branch-label-${cat.id}-${labels.length}`, d, startOffset: pathLen / 2, text: word });
        labelBounds.push(bounds);
        return true;
      };

      let placedAny = false;
      for (let wi = 0; wi < MAX_REPEATS; wi++) {
        const word = words[wi % words.length];
        const wordW = word.length * LABEL_CW;
        const progress = MAX_REPEATS > 1 ? wi / (MAX_REPEATS - 1) : 0;
        const labelStart = length * LABEL_START_RATIO +
          Math.max(0, length * (1 - LABEL_START_RATIO) - wordW) * progress;
        const slot = MAX_REPEATS > 1
          ? Math.max(0, length * (1 - LABEL_START_RATIO) - wordW) / (MAX_REPEATS - 1)
          : length - labelStart - wordW;
        const step = Math.max(wordW / 4, 1);
        for (let shift = 0; shift === 0 || (shift < slot && labelStart + shift + wordW <= length); shift += step) {
          if (place(word, labelStart + shift)) { placedAny = true; break; }
        }
      }
      if (!placedAny) {
        const word = words[0];
        const wordW = word.length * LABEL_CW;
        const step = Math.max(wordW / 4, 1);
        for (let start = 0; (start === 0 || start + wordW <= length) && !placedAny; start += step) placedAny = place(word, start);
      }
    }

    branchPaths = labels;

    svgH = bl + axisPad();

    if (!hasInitialFit) { hasInitialFit = true; requestAnimationFrame(fitContent); }
  }

  let contentVersion = $state(0);

  function build() {
    computeItems();
    layout();
    contentVersion++;
  }

  $effect(() => {
    for (const c of categories) {
      void c.on;
      void c.label;
      void c.query;
      void c.keyword;
      void c.type;
      void c.color;
      void c.colorEnd;
    }
    void categories.length;
    void showBerlin;
    void showBrandenburg;
    void settings.SEGMENT_SNIP_MAX;
    void settings.MAX_SEGMENTS_PER_ITEM;
    if ($articles.length) untrack(build);
  });

  $effect(() => {
    void langMode;
    void translatedMap;
    JSON.stringify(settings);
    if (builtItems.length) {
      untrack(() => {
        layout();
        contentVersion++;
      });
    }
  });

  let fitDebounceTimer = (null);
  $effect(() => {
    void pdfWidthCm; void pdfHeightCm; void textPtTarget; void contentVersion; void settings.PX_PER_DAY;
    if (fitDebounceTimer) clearTimeout(fitDebounceTimer);
    if (!builtItems.length) return;
    fitDebounceTimer = setTimeout(solvePrintLayout, 300);
  });

  let highlightFade = $state(0.25);

  onMount(() => {
    const css = getComputedStyle(document.documentElement);
    const highlight = css.getPropertyValue("--highlight").trim();
    const highlightEnd = css.getPropertyValue("--highlight-end").trim();
    const fadeValue = parseFloat(css.getPropertyValue("--highlight-fade"));
    if (Number.isFinite(fadeValue)) highlightFade = fadeValue;
    for (const c of categories) {
      if (c.type === "canonical") continue;
      if (highlight) c.color = highlight;
      if (highlightEnd) c.colorEnd = highlightEnd;
    }
    loadArticles();
    loadTranslations();
  });

  // ── zoom ──────────────────────────────────────────────────────
  let svgEl = $state(null);
  let zoomTransform = $state(d3.zoomIdentity);
  let zoomBehavior = (null);

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

  function zoomTo(scale) {
    if (!svgEl || !zoomBehavior) return;
    const cW = svgEl.clientWidth, cH = svgEl.clientHeight;
    if (!cW || !cH || !(scale > 0)) return;
    zoomBehavior.scaleExtent([Math.min(0.01, scale), Math.max(10, scale)]);
    const ty = Math.min(4, cH - svgH * scale);
    d3.select(svgEl).call(zoomBehavior.transform, d3.zoomIdentity.translate(4, ty).scale(scale));
  }

  function fitHeight() {
    if (!svgEl) return;
    zoomTo((svgEl.clientHeight / svgH) * 0.97);
  }

  function showPrintSize() {
    zoomTo(printScale ? (printScale * 96) / 25.4 : 1);
  }

  // ── export ────────────────────────────────────────────────────
  let exporting = $state(false);
  let exportingPng = $state(false);
  let exportingPdf = $state(false);
  let pdfWidthCm = $state(PDF_WIDTH_CM);
  let pdfHeightCm = $state(PDF_HEIGHT_CM);

  const MM_PER_PT = 25.4 / 72;
  let textPtTarget = $state(PRINT_TEXT_PT);
  const DEFAULT_PRINT_SCALE = 25.4 / 96;
  let printScale = $derived(
    textPtTarget
      ? (textPtTarget * MM_PER_PT) / settings.FS
      : pdfWidthCm && pdfHeightCm
        ? Math.min((pdfWidthCm * 10) / dataSvgW, (pdfHeightCm * 10) / svgH)
        : pdfWidthCm
          ? (pdfWidthCm * 10) / dataSvgW
          : pdfHeightCm
            ? (pdfHeightCm * 10) / svgH
            : DEFAULT_PRINT_SCALE,
  );
  let textPt = $derived(printScale ? (settings.FS * printScale) / MM_PER_PT : null);
  let printSizeCm = $derived(
    printScale ? [(dataSvgW * printScale) / 10, (svgH * printScale) / 10] : null,
  );
  let tooTall = $derived(
    !!(textPtTarget && pdfWidthCm && pdfHeightCm && printSizeCm && printSizeCm[1] > pdfHeightCm + 0.5),
  );
  let fitNote = $derived(
    printSizeCm ? `${Math.round(printSizeCm[0])} × ${Math.round(printSizeCm[1])} cm` : "",
  );

  let solvedDaySpacing = $derived(
    [pdfWidthCm, pdfHeightCm, textPtTarget].filter(Boolean).length >= 2 ? pxPerDay : null,
  );

  function searchPxPerDay(measure, target, increasing) {
    let lo = 0.05, hi = 2000;
    for (let i = 0; i < 18; i++) {
      const mid = (lo + hi) / 2;
      pxPerDay = mid;
      layout(true);
      if (measure() > target === increasing) hi = mid; else lo = mid;
    }
    pxPerDay = (lo + hi) / 2;
    layout(true);
  }

  async function solvePrintLayout() {
    if (!builtItems.length) return;
    const w = pdfWidthCm, h = pdfHeightCm, pt = textPtTarget;
    const scale = pt ? (pt * MM_PER_PT) / settings.FS : null;
    if (scale && w) searchPxPerDay(() => dataSvgW, (w * 10) / scale, true);
    else if (scale && h) searchPxPerDay(() => svgH, (h * 10) / scale, false);
    else if (w && h) searchPxPerDay(() => dataSvgW / svgH, w / h, true);
    else {
      pxPerDay = settings.PX_PER_DAY;
      layout();
    }
    await tick();
  }

  let _fontB64 = (null);
  let _fontTtfB64 = (null);

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

  function getContentBounds() {
    const fallback = { minX: 0, minY: 0, maxX: dataSvgW, maxY: svgH };
    if (!svgEl) return fallback;
    const group = (svgEl.querySelector(".zoom-group"));
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
    const clone = (svgEl.cloneNode(true));
    clone.querySelector(".zoom-group")?.setAttribute("transform", "");
    const { minX, minY, maxX, maxY } = getContentBounds();
    const width = maxX - minX;
    const height = maxY - minY;
    clone.setAttribute("viewBox", `${minX} ${minY} ${width} ${height}`);
    clone.setAttribute("width", printScale ? `${(width * printScale).toFixed(2)}mm` : String(width));
    clone.setAttribute("height", printScale ? `${(height * printScale).toFixed(2)}mm` : String(height));
    await injectFontStyle(clone);
    clone.querySelectorAll("[style]").forEach((el) => {
      const s = el.getAttribute("style");
      if (s && s.includes("var(--font-mono)")) {
        el.setAttribute("style", s.replace(/var\(--font-mono\)/g, '"Pitch Sans", Courier, monospace'));
      }
    });
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

  async function renderCanvas() {
    if (!svgEl) return null;
    const clone = (svgEl.cloneNode(true));
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
      const fontSize = parseFloat(textEl.getAttribute("font-size")) || settings.MARKER_LABEL_FS;
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

  async function exportPDF() {
    if (!svgEl) return;
    exportingPdf = true;
    try {
      await import("svg2pdf.js");

      if (fitDebounceTimer) clearTimeout(fitDebounceTimer);
      await solvePrintLayout();

      const clone = (svgEl.cloneNode(true));
      clone.querySelector(".zoom-group")?.setAttribute("transform", "");
      const { minX, minY, maxX, maxY } = getContentBounds();
      const totalW = maxX - minX;
      const totalH = maxY - minY;
      clone.setAttribute("width", String(totalW));
      clone.setAttribute("height", String(totalH));
      clone.setAttribute("viewBox", `${minX} ${minY} ${totalW} ${totalH}`);

      flattenBranchLabels(clone);

      clone.querySelectorAll("[style]").forEach((el) => {
        const s = el.getAttribute("style");
        if (s && s.includes("var(--font-mono)")) {
          el.setAttribute("style", s.replace(/var\(--font-mono\)/g, '"Pitch Sans", Courier, monospace'));
        }
      });

      const PX_TO_PT = 0.75;
      const MAX_PDF_PT = 14400;
      let outW, outH;
      if (printScale) {
        outW = (totalW * printScale) / MM_PER_PT;
        outH = (totalH * printScale) / MM_PER_PT;
      } else {
        const scale = Math.min(1, MAX_PDF_PT / (Math.max(totalW, totalH) * PX_TO_PT));
        outW = totalW * PX_TO_PT * scale;
        outH = totalH * PX_TO_PT * scale;
      }
      const userUnit = Math.max(1, Math.ceil(Math.max(outW, outH) / MAX_PDF_PT));
      outW /= userUnit;
      outH /= userUnit;

      const pdf = new jsPDF({
        orientation: outW >= outH ? "landscape" : "portrait",
        unit: "pt",
        format: [outW, outH],
        userUnit,
        compress: true,
      });

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
  <div class="data-col">
    <div class="chart-wrap">
      {#if !$articles.length}
        <p class="loading">Loading…</p>
      {:else}
        <svg bind:this={svgEl}>
          <g class="zoom-group" transform={zoomTransform}>
            <TimelineGrid {ticks} baseline={baseline()} {dataSvgW} />
            <CategoryMarkers {branchPaths} />
            <TimelineItems
              {placed}
              baseline={baseline()}
              {textAlign}
              {translatedMap}
              {langMode}
              fade={placed.some((p) => p.highlightId) ? highlightFade : 1}
            />
          </g>
        </svg>
      {/if}
    </div>
  </div>

  <CatPanel
    bind:categories
    bind:langMode
    bind:pdfWidthCm
    bind:pdfHeightCm
    bind:showBerlin
    bind:showBrandenburg
    bind:textPtTarget
    {textPt}
    {printSizeCm}
    {fitNote}
    {tooTall}
    {solvedDaySpacing}
    {counts}
    hasRows={placed.length > 0}
    {exporting}
    {exportingPng}
    {exportingPdf}
    onResetZoom={resetZoom}
    onFitHeight={fitHeight}
    onPrintSize={showPrintSize}
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
