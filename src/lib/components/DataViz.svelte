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
    isMobile,
  } from "$lib/stores";
  import { t, lang } from "$lib/i18n";
  import { onMount, onDestroy } from "svelte";

  export let urls = [];
  export let autoCycle = false;
  export let noZoom = false;

  export let idleDelay = 10000;
  export let tickMs = 5000;
  export let maxCyclesProp = 2;
  export let growthMode = "chaos";
  export let growthModeFixed = false;

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

  let autoCycleEnabled = autoCycle;
  let idleDelayMs = idleDelay;
  let tickEveryMs = tickMs;
  let maxCycles = maxCyclesProp;

  $: customUrls = Array.from(new Set(urls || []))
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

  let tickHandle = null;

  function startAutoCycle() {
    stopAutoCycle();
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
  }

  function stopAutoCycle() {
    if (tickHandle) {
      clearInterval(tickHandle);
      tickHandle = null;
    }
  }

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
    startAutoCycle();
    const onVis = () => (document.hidden ? stopAutoCycle() : startAutoCycle());
    document.addEventListener("visibilitychange", onVis, { passive: true });
    return () => {
      stopAutoCycle();
      activityEvents.forEach((ev) =>
        window.removeEventListener(ev, markActivity)
      );
      document.removeEventListener("visibilitychange", onVis);
    };
  });

  let timerResetId;
  $: {
    clearTimeout(timerResetId);
    timerResetId = setTimeout(() => {
      stopAutoCycle();
      startAutoCycle();
    }, 150);
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
    // psychedelic: {
    //   branchingChance: 0.8,
    //   directionRandomness: 12.0,
    //   branchAngle: Math.PI * 1.25,
    //   downwardBias: 0.02,
    // },
    // vortex: {
    //   branchingChance: 0.12,
    //   directionRandomness: 4.0,
    //   branchAngle: Math.PI / 6,
    //   downwardBias: -0.02,
    // },
    // staccato: {
    //   branchingChance: 6.0,
    //   directionRandomness: 60.0,
    //   branchAngle: Math.PI / 4,
    //   downwardBias: 0.0,
    // },
    // plasma: {
    //   branchingChance: 1.8,
    //   directionRandomness: 30.0,
    //   branchAngle: Math.PI / 3,
    //   downwardBias: 0.005,
    // },
  };

  const growthModes = Object.keys(growthParams);

  $: dataSig = vizData
    .map((d) => `${d.URL || ""}|${d.ExtractedDate || d.Date || ""}`)
    .join("§");

  $: activeHighlightTerms = [
    ...($filters.keyword ? getKeywordVariants($filters.keyword) : []),
    ...($filters.text ? [$filters.text] : []),
  ].filter(Boolean);

  $: if (dataSig && growthModeFixed == false) {
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
  function shortenAroundKeyword(text, keyword, maxLen = 120) {
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
      segmentLength = 10 * scale,
      widthBucket = 100 * scale,
      ltrSpacing = 10 * scale;
    const charCache = new Map();
    const maxCache = 1000;
    const keywordColors = {};
    let branches = [];
    let pan = { x: 0, y: 0 };
    let zoom = noZoom ? 1 : 0.5;
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
    const repulsionRadius = (isMobile ? 9 : 12) * scale;
    const bucketRebuildStride = 3;
    const branchUpdateStride = 2;

    function getCachedLetter(kw, letter, textSize) {
      const key = `${kw}_${letter}_${Math.round(textSize)}`;
      if (charCache.has(key)) {
        const val = charCache.get(key);
        charCache.delete(key);
        charCache.set(key, val);
        return val;
      }
      const ts = Math.max(8, Math.min(28, Math.round(textSize)));
      const pg = p.createGraphics(40 * scale, 40 * scale);
      pg.colorMode(p.HSB);
      pg.textFont("courier");
      pg.textAlign(p.CENTER, p.CENTER);
      pg.textSize(ts);
      const w = Math.max(pg.textWidth(letter), 4);
      pg.noStroke();
      pg.fill(keywordColors[kw] || p.color(0, 0, 75));
      pg.rectMode(p.CENTER);
      pg.rect(pg.width / 2, pg.height / 2, w + 4, ts + 4);
      pg.fill(0, 0, 0);
      pg.text(letter, pg.width / 2, pg.height / 2);
      charCache.set(key, pg);
      if (charCache.size > maxCache) {
        const oldestKey = charCache.keys().next().value;
        charCache.delete(oldestKey);
      }
      return pg;
    }

    function growBranch(br, tip) {
      const gp = params();
      let dir = br.dir0.copy();
      if (br.__rand == null) br.__rand = Math.random();
      const localChaos = (br.__rand - 0.5) * 2;
      dir.y += (gp.downwardBias || 0) + localChaos * 0.08;
      dir.normalize();
      const nv = p.noise(
        tip.x * 0.01 * scale,
        tip.y * 0.01 * scale,
        simFrame * 0.03
      );
      const rotAmt = p.map(
        nv,
        0,
        1,
        -gp.directionRandomness,
        gp.directionRandomness
      );
      dir.rotate(rotAmt * (0.5 + Math.abs(localChaos)));
      if (growthMode === "staccato") {
        if (Math.random() < 0.25) {
          dir.rotate((Math.random() - 0.5) * gp.directionRandomness * 3);
        }
        dir.add(
          p.createVector(
            (Math.random() - 0.5) * 0.6 * gp.directionRandomness,
            (Math.random() - 0.5) * 0.6 * gp.directionRandomness
          )
        );
      }
      if (growthMode === "psychedelic") {
        const phase = (br.phase || 0) + simFrame * (0.08 + br.__rand * 0.3);
        const swirl = p
          .createVector(Math.cos(phase), Math.sin(phase))
          .mult(0.9 + br.__rand);
        dir.add(swirl).normalize();
      }
      if (growthMode === "vortex") {
        const toCenter = p.createVector(
          tip.x - (br.center?.x || 0),
          tip.y - (br.center?.y || 0)
        );
        if (toCenter.mag() > 0.001) {
          const tang = p.createVector(-toCenter.y, toCenter.x).normalize();
          dir.add(tang.mult(1.2 + br.__rand * 2));
          dir.add(toCenter.normalize().mult(-0.6 * (1 + br.__rand)));
        }
      }
      if (growthMode === "river") {
        const s = 0.0025,
          t = simFrame * 0.015;
        const a = p.noise(tip.x * s, tip.y * s, t) * Math.PI * 2;
        const flow = p.createVector(Math.cos(a), Math.sin(a));
        dir.add(flow.mult(0.6 + Math.random() * 1.4)).normalize();
      }
      if (growthMode === "tendrils") {
        const osc = 0.25 * Math.sin((br.phase || 0) + simFrame * 0.08);
        dir.rotate(osc * (1 + Math.random() * 1.5));
      }
      if (growthMode === "plasma") {
        if (Math.random() < 0.08) {
          dir.add(
            p.createVector((Math.random() - 0.5) * 3, (Math.random() - 0.5) * 3)
          );
        }
      }
      if (Math.random() < 0.007 + Math.abs(localChaos) * 0.02) {
        dir.y *= -1;
      }
      dir.add(
        p.createVector(
          (Math.random() - 0.5) * 0.02,
          (Math.random() - 0.5) * 0.02
        )
      );
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
      // p.pixelDensity();
      p.colorMode(p.HSB);
      p.textAlign(p.CENTER, p.CENTER);
      p.textSize(9 * scale);
      p.frameRate(30);
      if (!data || !data.length) {
        worldBuffer = null;
        letterHitboxes = [];
        return;
      }
      const base = Math.max(window.innerWidth, window.innerHeight);
      const grewByData = Math.min(1.6, 1 + data.length / 40);
      const maxBuffer = isMobile ? 2048 : 4200;
      const w = Math.min(maxBuffer, Math.floor(base * grewByData));
      const h = w;
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
      const visHandler = () => {
        if (document.hidden) p.noLoop();
        else p.loop();
      };
      document.addEventListener("visibilitychange", visHandler, {
        passive: true,
      });
    };

    p.draw = () => {
      if (!worldBuffer) {
        p.background(0);
        return;
      }
      if (simFrame % bucketRebuildStride === 0) {
        globalBuckets = new Map();
        branches.forEach((br) =>
          br.nodes.forEach((n) => {
            if (!n) return;
            const key = `${Math.floor(n.x / widthBucket)},${Math.floor(n.y / widthBucket)}`;
            if (!globalBuckets.has(key)) globalBuckets.set(key, []);
            globalBuckets.get(key).push(n);
          })
        );
      }
      branches.forEach((br, idx) => {
        if ((simFrame + idx) % branchUpdateStride !== 0) return;
        if (br.finished) return;
        br.frameCount++;
        if (br.grown >= br.maxSteps) return;
        const tip = br.nodes && br.nodes[br.nodes.length - 1];
        if (!tip) return;
        let dir = growBranch(br, tip);
        const bx = Math.floor(tip.x / widthBucket);
        const by = Math.floor(tip.y / widthBucket);
        for (let dx = -1; dx <= 1; dx++) {
          for (let dy = -1; dy <= 1; dy++) {
            const arr = globalBuckets.get(`${bx + dx},${by + dy}`) || [];
            for (let j = 0; j < arr.length; j++) {
              const n2 = arr[j];
              const dx2 = tip.x - n2.x;
              const dy2 = tip.y - n2.y;
              const d = Math.hypot(dx2, dy2);
              if (d > 0 && d < repulsionRadius) {
                const inv = 1 / d;
                dir.add(p.createVector(dx2 * inv, dy2 * inv).mult(0.6 * scale));
              }
            }
          }
        }
        dir.normalize();
        const next = tip.copy().add(dir.copy().mult(segmentLength));
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
            const v0 = br.nodes[si - 1];
            const v1 = br.nodes[si];
            if (!v0 || !v1) break;
            const tnorm = (target - d0) / v1.dist(v0);
            const px = p.lerp(v0.x, v1.x, tnorm);
            const py = p.lerp(v0.y, v1.y, tnorm);
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
            if (ci % 3 === 0) {
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
              if (letterHitboxes.length > 4000) letterHitboxes.splice(0, 1000);
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
      if (isRecording && isMobile) {
        isRecording = false;
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
      if (noZoom) return;
      if (!dragging) return;
      const dx = (p.mouseX - lastX) / zoom,
        dy = (p.mouseY - lastY) / zoom;
      pan.x += dx;
      pan.y += dy;
      lastX = p.mouseX;
      lastY = p.mouseY;
    };
    p.mouseWheel = (e) => {
      if (noZoom) return;
      const f = e.deltaY < 0 ? 1.08 : 1 / 1.08;
      const newZoom = p.constrain(zoom * f, 0.25, 1.5);
      if (Math.abs(newZoom - zoom) > 0.01) zoom = newZoom;
    };
    p.windowResized = () => {
      p.resizeCanvas(window.innerWidth, window.innerHeight);
    };
    p.mouseOut = () => {
      if (!isPinned) setTooltip("", "", 0, 0, []);
    };
    p.mouseMoved = () => {
      if (isPinned) return;
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
      <P5 {sketch} />
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

<style>
  .viz-container {
    width: 100vw;
    height: 100vh;
    background: #000;
    cursor: cell;
    position: relative;
    overflow: hidden;
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
    z-index: 2;
    background: transparent;
  }
</style>
