<script>
  import P5 from "p5-svelte";
  import KeywordTooltip from "$lib/components/KeywordTooltip.svelte";
  import {
    filters,
    articles,
    availableKeywordsLabeled,
    filteredData,
    parseDateLoose,
    getKeywordVariants,
    record,
    isMobile,
  } from "$lib/stores";
  import { createSketch } from "$lib/components/dataViz/sketch";
  import { growthModes, growthParams } from "$lib/components/dataViz/growth";
  import { onMount, onDestroy } from "svelte";

  export let urls = [];
  export let autoCycle = false;
  export let noZoom = false;
  export let startZoom = 1;
  export let startPan = { x: 0, y: 0 };
  export let disableScrollZoom = false;

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

  let isMobileValue = false;
  const unsubscribeIsMobile = isMobile.subscribe(
    (value) => (isMobileValue = !!value)
  );

  function setTooltip(text, url, x, y, keywords = [], date = "", title = "") {
    hoveredText = text || "";
    hoveredUrl = url || "";
    hoveredTitle = title || "";
    tooltipX = x || 0;
    tooltipY = y || 0;
  }
  function setHoveredHitbox(hit) {
    hoveredHitbox = hit;
  }

  function currentFocusFor(text, fallbackKeyword) {
    const q = ($filters.text || "").trim();
    if (q) return q;
    if ($filters.keyword) return $filters.keyword;
    return fallbackKeyword || "";
  }

  let isPinned = false;

  function clearTooltip() {
    hoveredText = "";
    hoveredUrl = "";
    hoveredTitle = "";
    tooltipX = 0;
    tooltipY = 0;
    setHoveredHitbox(null);
  }
  function pinTooltip() {
    isPinned = true;
  }
  function unpinTooltip() {
    isPinned = false;
    clearTooltip();
  }

  let sketchControls = {
    zoomIn: () => {},
    zoomOut: () => {},
    resetView: () => {},
  };
  let sketch;
  $: sketch = createSketch({
    vizData,
    growthMode,
    growthParams,
    noZoom,
    startZoom,
    startPan,
    disableScrollZoom,
    activeHighlightTerms,
    recordStore: record,
    isMobile: isMobileValue,
    setTooltip,
    setHoveredHitbox,
    clearTooltip,
    getIsPinned: () => isPinned,
    getHoveredHitbox: () => hoveredHitbox,
    pinTooltip,
    currentFocusFor,
    registerControls: (controls) => {
      sketchControls = controls || sketchControls;
    },
  });

  export function zoomIn() {
    sketchControls?.zoomIn?.();
  }
  export function zoomOut() {
    sketchControls?.zoomOut?.();
  }
  export function resetView() {
    sketchControls?.resetView?.();
  }

  onDestroy(() => {
    unsubscribeIsMobile();
  });
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
