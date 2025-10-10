<script>
  import P5 from "p5-svelte";
  import KeywordTooltip from "$lib/components/KeywordTooltip.svelte";
  import {
    filters,
    articles,
    availableKeywordsLabeled,
    recent,
    filteredData,
    parseDateLoose,
    getKeywordVariants,
    record,
  } from "$lib/stores";
  import { t, lang } from "$lib/i18n";
  import { onMount } from "svelte";
  import { page } from "$app/stores";

  export let urls = [];
  export let autoCycle = false;
  export let idleDelay = 10000;
  export let tickMs = 5000;
  export let maxCyclesProp = 2;

  function normalizeUrl(u) {
    let s = String(u || "").trim();
    try {
      s = decodeURIComponent(s);
    } catch {}
    s = s.replace(/\/+$/, "");
    return s;
  }
  function toKey(u) {
    const s = normalizeUrl(u);
    try {
      const x = new URL(s);
      return `${x.hostname}${x.pathname}${x.search}`;
    } catch {
      return s;
    }
  }

  $: idsFromQuery = ($page?.url?.searchParams?.get("ids") || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  $: qAuto = ($page?.url?.searchParams?.get("autocycle") || "").toLowerCase();
  $: qIdle = parseInt($page?.url?.searchParams?.get("idle") || "");
  $: qTick = parseInt($page?.url?.searchParams?.get("tick") || "");
  $: qMax = parseInt($page?.url?.searchParams?.get("cycles") || "");

  let autoCycleEnabled = autoCycle;
  let idleDelayMs = idleDelay;
  let tickEveryMs = tickMs;
  let maxCycles = maxCyclesProp;

  $: if (qAuto)
    autoCycleEnabled = !(qAuto === "0" || qAuto === "false" || qAuto === "off");
  $: if (!isNaN(qIdle) && qIdle > 0) idleDelayMs = qIdle;
  $: if (!isNaN(qTick) && qTick > 0) tickEveryMs = qTick;
  $: if (!isNaN(qMax) && qMax >= 0) maxCycles = qMax;

  $: customUrls = Array.from(new Set([...(urls || []), ...idsFromQuery]))
    .map(normalizeUrl)
    .filter(Boolean);
  $: customUrlKeys = new Set(customUrls.map(toKey));
  $: baseCustom = customUrls.length
    ? ($articles || []).filter((a) => customUrlKeys.has(toKey(a?.URL || "")))
    : [];

  function applyLightFilters(list) {
    const f = $filters || {};
    let out = Array.isArray(list) ? list : [];
    if (f.keyword) {
      const variants = getKeywordVariants(f.keyword).map((s) =>
        String(s).toLowerCase()
      );
      out = out.filter(
        (a) =>
          Array.isArray(a.KeywordMatch) &&
          a.KeywordMatch.some((k) => variants.includes(String(k).toLowerCase()))
      );
    }
    if (f.text) {
      const q = String(f.text).toLowerCase();
      out = out.filter((a) => (a.Text || "").toLowerCase().includes(q));
    }
    if (f.showOnlyLatest) {
      const sorted = [...out].sort((a, b) => {
        const da = parseDateLoose(a.ExtractedDate || a.Date);
        const db = parseDateLoose(b.ExtractedDate || b.Date);
        if (da && db) return db - da;
        if (db) return 1;
        if (da) return -1;
        return 0;
      });
      out = sorted.length ? [sorted[0]] : [];
    }
    return out;
  }

  $: vizData = customUrls.length
    ? applyLightFilters(baseCustom)
    : $filteredData;

  function fmtNum(n) {
    const locale = $lang === "de" ? "de-DE" : "en-GB";
    return new Intl.NumberFormat(locale).format(n);
  }
  function fmtDate(d) {
    if (!d) return "";
    const locale = $lang === "de" ? "de-DE" : "en-GB";
    return new Intl.DateTimeFormat(locale, {
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(d);
  }
  function spanFor(list) {
    if (!Array.isArray(list) || !list.length) return null;
    let start = null,
      end = null;
    for (const a of list) {
      const d = parseDateLoose(a?.ExtractedDate || a?.Date);
      if (!d || isNaN(+d)) continue;
      if (!start || d < start) start = d;
      if (!end || d > end) end = d;
    }
    return start && end ? { start, end } : null;
  }
  function sameDay(a, b) {
    if (!a || !b) return false;
    return (
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate()
    );
  }
  function fmtRange(range, toKeyStr = "summary_l1_to") {
    if (!range) return "";
    const { start, end } = range;
    if (!end || sameDay(start, end)) return `${fmtDate(start)}`;
    return `${fmtDate(start)} ${t(toKeyStr)} ${fmtDate(end)}`;
  }

  $: totalFiltered = vizData.length;
  $: totalRecent = $recent.length;
  $: totalAll = $articles.length;

  $: spanFiltered = spanFor(vizData);
  $: spanTotal = spanFor($articles);

  let lastActivity = Date.now();
  let cycling = false;
  let cycles = 0;
  let hasCycledSinceIdle = false;

  function markActivity() {
    lastActivity = Date.now();
    cycling = false;
    cycles = 0;
    hasCycledSinceIdle = false;
  }
  function setKeywordFilter(val) {
    markActivity();
    filters.update((f) => ({ ...f, keyword: val }));
  }
  function setTextFilter(val) {
    markActivity();
    const q = String(val || "").trim();
    filters.update((f) => ({ ...f, text: q.length >= 3 ? q : "" }));
  }
  function setShowOnlyLatest(val) {
    markActivity();
    filters.update((f) => ({ ...f, showOnlyLatest: val }));
  }

  let tickHandle;

  onMount(() => {
    const activityEvents = [
      "mousemove",
      "mousedown",
      "click",
      "keydown",
      "wheel",
      "touchstart",
      "pointermove",
    ];
    activityEvents.forEach((ev) =>
      window.addEventListener(ev, markActivity, { passive: true })
    );

    const setupTimer = () => {
      if (tickHandle) clearInterval(tickHandle);
      if (!autoCycleEnabled) return;
      let index = 0;
      tickHandle = setInterval(() => {
        const idleFor = Date.now() - lastActivity;
        if (
          !cycling &&
          !hasCycledSinceIdle &&
          idleFor >= idleDelayMs &&
          $availableKeywordsLabeled.length > 0
        ) {
          cycling = true;
          cycles = 0;
        }
        if (cycling && $availableKeywordsLabeled.length > 0) {
          index = (index + 1) % $availableKeywordsLabeled.length;
          filters.update((f) => ({
            ...f,
            keyword: $availableKeywordsLabeled[index].value,
          }));
          cycles++;
          if (cycles >= maxCycles) {
            cycling = false;
            hasCycledSinceIdle = true;
          }
        }
      }, tickEveryMs);
    };

    setupTimer();

    return () => {
      if (tickHandle) clearInterval(tickHandle);
      activityEvents.forEach((ev) =>
        window.removeEventListener(ev, markActivity)
      );
    };
  });

  $: if (tickHandle !== undefined) {
    if (tickHandle) clearInterval(tickHandle);
    if (typeof window !== "undefined") {
      if (autoCycleEnabled) {
        let index = 0;
        tickHandle = setInterval(() => {
          const idleFor = Date.now() - lastActivity;
          if (
            !cycling &&
            !hasCycledSinceIdle &&
            idleFor >= idleDelayMs &&
            $availableKeywordsLabeled.length > 0
          ) {
            cycling = true;
            cycles = 0;
          }
          if (cycling && $availableKeywordsLabeled.length > 0) {
            index = (index + 1) % $availableKeywordsLabeled.length;
            filters.update((f) => ({
              ...f,
              keyword: $availableKeywordsLabeled[index].value,
            }));
            cycles++;
            if (cycles >= maxCycles) {
              cycling = false;
              hasCycledSinceIdle = true;
            }
          }
        }, tickEveryMs);
      }
    }
  }

  const growthParams = {
    fungal: {
      branchingChance: 0.29,
      directionRandomness: 2.0,
      branchAngle: Math.PI / 1.4,
      downwardBias: 0.01,
    },
    chaos: {
      branchingChance: 2.0,
      directionRandomness: 7.0,
      branchAngle: Math.PI / 1.4,
      downwardBias: 0.01,
    },
    covid: {
      branchingChance: 10.0,
      directionRandomness: 200.0,
      branchAngle: Math.PI / 1.4,
      downwardBias: 0.01,
    },

    tendrils: {
      branchingChance: 0.18,
      directionRandomness: 1.2,
      branchAngle: Math.PI / 2.0,
      downwardBias: 0.005,
    },
    river: {
      branchingChance: 0.06,
      directionRandomness: 0.6,
      branchAngle: Math.PI / 2.6,
      downwardBias: 0.0,
    },
    spiral: {
      branchingChance: 0.22,
      directionRandomness: 1.6,
      branchAngle: Math.PI / 1.2,
      downwardBias: 0.008,
    },
    fern: {
      branchingChance: 0.35,
      directionRandomness: 0.9,
      branchAngle: Math.PI / 3.0,
      downwardBias: 0.004,
    },
    lightning: {
      branchingChance: 0.1,
      directionRandomness: 9.0,
      branchAngle: Math.PI / 1.8,
      downwardBias: 0.0,
    },
    constellation: {
      branchingChance: 0.04,
      directionRandomness: 0.4,
      branchAngle: Math.PI / 1.3,
      downwardBias: 0.0,
    },
    vortex: {
      branchingChance: 0.28,
      directionRandomness: 3.0,
      branchAngle: Math.PI / 1.1,
      downwardBias: 0.006,
    },
    meadow: {
      branchingChance: 0.42,
      directionRandomness: 2.4,
      branchAngle: Math.PI / 2.2,
      downwardBias: -0.002,
    },
    roots: {
      branchingChance: 0.33,
      directionRandomness: 1.4,
      branchAngle: Math.PI / 2.8,
      downwardBias: 0.012,
    },
    zigzag: {
      branchingChance: 0.2,
      directionRandomness: 0.8,
      branchAngle: Math.PI / 2.2,
      downwardBias: 0.004,
    },
    square: {
      branchingChance: 0.08,
      directionRandomness: 0.3,
      branchAngle: Math.PI / 2.0,
      downwardBias: 0.0,
    },
    orbit: {
      branchingChance: 0.15,
      directionRandomness: 1.0,
      branchAngle: Math.PI / 1.6,
      downwardBias: 0.002,
    },
    wave: {
      branchingChance: 0.2,
      directionRandomness: 0.7,
      branchAngle: Math.PI / 2.4,
      downwardBias: 0.003,
    },
    drunk: {
      branchingChance: 0.12,
      directionRandomness: 3.6,
      branchAngle: Math.PI / 2.0,
      downwardBias: 0.006,
    },

    spiral_in: {
      branchingChance: 0.25,
      directionRandomness: 1.1,
      branchAngle: Math.PI / 1.5,
      downwardBias: 0.005,
    },
    spiral_out: {
      branchingChance: 0.25,
      directionRandomness: 1.9,
      branchAngle: Math.PI / 1.5,
      downwardBias: -0.003,
    },
    zigzag_hard: {
      branchingChance: 0.28,
      directionRandomness: 0.35,
      branchAngle: Math.PI / 1.9,
      downwardBias: 0.002,
    },
    zigzag_soft: {
      branchingChance: 0.18,
      directionRandomness: 0.6,
      branchAngle: Math.PI / 2.5,
      downwardBias: 0.001,
    },
    lissajous: {
      branchingChance: 0.24,
      directionRandomness: 1.3,
      branchAngle: Math.PI / 1.7,
      downwardBias: 0.007,
    },
    helix: {
      branchingChance: 0.21,
      directionRandomness: 0.9,
      branchAngle: Math.PI / 1.3,
      downwardBias: -0.004,
    },
    swirl: {
      branchingChance: 0.32,
      directionRandomness: 2.2,
      branchAngle: Math.PI / 1.2,
      downwardBias: 0.005,
    },
    tumbleweed: {
      branchingChance: 0.27,
      directionRandomness: 4.5,
      branchAngle: Math.PI / 1.6,
      downwardBias: -0.006,
    },
    gust: {
      branchingChance: 0.14,
      directionRandomness: 5.2,
      branchAngle: Math.PI / 2.3,
      downwardBias: 0.0,
    },
    lattice: {
      branchingChance: 0.05,
      directionRandomness: 0.25,
      branchAngle: Math.PI / 2.0,
      downwardBias: 0.0,
    },
    starburst: {
      branchingChance: 0.4,
      directionRandomness: 3.4,
      branchAngle: Math.PI / 3.2,
      downwardBias: -0.001,
    },
    petal: {
      branchingChance: 0.3,
      directionRandomness: 1.1,
      branchAngle: Math.PI / 2.6,
      downwardBias: 0.004,
    },
    braid: {
      branchingChance: 0.22,
      directionRandomness: 1.8,
      branchAngle: Math.PI / 1.9,
      downwardBias: 0.003,
    },
    corkscrew: {
      branchingChance: 0.2,
      directionRandomness: 2.8,
      branchAngle: Math.PI / 1.25,
      downwardBias: 0.005,
    },
    meander: {
      branchingChance: 0.09,
      directionRandomness: 0.95,
      branchAngle: Math.PI / 2.9,
      downwardBias: 0.0,
    },
    dunes: {
      branchingChance: 0.16,
      directionRandomness: 0.55,
      branchAngle: Math.PI / 2.7,
      downwardBias: -0.003,
    },
    eddies: {
      branchingChance: 0.26,
      directionRandomness: 2.6,
      branchAngle: Math.PI / 1.6,
      downwardBias: 0.002,
    },
    pulse: {
      branchingChance: 0.31,
      directionRandomness: 1.5,
      branchAngle: Math.PI / 2.1,
      downwardBias: 0.006,
    },
    jitter: {
      branchingChance: 0.13,
      directionRandomness: 6.5,
      branchAngle: Math.PI / 2.4,
      downwardBias: 0.0,
    },
    sawtooth: {
      branchingChance: 0.19,
      directionRandomness: 0.7,
      branchAngle: Math.PI / 1.8,
      downwardBias: 0.003,
    },
    diamond: {
      branchingChance: 0.07,
      directionRandomness: 0.35,
      branchAngle: Math.PI / 4.0,
      downwardBias: 0.0,
    },
    attractor: {
      branchingChance: 0.23,
      directionRandomness: 2.1,
      branchAngle: Math.PI / 1.7,
      downwardBias: -0.005,
    },
    repel: {
      branchingChance: 0.23,
      directionRandomness: 2.1,
      branchAngle: Math.PI / 1.7,
      downwardBias: 0.009,
    },
    perlin_flow: {
      branchingChance: 0.11,
      directionRandomness: 1.4,
      branchAngle: Math.PI / 2.8,
      downwardBias: 0.0,
    },
    curl: {
      branchingChance: 0.29,
      directionRandomness: 2.9,
      branchAngle: Math.PI / 1.3,
      downwardBias: 0.004,
    },
    checker: {
      branchingChance: 0.04,
      directionRandomness: 0.2,
      branchAngle: Math.PI / 2.0,
      downwardBias: 0.0,
    },
    metro: {
      branchingChance: 0.08,
      directionRandomness: 0.45,
      branchAngle: Math.PI / 1.1,
      downwardBias: 0.0,
    },
    stairs: {
      branchingChance: 0.17,
      directionRandomness: 0.5,
      branchAngle: Math.PI / 2.1,
      downwardBias: 0.002,
    },
    arcs: {
      branchingChance: 0.2,
      directionRandomness: 1.0,
      branchAngle: Math.PI / 2.8,
      downwardBias: 0.001,
    },
    petals: {
      branchingChance: 0.34,
      directionRandomness: 1.3,
      branchAngle: Math.PI / 2.3,
      downwardBias: 0.003,
    },
  };

  const growthModes = Object.keys(growthParams);
  let growthMode = "chaos";

  $: dataSig = vizData
    .map((d) => `${d.URL || ""}|${d.ExtractedDate || d.Date || ""}`)
    .join("§");

  $: activeHighlightTerms = [
    ...($filters.keyword ? getKeywordVariants($filters.keyword) : []),
    ...($filters.text ? [$filters.text] : []),
  ].filter(Boolean);

  $: if (dataSig) {
    growthMode = growthModes[Math.floor(Math.random() * growthModes.length)];
  }

  $: sketchKey = `${dataSig}|${growthMode}|${$filters.showOnlyLatest ? "1" : "0"}|kw:${$filters.keyword}|q:${$filters.text}`;

  let hoveredText = "",
    hoveredUrl = "",
    hoveredTitle = "",
    tooltipX = 0,
    tooltipY = 0,
    hoveredHitbox = null;
  function setTooltip(text, url, x, y, keywords = [], date = "", title = "") {
    hoveredText = text || "";
    hoveredUrl = url || "";
    hoveredTitle = title || "";
    tooltipX = x || 0;
    tooltipY = y || 0;
    hoveredHitbox = { keywords: keywords || [], date };
  }
  function shorten(text, maxLen = 300) {
    if (!text) return "";
    if (text.length <= maxLen) return text;
    let cut = text.lastIndexOf(" ", maxLen);
    if (cut === -1) cut = maxLen;
    return text.slice(0, cut) + "…";
  }
  function shortenAroundKeyword(text, keyword, maxLen = 200) {
    if (!text) return "";
    const k = String(keyword || "").trim();
    if (!k) return shorten(text, maxLen);
    const i = text.toLowerCase().indexOf(k.toLowerCase());
    if (i === -1) return shorten(text, maxLen);
    let start = Math.max(0, i - Math.floor((maxLen - k.length) / 2));
    let end = start + maxLen;
    if (end > text.length) {
      end = text.length;
      start = Math.max(0, end - maxLen);
    }
    if (start > 0) {
      const s = text.lastIndexOf(" ", start);
      if (s !== -1) start = s + 1;
    }
    if (end < text.length) {
      const s = text.indexOf(" ", end);
      if (s !== -1) end = s;
    }
    let result = text.slice(start, end);
    if (start > 0) result = "…" + result;
    if (end < text.length) result = result + "…";
    return result;
  }
  function currentFocusFor(text, fallbackKeyword) {
    const q = ($filters.text || "").trim();
    if (q) return q;
    if ($filters.keyword) return $filters.keyword;
    return fallbackKeyword || "";
  }

  let isRecording = false;
  let savedFrames = 0;
  let framesToSave = 1000;
  const unsub = record.subscribe((v) => (isRecording = v));
  let isPinned = false;

  function clearTooltip() {
    hoveredText = "";
    hoveredUrl = "";
    hoveredTitle = "";
    tooltipX = 0;
    tooltipY = 0;
    hoveredHitbox = null;
  }
  function pinTooltip() {
    isPinned = true;
  }
  function unpinTooltip() {
    isPinned = false;
    clearTooltip();
  }

  let sketch = (p) => {
    const data = vizData;
    const params = () => growthParams[growthMode] || growthParams.fungal;
    const scale = 0.75,
      segmentLength = 8 * scale,
      repulsionRadius = 12 * scale,
      widthBucket = 100 * scale,
      ltrSpacing = 8 * scale;
    const charCache = new Map();
    const keywordColors = {};
    let branches = [];
    let pan = { x: 0, y: 0 };
    let zoom = 0.5;
    let dragging = false;
    let lastX = 0,
      lastY = 0,
      simFrame = 0;
    let bufferCenter = { x: 0, y: 0 };
    let bufferBounds = { left: 0, right: 0, top: 0, bottom: 0 };
    let worldBuffer;
    let globalBuckets = new Map();
    let letterHitboxes = [];
    let firstDraw = true;

    function getCachedLetter(kw, letter, textSize) {
      const key = `${kw}_${letter}_${textSize}`;
      if (charCache.has(key)) return charCache.get(key);
      const pg = p.createGraphics(40 * scale, 40 * scale);
      pg.colorMode(p.HSB);
      pg.textFont("courier");
      pg.textAlign(p.CENTER, p.CENTER);
      pg.textSize(textSize);
      const w = Math.max(pg.textWidth(letter), 4);
      pg.noStroke();
      pg.fill(keywordColors[kw] || p.color(0, 0, 75));
      pg.rectMode(p.CENTER);
      pg.rect(pg.width / 2, pg.height / 2, w + 4, textSize + 4);
      pg.fill(0, 0, 0);
      pg.text(letter, pg.width / 2, pg.height / 2);
      charCache.set(key, pg);
      return pg;
    }

    /* ———————————————————————————————————————————
       EFFECTS: richer, mode-specific steering
       ——————————————————————————————————————————— */
    function growBranch(br, tip) {
      const gp = params();
      let dir = br.dir0.copy();
      dir.y += gp.downwardBias;
      dir.normalize();

      const nv = p.noise(
        tip.x * 0.01 * scale,
        tip.y * 0.01 * scale,
        simFrame * 0.05
      );
      dir.rotate(
        p.map(nv, 0, 1, -gp.directionRandomness, gp.directionRandomness)
      );

      switch (growthMode) {
        case "tendrils": {
          const osc = 0.25 * Math.sin(br.phase + simFrame * 0.08);
          dir.rotate(osc);
          break;
        }
        case "river": {
          const s = 0.0025,
            t = simFrame * 0.015;
          const a = p.noise(tip.x * s, tip.y * s, t) * Math.PI * 2;
          const flow = p.createVector(Math.cos(a), Math.sin(a));
          dir.add(flow.mult(0.6)).normalize();
          break;
        }
        case "spiral": {
          const toC = p.createVector(tip.x - br.center.x, tip.y - br.center.y);
          if (toC.mag() > 0.001) {
            const tang = p.createVector(-toC.y, toC.x).normalize();
            dir.add(tang.mult(0.45)).normalize();
          }
          break;
        }
        case "fern": {
          const beat =
            br.grown % 10 === 0
              ? (Math.random() < 0.5 ? -1 : 1) * (gp.branchAngle * 0.45)
              : 0;
          if (beat) dir.rotate(beat);
          break;
        }
        case "lightning": {
          const jitter = (Math.random() - 0.5) * 0.9; // sharp kinks
          dir.rotate(jitter);
          if (Math.random() < 0.08)
            dir.rotate(((Math.random() < 0.5 ? -1 : 1) * Math.PI) / 2.2);
          break;
        }
        case "constellation": {
          const snap = Math.PI / 8;
          const a = Math.atan2(dir.y, dir.x);
          const snapped = Math.round(a / snap) * snap;
          const jitter = (Math.random() - 0.5) * 0.05;
          dir = p.createVector(
            Math.cos(snapped + jitter),
            Math.sin(snapped + jitter)
          );
          break;
        }
        case "vortex": {
          const toC = p.createVector(tip.x - br.center.x, tip.y - br.center.y);
          if (toC.mag() > 0.001) {
            const tang = p.createVector(-toC.y, toC.x).normalize();
            const swirl = 0.9;
            dir.add(tang.mult(swirl)).normalize();
          }
          dir.rotate((Math.random() - 0.5) * 0.2);
          break;
        }
        case "meadow": {
          const breeze = 0.35 * Math.sin(br.phase + simFrame * 0.03);
          dir.rotate(breeze);
          break;
        }
        case "roots": {
          dir.y += 0.05; // extra gravity
          dir.normalize();
          const creep = (Math.random() - 0.5) * 0.15;
          dir.rotate(creep);
          break;
        }
        default:
          // fungal/chaos/covid use the base noise & randomness already applied
          break;
      }

      return dir.normalize();
    }

    function setupBranches(data, w, h) {
      const cx = w / 2,
        cy = h / 2;
      const allKws = Array.from(
        new Set(
          data.flatMap((a) =>
            Array.isArray(a.KeywordMatch) ? a.KeywordMatch : []
          )
        )
      );
      allKws.forEach((kw, i) => {
        keywordColors[kw] = p.color(
          0,
          0,
          55 + (i * 120) / Math.max(allKws.length - 1, 1)
        );
      });

      const result = [];
      if (!data.length) return result;

      const kw0 = data[0]?.KeywordMatch?.[0] || "";
      const text0 = data[0]?.Text ?? data[0]?.sentence ?? "";
      const focus0 = currentFocusFor(text0, kw0);
      const trunkText = shortenAroundKeyword(text0, focus0);

      result.push({
        kw: kw0,
        nodes: [p.createVector(cx, cy)],
        sentence: trunkText,
        url: data[0]?.URL || "",
        date: data[0]?.ExtractedDate || data[0]?.Date || "",
        title: data[0]?.Title || "",
        maxSteps: Math.ceil(trunkText.length * (ltrSpacing / segmentLength)),
        grown: 0,
        frameCount: 0,
        dir0: p.createVector(0, -1).normalize(),
        pathLength: 0,
        distArr: [0],
        lastPlacedCharIndex: -1,
        finished: false,
        parent: null,
        attachAt: 0,
        phase: Math.random() * Math.PI * 2,
        turnDir: Math.random() < 0.5 ? -1 : 1,
        center: { x: cx, y: cy },
      });

      for (let i = 1; i < data.length; i++) {
        let parentIndex = Math.floor(Math.random() * Math.max(1, i));
        let parentBranch = result[parentIndex];
        const attachMax = Math.max(3, parentBranch.nodes.length - 3);
        let parentAttachIdx = Math.max(
          1,
          Math.min(
            Math.floor(2 + Math.random() * (attachMax - 2)),
            attachMax - 1
          )
        );
        const attachPoint =
          parentBranch.nodes[parentAttachIdx] ||
          parentBranch.nodes[parentBranch.nodes.length - 1];

        let direction = parentBranch.nodes[parentAttachIdx + 1]
          ? p
              .createVector(
                parentBranch.nodes[parentAttachIdx + 1].x -
                  parentBranch.nodes[parentAttachIdx].x,
                parentBranch.nodes[parentAttachIdx + 1].y -
                  parentBranch.nodes[parentAttachIdx].y
              )
              .normalize()
          : p.createVector(0, -1);

        direction.rotate(((Math.random() - 0.5) * Math.PI) / 1.2);

        const kw = data[i]?.KeywordMatch?.[0] || "";
        const txtFull = data[i]?.Text ?? data[i]?.sentence ?? "";
        const focus = currentFocusFor(txtFull, kw);
        const txt = shortenAroundKeyword(txtFull, focus);

        result.push({
          kw,
          nodes: [attachPoint.copy()],
          sentence: txt,
          url: data[i]?.URL || "",
          date: data[i]?.ExtractedDate || data[i]?.Date || "",
          title: data[i]?.Title || "",
          maxSteps: Math.ceil(txt.length * (ltrSpacing / segmentLength)),
          grown: 0,
          frameCount: 0,
          dir0: direction,
          pathLength: 0,
          distArr: [0],
          lastPlacedCharIndex: -1,
          finished: false,
          parent: parentIndex,
          attachAt: parentAttachIdx,
          phase: Math.random() * Math.PI * 2,
          turnDir: Math.random() < 0.5 ? -1 : 1,
          center: { x: cx, y: cy },
        });
      }
      return result;
    }

    function screenToWorld(sx, sy) {
      return {
        x: (sx - p.width / 2) / zoom - pan.x + bufferCenter.x,
        y: (sy - p.height / 2) / zoom - pan.y + bufferCenter.y,
      };
    }
    function worldToScreen(wx, wy) {
      return {
        x: (wx - bufferCenter.x + pan.x) * zoom + p.width / 2,
        y: (wy - bufferCenter.y + pan.y) * zoom + p.height / 2,
      };
    }

    p.setup = () => {
      p.createCanvas(window.innerWidth, window.innerHeight);
      p.colorMode(p.HSB);
      p.textAlign(p.CENTER, p.CENTER);
      p.textSize(9 * scale);
      p.frameRate(30);

      if (!data || !data.length) {
        worldBuffer = null;
        letterHitboxes = [];
        return;
      }

      const w = 4200 * scale,
        h = 4200 * scale;
      bufferCenter = { x: w / 2, y: h / 2 };
      bufferBounds = { left: 0, right: w, top: 0, bottom: h };

      worldBuffer = p.createGraphics(w, h);
      worldBuffer.colorMode(p.HSB);
      worldBuffer.textAlign(p.CENTER, p.CENTER);
      worldBuffer.textFont("courier");
      worldBuffer.textSize(13 * scale);

      branches = setupBranches(data, w, h);

      pan = { x: 0, y: 0 };
      simFrame = 0;
      letterHitboxes = [];
      firstDraw = true;
    };

    p.draw = () => {
      if (!worldBuffer) {
        p.background(0);
        return;
      }

      globalBuckets = new Map();
      branches.forEach((br) =>
        br.nodes.forEach((n) => {
          if (!n) return;
          const key = `${Math.floor(n.x / widthBucket)},${Math.floor(n.y / widthBucket)}`;
          if (!globalBuckets.has(key)) globalBuckets.set(key, []);
          globalBuckets.get(key).push(n);
        })
      );

      branches.forEach((br) => {
        if (br.finished) return;
        br.frameCount++;
        if (br.frameCount % 1 !== 0 || br.grown >= br.maxSteps) return;

        const tip = br.nodes && br.nodes[br.nodes.length - 1];
        if (!tip) return;

        let dir = growBranch(br, tip);

        const [bx, by] = [
          Math.floor(tip.x / widthBucket),
          Math.floor(tip.y / widthBucket),
        ];
        for (let dx = -1; dx <= 1; dx++)
          for (let dy = -1; dy <= 1; dy++)
            (globalBuckets.get(`${bx + dx},${by + dy}`) || []).forEach((n2) => {
              if (!n2) return;
              const d = tip.dist(n2);
              if (d > 0 && d < repulsionRadius) {
                dir.add(
                  p
                    .createVector(tip.x - n2.x, tip.y - n2.y)
                    .normalize()
                    .mult(0.6 * scale)
                );
              }
            });

        dir.normalize();
        const next = p.Vector.add(tip, p.Vector.mult(dir, segmentLength));
        next.x = p.constrain(
          next.x,
          bufferBounds.left + 10 * scale,
          bufferBounds.right - 10 * scale
        );
        next.y = p.constrain(
          next.y,
          bufferBounds.top + 10 * scale,
          bufferBounds.bottom - 10 * scale
        );
        br.nodes.push(next);

        br.grown++;
        const segLen = tip.dist(next);
        br.pathLength += segLen;
        br.distArr.push(br.pathLength);

        let ci = br.lastPlacedCharIndex + 1;
        while (
          ci < br.sentence.length &&
          (ci + 0.5) * ltrSpacing < br.pathLength
        ) {
          const target = (ci + 0.5) * ltrSpacing;
          const si = br.distArr.findIndex((d) => d >= target);
          if (si > 0) {
            const d0 = br.distArr[si - 1];
            const v0 = br.nodes[si - 1],
              v1 = br.nodes[si];
            if (!v0 || !v1) break;

            const tnorm = (target - d0) / v1.dist(v0);
            const px = p.lerp(v0.x, v1.x, tnorm),
              py = p.lerp(v0.y, v1.y, tnorm);
            const ang = p.atan2(v1.y - v0.y, v1.x - v0.x);

            const letter = br.sentence[ci];
            const textSize = repulsionRadius / 1.2;
            const cached = getCachedLetter(br.kw, letter, textSize);
            if (cached) {
              worldBuffer.push();
              worldBuffer.translate(px, py);
              worldBuffer.rotate(ang);
              worldBuffer.imageMode(p.CENTER);
              worldBuffer.image(cached, 0, -segmentLength);
              worldBuffer.pop();
            }

            if (br.lastPlacedCharIndex < ci) {
              letterHitboxes.push({
                worldX: px,
                worldY: py,
                radius: textSize * 2,
                url: br.url || "",
                text: br.sentence,
                keywords: [br.kw],
                date: br.date,
                title: br.title,
              });
            }

            br.lastPlacedCharIndex = ci;
            ci++;
          } else break;
        }

        if (br.grown >= br.maxSteps) br.finished = true;
      });

      simFrame++;

      p.background(0);
      p.push();
      p.translate(p.width / 2, p.height / 2);
      p.scale(zoom);
      p.translate(pan.x, pan.y);
      p.image(worldBuffer, -bufferCenter.x, -bufferCenter.y);
      p.pop();

      if (firstDraw && letterHitboxes.length > 0) {
        firstDraw = false;
        setTimeout(() => {
          if (typeof p.mouseMoved === "function") p.mouseMoved();
        }, 0);
      }

      if (isRecording) {
        p.frameRate(6);
        if (savedFrames < framesToSave) {
          p.saveCanvas("frame-" + p.nf(savedFrames, 4), "png");
          savedFrames++;
        }
      } else {
        p.frameRate(30);
        savedFrames = 0;
      }
    };

    p.remove = () => {
      unsub();
    };
    p.mousePressed = () => {
      dragging = true;
      lastX = p.mouseX;
      lastY = p.mouseY;
      if (hoveredHitbox?.url) {
        pinTooltip();
      }
    };
    p.mouseReleased = () => {
      dragging = false;
    };
    p.mouseDragged = () => {
      if (!dragging) return;
      const dx = (p.mouseX - lastX) / zoom,
        dy = (p.mouseY - lastY) / zoom;
      pan.x += dx;
      pan.y += dy;
      lastX = p.mouseX;
      lastY = p.mouseY;
    };
    p.mouseWheel = (e) => {
      const f = e.deltaY < 0 ? 1.05 : 1 / 1.05;
      zoom = p.constrain(zoom * f, 0.2, 2);
      return false;
    };
    p.windowResized = () => {
      p.resizeCanvas(window.innerWidth, window.innerHeight);
    };
    p.mouseOut = () => {
      if (!isPinned) setTooltip("", "", 0, 0, []);
    };
    p.mouseMoved = () => {
      if (isPinned) return;
      const screenToWorld = (sx, sy) => ({
        x: (sx - p.width / 2) / zoom - pan.x + bufferCenter.x,
        y: (sy - p.height / 2) / zoom - pan.y + bufferCenter.y,
      });
      const worldToScreen = (wx, wy) => ({
        x: (wx - bufferCenter.x + pan.x) * zoom + p.width / 2,
        y: (wy - bufferCenter.y + pan.y) * zoom + p.height / 2,
      });
      const { x: wx, y: wy } = screenToWorld(p.mouseX, p.mouseY);
      hoveredHitbox = null;
      for (let hit of letterHitboxes) {
        if (p.dist(wx, wy, hit.worldX, hit.worldY) < hit.radius) {
          const { x, y } = worldToScreen(hit.worldX, hit.worldY);
          const highlightList = activeHighlightTerms.length
            ? activeHighlightTerms
            : hit.keywords || [];
          setTooltip(
            hit.text,
            hit.url,
            x,
            y - 22,
            highlightList,
            hit.date,
            hit.title
          );
          hoveredHitbox = hit;
          break;
        }
      }
      if (!hoveredHitbox && !isPinned) setTooltip("", "", 0, 0, []);
    };
  };
</script>

<div class="viz-container">
  {#if vizData.length}
    {#key sketchKey}
      <P5 {sketch} style="position:absolute; top:0; left:0;" />
    {/key}
  {:else}
    <div class="empty-state">...</div>
  {/if}
</div>

{#if isPinned}
  <div class="outside-overlay" on:click={unpinTooltip} aria-hidden="true" />
{/if}

<KeywordTooltip
  {hoveredText}
  {hoveredTitle}
  {hoveredUrl}
  {tooltipX}
  {tooltipY}
  keywords={activeHighlightTerms.length
    ? activeHighlightTerms
    : hoveredHitbox?.keywords || []}
  date={hoveredHitbox?.date || ""}
  {isPinned}
/>

<!-- <p
  style="position:fixed; bottom:0; left:0; color:#888; font-size:10px; padding:4px; z-index:9999; background:rgba(0,0,0,0.5);"
>
  {growthMode}
</p> -->

<style>
  .viz-container {
    width: 100vw;
    height: 100vh;
    background: #000;
    cursor: cell;
    position: relative;
  }
  .empty-state {
    color: #888;
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
  }
  :global(.viz-container canvas) {
    top: 0;
    left: 0;
    width: 100vw !important;
    height: 100vh !important;
    display: block;
    pointer-events: auto;
    z-index: 1;
    cursor: cell;
  }
  :global(canvas:not(#defaultCanvas0)) {
    display: none !important;
  }
  .outside-overlay {
    position: fixed;
    inset: 0;
    z-index: 9998;
    background: transparent;
  }
</style>
