<script>
  import { onMount } from "svelte";
  import * as d3 from "d3";
  import { articles } from "$lib/stores";
  import { loadArticles } from "$lib/utils/loadArticles";
  import { parseDateLoose } from "$lib/utils/parseDate";
  import { detectRegion } from "$lib/utils/detectRegion";
  import { normalizeDistrict } from "$lib/constants/districts";
  import CatPanel from "./CatPanel.svelte";
  import TimelineExport from "$lib/components/TimelineExport.svelte";
  import TimelineGrid from "./TimelineGrid.svelte";
  import TimelineItems from "./TimelineItems.svelte";
  import CategoryMarkers from "./CategoryMarkers.svelte";
  import {
    TOP_PAD, H_PAD, PX_PER_DAY, LINE_H, LINE_H_BOTH, CHAR_W, DIST_CW, DIST_GAP,
    AXIS_PAD, MARKER_LABEL_FS,
    DEFAULT_CATEGORIES,
    DEFAULT_SHOW_BERLIN, DEFAULT_SHOW_BRANDENBURG,
    DEFAULT_REVERSED, DEFAULT_TEXT_ALIGN,
  } from "./config.js";
  import { matchesCategory, snippetSegments, placeItems, groupBranchesBySentence } from "./catTimeline.js";

  let categories    = $state(DEFAULT_CATEGORIES.map(c => ({ ...c })));
  let showBerlin    = $state(DEFAULT_SHOW_BERLIN);
  let showBrandenburg = $state(DEFAULT_SHOW_BRANDENBURG);
  let panelOpen     = $state(true);
  /** @type {"de"|"en"|"both"} */ let langMode = $state("both");

  const reversed = DEFAULT_REVERSED;
  const textAlign = DEFAULT_TEXT_ALIGN;

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

  function layout() {
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
    const MAX_LABELS_PER_BRANCH = 5;
    const LABEL_CLEARANCE = MARKER_LABEL_FS * 0.5;
    const LABEL_LIFT_STEP = MARKER_LABEL_FS * 0.2;
    const MAX_LIFTS = 20;
    const LABEL_CW = MARKER_LABEL_FS * 1.1;
    const LABEL_HALF_H = MARKER_LABEL_FS * 0.9;
    const RUN_JUMP_PX = 140;
    const MAX_TILT_DEG = 190;
    const JITTER_FRACS = [0, 0.03, -0.03, 0.06, -0.06];

    const pointInRect = (/** @type {number} */ px, /** @type {number} */ py, /** @type {any} */ r, /** @type {number} */ pad) => {
      const dx = px - r.x, dy = py - r.y;
      const u = dx * r.ux + dy * r.uy;
      const v = dx * -r.uy + dy * r.ux;
      return Math.abs(u) <= r.halfW + pad && Math.abs(v) <= r.halfH + pad;
    };
    const rectCorners = (/** @type {any} */ r) => {
      const px = -r.uy, py = r.ux;
      return [
        { x: r.x + r.ux * r.halfW + px * r.halfH, y: r.y + r.uy * r.halfW + py * r.halfH },
        { x: r.x - r.ux * r.halfW + px * r.halfH, y: r.y - r.uy * r.halfW + py * r.halfH },
        { x: r.x - r.ux * r.halfW - px * r.halfH, y: r.y - r.uy * r.halfW - py * r.halfH },
        { x: r.x + r.ux * r.halfW - px * r.halfH, y: r.y + r.uy * r.halfW - py * r.halfH },
      ];
    };
    const rectsOverlap = (/** @type {any} */ a, /** @type {any} */ b) => {
      const cornersA = rectCorners(a), cornersB = rectCorners(b);
      const axes = [{ x: a.ux, y: a.uy }, { x: -a.uy, y: a.ux }, { x: b.ux, y: b.uy }, { x: -b.uy, y: b.ux }];
      for (const ax of axes) {
        const projA = cornersA.map((c) => c.x * ax.x + c.y * ax.y);
        const projB = cornersB.map((c) => c.x * ax.x + c.y * ax.y);
        if (Math.max(...projA) < Math.min(...projB) || Math.max(...projB) < Math.min(...projA)) return false;
      }
      return true;
    };

    /** @param {any[]} runItems */
    const prepareRun = (runItems) => {
      const n = runItems.length;
      if (n < 2) return null;
      const samples = Math.max(2, Math.min(10, n));

      /** @type {any[]} */ const trend = [];
      for (let i = 0; i < samples; i++) {
        const idx = Math.round((i * (n - 1)) / (samples - 1));
        const lo = Math.max(0, idx - 4), hi = Math.min(n - 1, idx + 4);
        let sum = 0, cnt = 0;
        for (let k = lo; k <= hi; k++) { sum += bl - runItems[k].y; cnt++; }
        trend.push({ x: runItems[idx].x, y: sum / cnt });
      }
      for (let pass = 0; pass < 4; pass++) {
        const smoothed = trend.map((p, i) => {
          if (i === 0 || i === trend.length - 1) return p;
          return { x: p.x, y: 0.3 * trend[i - 1].y + 0.4 * p.y + 0.3 * trend[i + 1].y };
        });
        for (let i = 0; i < trend.length; i++) trend[i] = smoothed[i];
      }

      /** @type {number[]} */ const segLens = [];
      let length = 0;
      for (let i = 1; i < trend.length; i++) {
        const l = Math.hypot(trend[i].x - trend[i - 1].x, trend[i].y - trend[i - 1].y);
        segLens.push(l);
        length += l;
      }
      if (!length) return null;

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

      const pointAtExt = (/** @type {number} */ offset) => {
        if (offset < 0) {
          const a = trend[0], b = trend[1];
          const segLen0 = segLens[0] || 1;
          const t = offset / segLen0;
          return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
        }
        if (offset > length) {
          const a = trend[trend.length - 2], b = trend[trend.length - 1];
          const segLenLast = segLens[segLens.length - 1] || 1;
          const t = 1 + (offset - length) / segLenLast;
          return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
        }
        return pointAt(offset);
      };

      const offsetForX = (/** @type {number} */ targetX) => {
        if (targetX <= trend[0].x) return 0;
        if (targetX >= trend[trend.length - 1].x) return length;
        let acc = 0;
        for (let i = 0; i < trend.length - 1; i++) {
          const a = trend[i], b = trend[i + 1];
          if (targetX <= b.x) {
            const t = b.x === a.x ? 0 : (targetX - a.x) / (b.x - a.x);
            return acc + t * segLens[i];
          }
          acc += segLens[i];
        }
        return length;
      };

      return { xStart: trend[0].x, xEnd: trend[trend.length - 1].x, length, pointAt, pointAtExt, offsetForX };
    };

    /** @param {any} run */
    const tryCandidate = (/** @type {any} */ cat, /** @type {any} */ run, /** @type {number} */ baseOffset) => {
      const halfW = (cat.label.length * LABEL_CW) / 2;
      for (const j of JITTER_FRACS) {
        const offset = Math.min(run.length, Math.max(0, baseOffset + j * run.length));
        const p = run.pointAt(offset);
        const norm = Math.hypot(p.dx, p.dy) || 1;
        const ux = p.dx / norm, uy = p.dy / norm;
        const tiltDeg = Math.abs(Math.atan2(p.dy, p.dx) * 180 / Math.PI);
        if (tiltDeg > MAX_TILT_DEG) continue;

        let clearance = LABEL_CLEARANCE;
        for (let lift = 0; lift <= MAX_LIFTS; lift++) {
          const cy = p.y - clearance;
          const rect = { x: p.x, y: cy, ux, uy, halfW, halfH: LABEL_HALF_H };
          const blocked = allPlaced.some((it) => pointInRect(it.x, bl - it.y, rect, 6));
          if (!blocked) {
            const segStart = offset - halfW * 1.15;
            const segEnd = offset + halfW * 1.15;
            const SUB_SAMPLES = 6;
            /** @type {any[]} */ const subPts = [];
            for (let s = 0; s < SUB_SAMPLES; s++) {
              const off = segStart + ((segEnd - segStart) * s) / (SUB_SAMPLES - 1);
              const sp = run.pointAtExt(off);
              subPts.push({ x: sp.x, y: sp.y - clearance });
            }
            const d = d3.line()
              .x(/** @param {any} sp */ (sp) => sp.x)
              .y(/** @param {any} sp */ (sp) => sp.y)
              .curve(d3.curveMonotoneX)(subPts);
            let pathLen = 0;
            for (let s = 1; s < subPts.length; s++)
              pathLen += Math.hypot(subPts[s].x - subPts[s - 1].x, subPts[s].y - subPts[s - 1].y);
            return { ...rect, d, pathLen };
          }
          clearance += LABEL_LIFT_STEP;
        }
      }
      return null;
    };

    /** @type {any[]} */ const branches = branchCats.filter((cat) => cat.on).map((cat) => {
      const items = allPlaced
        .filter((p) => p.catIds.includes(cat.id))
        .sort((a, b) => a.x - b.x);
      if (!items.length) return null;

      /** @type {any[][]} */ const runGroups = [[items[0]]];
      for (let i = 1; i < items.length; i++) {
        const dy = Math.abs((bl - items[i].y) - (bl - items[i - 1].y));
        if (dy > RUN_JUMP_PX) runGroups.push([]);
        runGroups[runGroups.length - 1].push(items[i]);
      }
      /** @type {any[]} */ const runs = runGroups.map(prepareRun).filter(Boolean);
      if (!runs.length) return null;

      const xMin = items[0].x, xMax = items[items.length - 1].x;
      const xRange = xMax - xMin || 1;

      /** @type {any[]} */ const candidates = [];
      for (let k = 0; k < MAX_LABELS_PER_BRANCH; k++) {
        const targetX = xMin + (xRange * (k + 0.5)) / MAX_LABELS_PER_BRANCH;
        let run = runs.find((r) => targetX >= r.xStart && targetX <= r.xEnd);
        if (!run) {
          run = runs.reduce((best, r) => {
            const d = targetX < r.xStart ? r.xStart - targetX : targetX - r.xEnd;
            return !best || d < best.d ? { r, d } : best;
          }, /** @type {any} */ (null))?.r;
        }
        if (!run) continue;
        const found = tryCandidate(cat, run, run.offsetForX(targetX));
        if (found) candidates.push(found);
      }
      if (!candidates.length) return null;

      return { cat, items, candidates };
    }).filter(Boolean);

    branches.sort((a, b) => b.items.length - a.items.length);
    /** @type {any[]} */ const acceptedRects = [];
    /** @type {any[]} */ const labels = [];
    for (let round = 0; round < MAX_LABELS_PER_BRANCH; round++) {
      for (const br of branches) {
        const c = br.candidates[round];
        if (!c) continue;
        const overlaps = acceptedRects.some((r) => rectsOverlap(c, r));
        if (overlaps) continue;
        acceptedRects.push(c);
        labels.push({ cat: br.cat, id: `branch-label-${br.cat.id}-${labels.length}`, d: c.d, startOffset: c.pathLen / 2 });
      }
    }

    branchPaths = labels;

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
    // dataSvgW can run into the tens of thousands of px for a multi-year
    // timeline, so the fit scale is often well below the zoom behavior's
    // scaleExtent floor. d3 silently clamps transform() to that floor, which
    // desyncs the applied scale from the (tx, ty) computed for the intended
    // one — the visible jump/offset right after clicking "fit". Widen the
    // floor to always include the fit scale before applying it.
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

  /** Cached base64 font data so we only fetch once per session. */
  let _fontB64 = /** @type {string|null} */ (null);

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

  /** Appends a category legend to a cloned SVG; returns added height. */
  function appendLegend(clone) {
    const ns = "http://www.w3.org/2000/svg";
    const fontMono = getComputedStyle(document.documentElement).getPropertyValue('--font-mono').trim() || 'Courier, monospace';
    const activeCats = categories.filter(c => (counts[c.id] ?? 0) > 0);
    if (!activeCats.length) return 0;

    const chipW = 220; const chipH = 13; const gap = 6; const padX = H_PAD;
    const cols = Math.max(1, Math.floor((dataSvgW - padX) / (chipW + gap)));
    const rows = Math.ceil(activeCats.length / cols);
    const legendY = svgH + 16;

    const g = document.createElementNS(ns, "g");
    activeCats.forEach((cat, i) => {
      const color = cat.color ?? "#999";
      const translated = translatedMap[cat.label];
      const label =
        langMode === "en" && translated
          ? translated
          : langMode === "both" && translated
            ? `${cat.label} • ${translated}`
            : cat.label;
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
      text.setAttribute("font-family", fontMono); text.setAttribute("font-size", "9");
      text.setAttribute("fill", "#000");
      text.textContent = label;

      g.appendChild(rect); g.appendChild(text);
    });
    clone.appendChild(g);
    return 16 + rows * (chipH + gap) + 10;
  }

  async function exportSVG() {
    if (!svgEl) return;
    exporting = true;
    const clone = /** @type {SVGSVGElement} */ (svgEl.cloneNode(true));
    clone.setAttribute("width", String(dataSvgW));
    clone.querySelector(".zoom-group")?.setAttribute("transform", "");
    const legendH = appendLegend(clone);
    clone.setAttribute("height", String(svgH + legendH));
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

  async function exportPNG() {
    if (!svgEl) return;
    exportingPng = true;
    const clone = /** @type {SVGSVGElement} */ (svgEl.cloneNode(true));
    clone.setAttribute("width", String(dataSvgW));
    clone.querySelector(".zoom-group")?.setAttribute("transform", "");
    const legendH = appendLegend(clone);
    const totalH = svgH + legendH;
    clone.setAttribute("height", String(totalH));

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
      MAX_DIM / dataSvgW,
      MAX_DIM / totalH,
      Math.sqrt(MAX_AREA / (dataSvgW * totalH)),
    );
    const outW = Math.round(dataSvgW * scale);
    const outH = Math.round(totalH   * scale);
    clone.setAttribute("viewBox", `0 0 ${dataSvgW} ${totalH}`);
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
            <CategoryMarkers {branchPaths} />
            <TimelineItems {placed} baseline={baseline()} {textAlign} {translatedMap} {langMode} />
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
    bind:showBerlin
    bind:showBrandenburg
    bind:panelOpen
    bind:langMode
    {counts}
    onRebuild={build}
  />
</div>

<TimelineExport
  hasRows={placed.length > 0}
  {exporting}
  {exportingPng}
  onExportSVG={exportSVG}
  onExportPNG={exportPNG}
/>

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

  .zoom-reset {
    position: absolute;
    top: 8px;
    left: 8px;
    z-index: 5;
    background: rgba(244, 243, 239, 0.92);
    border: 1px solid #ccc;
    font-family: var(--font-mono);
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
</style>
