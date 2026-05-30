<script>
  import { onMount } from "svelte";
  import * as d3 from "d3";
  import { articles } from "$lib/stores";
  import { loadArticles } from "$lib/utils/loadArticles";
  import { parseDateLoose } from "$lib/utils/parseDate";
  import { keywordsGroup, getKeywordVariants } from "$lib/constants/keywords";
  import { detectRegion } from "$lib/utils/detectRegion";
  import { lang, setLang, availableLangs } from "$lib/i18n";
  import { translateDE_EN } from "$lib/utils/translate";
  import CatPanel from "./CatPanel.svelte";
  import TimelineExport from "$lib/components/TimelineExport.svelte";

  // ── layout constants ──────────────────────────────────────────
  const FONT = "Arial, Courier, monospace";
  const FS = 10;
  const CHAR_W = FS * 0.601;
  const LINE_H = 13;
  const TOP_PAD = 16;
  const H_PAD = 20;
  const PX_PER_DAY = 5;

  const CAT_COLORS = [
    "#b52a2a", // red
    "#1f5fa6", // blue
    "#1a7a3c", // green
    "#7a2a8f", // purple
    "#c96800", // amber
    "#007070", // teal
    "#b5006e", // magenta
    "#444444", // dark gray
    "#7a4d00", // brown
    "#3a7a00", // lime
  ];

  // ── default categories ────────────────────────────────────────
  const DEFAULT_CATEGORIES = [
    {
      id: "rechts",
      label: "Rechtsextremismus",
      type: "canonical",
      query: "rechtsextremismus",
      on: true,
      desc: "Incidents classified under right-wing extremism (PMK-rechts). The largest single category in the dataset.",
    },
    {
      id: "antisem",
      label: "Antisemitismus",
      type: "canonical",
      query: "antisemitismus",
      on: true,
      desc: "Incidents targeting Jewish individuals, communities, or institutions. PMK sometimes also logs Israel/Palestine protests here — see Palestine / Gaza for overlap.",
    },
    {
      id: "fremd",
      label: "Fremdenfeindlichkeit",
      type: "canonical",
      query: "fremdenfeindlichkeit",
      on: true,
      desc: "Incidents classified as xenophobic or racially motivated. Classification varies by reporting officer.",
    },
    {
      id: "queer",
      label: "Queerfeindlichkeit",
      type: "canonical",
      query: "queerfeindlichkeit",
      on: true,
      desc: "Incidents targeting LGBTQ+ people. A relatively recent PMK subcategory; coverage is uneven across Bundesländer.",
    },
    {
      id: "islam",
      label: "Islamfeindlichkeit",
      type: "canonical",
      query: "islamfeindlichkeit",
      on: false,
      desc: "Incidents with an anti-Muslim dimension. Likely under-represented in this dataset relative to other categories.",
    },
    {
      id: "vv",
      label: "Volksverhetzung",
      type: "canonical",
      query: "volksverhetzung",
      on: false,
      desc: "Incidents prosecuted under §130 StGB (incitement to hatred). Cuts across all political motives; includes online content.",
    },
    {
      id: "palaestina",
      label: "Palestine / Gaza",
      type: "text",
      query: "palästina,palestine,gaza,pro-palästina",
      on: false,
      desc: "Incidents involving pro-Palestinian demonstrations or Gaza-related context. Many are simultaneously logged under Antisemitismus — the same event can appear in both categories.",
    },
    {
      id: "misogyn",
      label: "Misogynie / Frauenfeindlichkeit",
      type: "text",
      query: "misogyn,frauenfeindlich,frauenfeindlichkeit,sexistisch,sexismus",
      on: true,
      desc: "Misogynistic and women-hostile incidents. Not a PMK category — absent from the official hate crime record.",
    },
    {
      id: "femizid",
      label: "Femicide / Women",
      type: "text",
      query: "femizid,femizide,frauenmord,incel",
      on: false,
      desc: "Femicide and incel-related incidents. These are absent from the PMK record — a structural blind spot in Germany's hate crime statistics.",
    },
  ];

  // ── persistence ───────────────────────────────────────────────
  const STORAGE_KEY = "timeline-cat-v6";

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

  // ── text wrapping ─────────────────────────────────────────────
  function wrapText(text, maxChars) {
    const words = text.split(" ");
    const lines = [];
    let line = "";
    for (const word of words) {
      const candidate = line ? line + " " + word : word;
      if (candidate.length > maxChars && line) {
        lines.push(line);
        line = word;
      } else line = candidate;
    }
    if (line) lines.push(line);
    return lines;
  }

  // ── snippet extraction ────────────────────────────────────────
  const SNIP_MAX = 120;

  function snippetFor(item) {
    const cat = categories.find(c => c.id === item.catId);
    const raw = item.text || item.title || "";
    if (!raw) return "";
    if (!cat) return raw.slice(0, SNIP_MAX) + (raw.length > SNIP_MAX ? "…" : "");

    let terms;
    if (cat.type === "canonical") {
      const kws = Array.isArray(item.raw?.KeywordMatch) ? item.raw.KeywordMatch : [];
      terms = kws
        .filter(k => /** @type {any} */ (keywordsGroup)[String(k).toLowerCase()] === cat.query)
        .map(k => String(k));
      if (!terms.length) terms = [cat.query];
    } else {
      terms = cat.query.split(",").map(s => s.trim()).filter(Boolean)
        .flatMap(t => t.split("+").map(s => s.trim()));
    }

    const lower = raw.toLowerCase();
    let pos = -1;
    for (const term of terms) {
      const idx = lower.indexOf(term.toLowerCase());
      if (idx !== -1) { pos = idx; break; }
    }
    if (pos === -1) return item.title || (raw.slice(0, SNIP_MAX) + (raw.length > SNIP_MAX ? "…" : ""));

    // Find the sentence containing pos (bounded by . ! ? or newline)
    let sentStart = pos;
    while (sentStart > 0 && !/[.!?\n]/.test(raw[sentStart - 1])) sentStart--;
    while (sentStart < pos && raw[sentStart] === " ") sentStart++;

    let sentEnd = pos;
    while (sentEnd < raw.length && !/[.!?\n]/.test(raw[sentEnd])) sentEnd++;
    if (sentEnd < raw.length) sentEnd++; // include punctuation

    const sentence = raw.slice(sentStart, sentEnd).trim();
    if (sentence.length <= SNIP_MAX) return sentence;
    // Sentence too long: fall back to window centered on keyword
    const half = Math.floor(SNIP_MAX / 2);
    const s = Math.max(sentStart, pos - half);
    const e = Math.min(sentEnd, pos + half);
    return (s > sentStart ? "…" : "") + raw.slice(s, e).trim() + (e < sentEnd ? "…" : "");
  }

  // word-boundary characters that end a token
  const WORD_END = /[\s,;:.!?()[\]"'…–—/\\]/;

  function matchInText(text, terms) {
    const lower = text.toLowerCase();
    for (const term of terms) {
      const idx = lower.indexOf(term.toLowerCase());
      if (idx === -1) continue;
      // extend to full word (catches "-isch", "-en", "-e" suffixes, German umlauts, etc.)
      let end = idx + term.length;
      while (end < text.length && !WORD_END.test(text[end])) end++;
      return { idx, pre: text.slice(0, idx), kw: text.slice(idx, end), post: text.slice(end) };
    }
    return null;
  }

  function splitAtKeyword(label, item) {
    const cat = categories.find(c => c.id === item.catId);
    if (!cat || !label) return null;
    let terms;
    if (cat.type === "canonical") {
      terms = getKeywordVariants(cat.query);
    } else {
      terms = cat.query.split(",").map(s => s.trim()).filter(Boolean)
        .flatMap(t => t.split("+").map(s => s.trim()));
    }
    terms = [...terms].sort((a, b) => b.length - a.length);
    return matchInText(label, terms);
  }

  // ── filters ───────────────────────────────────────────────────
  function passesRegion(a) {
    if (!showBerlin && !showBrandenburg) return true;
    const r = detectRegion(a);
    if (showBerlin && r === "Berlin") return true;
    if (showBrandenburg && r === "Brandenburg") return true;
    return false;
  }

  function matchesCategory(a, cat) {
    if (cat.type === "canonical") {
      const kws = Array.isArray(a.KeywordMatch) ? a.KeywordMatch : [];
      return kws.some(
        (k) =>
          /** @type {any} */ (keywordsGroup)[String(k).toLowerCase()] ===
          cat.query,
      );
    }
    const hay = `${a.Title || ""} ${a.Text || ""}`.toLowerCase();
    return cat.query
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
      .some((term) =>
        term
          .split("+")
          .map((s) => s.trim())
          .every((t) => hay.includes(t)),
      );
  }

  // ── layout ────────────────────────────────────────────────────
  function placeItems(preItems, xScale, labelFn) {
    const sorted = [...preItems].sort((a, b) =>
      a.desiredRow !== b.desiredRow
        ? a.desiredRow - b.desiredRow
        : +a.date - +b.date,
    );
    const rowEndX = new Map();
    return sorted.map((it) => {
      const label = labelFn(it);
      const x = xScale(it.date);
      const hw = Math.ceil(label.length * CHAR_W) / 2;
      const xStart = x - hw;
      const xEnd = x + hw + 4;
      let row = it.desiredRow ?? 0;
      while ((rowEndX.get(row) ?? -Infinity) > xStart) row++;
      rowEndX.set(row, xEnd);
      return { ...it, x, y: row * LINE_H, label };
    });
  }

  // ── state ─────────────────────────────────────────────────────
  let hasInitialFit = false;
  /** @type {any[]} */ let ticks = $state([]);
  /** @type {any[]} */ let placed = $state([]);
  /** @type {any[]} */ let catMarkers = $state([]);
  /** @type {Record<string,number>} */ let counts = $state({});
  /** @type {{x:number,label:string,anchor:string}[]} */ let edgeDates = $state([]);
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

    const locale = $lang === "de" ? "de-DE" : "en-GB";
    const fmtEdge = (d) => d.toLocaleString(locale, { day: "numeric", month: "short", year: "numeric" });
    edgeDates = [
      { x: H_PAD,     label: fmtEdge(reversed ? dMax : dMin), anchor: "start" },
      { x: W - H_PAD, label: fmtEdge(reversed ? dMin : dMax), anchor: "end"   },
    ];

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
        ? (it) => snippetFor(it)
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
            <!-- year bands -->
            {#each ticks.filter((t) => t.isYear) as t, i}
              {@const yt = ticks.filter((tt) => tt.isYear)}
              <rect
                x={Math.min(
                  t.x,
                  yt[i + 1]?.x ?? (reversed ? H_PAD : dataSvgW - H_PAD),
                )}
                y={TOP_PAD}
                width={Math.abs(
                  (yt[i + 1]?.x ?? (reversed ? H_PAD : dataSvgW - H_PAD)) - t.x,
                )}
                height={baseline() - TOP_PAD}
                fill="transparent"
              />
            {/each}

            <!-- grid lines -->
            {#each ticks as t}
              <line
                x1={t.x}
                y1={TOP_PAD}
                x2={t.x}
                y2={baseline()}
                stroke={t.isYear ? "#222" : "#ccc"}
                stroke-width="1"
              />
            {/each}

            <!-- items -->
            {#each placed as item}
              {@const catColor = CAT_COLORS[item.colorIdx % CAT_COLORS.length]}
              {@const op = item.active ? 1 : 0.18}
              {@const displayLabel = $lang === "en" ? (translatedMap[item.label] ?? item.label) : item.label}
              {@const url = item.raw?.URL}
              {#snippet itemText(x, y)}
                <text x={x} y={y} font-family={FONT} font-size={FS}
                      text-anchor="middle" fill={item.active ? catColor : "#ccc"} opacity={op} class="item">
                  {displayLabel}
                </text>
              {/snippet}
              {#if url}
                <!-- svelte-ignore a11y_interactive_supports_focus -->
                <a href={url} target="_blank" rel="noreferrer" class="item-link">
                  {@render itemText(item.x, baseline() - item.y - 1)}
                </a>
              {:else}
                {@render itemText(item.x, baseline() - item.y - 1)}
              {/if}
            {/each}

            <!-- category marker tick lines (rendered first, behind labels) -->
            {#each catMarkers as m}
              {#if m.hasTick && (counts[m.cat.id] ?? 0) > 0}
                {@const color = CAT_COLORS[m.colorIdx % CAT_COLORS.length]}
                {@const opacity = m.cat.on ? 1 : 0.18}
                {@const labelY = baseline() + 36 + m.yOff}
                <line
                  x1={m.x}
                  y1={baseline()}
                  x2={m.x}
                  y2={labelY - 10}
                  stroke={color}
                  stroke-width=".5"
                  {opacity}
                />
              {/if}
            {/each}

            <!-- category marker labels (rendered on top of tick lines) -->
            {#each catMarkers as m}
              {@const hasItems = (counts[m.cat.id] ?? 0) > 0}
              {#if hasItems}
              {@const color = CAT_COLORS[m.colorIdx % CAT_COLORS.length]}
              {@const opacity = m.cat.on ? 1 : 0.18}
              {@const labelY = baseline() + 36 + m.yOff}
              {@const labelText = $lang === "en" ? (translatedMap[m.cat.label] ?? m.cat.label) : m.cat.label}
              {@const labelW = labelText.length * 5.4 + 6}
              {@const activeDescLines = hasItems ? m.descLines : []}
              {@const descW = activeDescLines.length ? Math.max(...activeDescLines.map(/** @param {any} l */ l => l.length)) * 4.2 + 6 : 0}
              {@const bgW = Math.max(labelW, descW)}
              {@const bgH = 11 + activeDescLines.length * 9.5 + 6}
              <rect
                x={m.x - 2}
                y={labelY - 10}
                width={bgW}
                height={bgH}
                fill="white"
              />
              <text
                x={m.x}
                y={labelY}
                font-family={FONT}
                font-size={9}
                fill={color}
                text-anchor="start"
                {opacity}>{labelText}</text
              >
              {#if activeDescLines.length}
                <text
                  x={m.x}
                  y={labelY + 11}
                  font-family={FONT}
                  font-size={7}
                  fill={color}
                  opacity={m.cat.on ? 0.7 : 0.3}
                  text-anchor="start"
                >
                  {#each activeDescLines as line, i}
                    <tspan x={m.x} dy={i === 0 ? 0 : "1.3em"}>{line}</tspan>
                  {/each}
                </text>
              {/if}
              {/if}
            {/each}

            <!-- baseline -->
            <line
              x1={0}
              y1={baseline()}
              x2={dataSvgW}
              y2={baseline()}
              stroke="#888"
              stroke-width=".5"
            />

            <!-- axis -->
            {#each ticks as t}
              <line
                x1={t.x}
                y1={baseline()}
                x2={t.x}
                y2={baseline() + (t.isYear ? 10 : t.isQuarter ? 6 : 3)}
                stroke={t.isYear ? "#555" : t.isQuarter ? "#999" : "#ccc"}
                stroke-width=".5"
              />
              {#if t.isYear}
                <text
                  x={t.x}
                  y={baseline() + 22}
                  text-anchor="middle"
                  font-family={FONT}
                  font-size={FS}
                  fill="#555">{t.label}</text
                >
              {:else if t.isQuarter}
                <text
                  x={t.x}
                  y={baseline() + 16}
                  text-anchor="middle"
                  font-family={FONT}
                  font-size={8}
                  fill="#aaa">{t.month}</text
                >
              {/if}
            {/each}

            <!-- edge date labels -->
            <!-- {#each edgeDates as e}
              <line x1={e.x} y1={baseline()} x2={e.x} y2={baseline() + 10}
                    stroke="#555" stroke-width=".5" />
              <text x={e.x} y={baseline() + 22}
                    text-anchor={e.anchor} font-family={FONT}
                    font-size={FS} fill="#555">{e.label}</text>
            {/each} -->
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

  .item {
    cursor: pointer;
  }
  .item:hover {
    opacity: 0.55 !important;
  }
  .item-link {
    cursor: pointer;
  }

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
