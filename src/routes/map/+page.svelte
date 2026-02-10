<script>
  import * as d3 from "d3";
  import P5 from "p5-svelte";
  import { onMount } from "svelte";
  import MapControls from "$lib/components/MapControls.svelte";
  import MapTimelineHud from "$lib/components/mapViz/MapTimelineHud.svelte";
  import {
    createMapTextSketch,
    normalizeGeocodedRow,
  } from "$lib/components/mapViz/mapTextSketch";

  let loading = $state(true);
  let errMsg = $state("");
  let incidents = $state([]);

  let daysPerSecond = $state(25);
  let lineScale = $state(0.7);
  let growthMode = $state("fungal");
  let resetVersion = $state(0);
  let regionFilter = $state("all");
  let startAt = $state(""); // YYYY-MM-DD
  let timelineSeekRatio = $state(0);
  let timelineSeekVersion = $state(0);
  let status = $state({
    minT: null,
    maxT: null,
    playhead: null,
    active: 0,
    progressed: 0,
    total: 0,
    ratio: 0,
  });

  function fmtDateMs(ms) {
    if (!Number.isFinite(ms)) return "—";
    const d = new Date(ms);
    return isNaN(+d) ? "—" : d.toISOString().slice(0, 10);
  }

  function parseDateToMs(s) {
    if (!s) return null;
    const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return null;
    const [, y, mo, d] = m;
    const dt = new Date(Number(y), Number(mo) - 1, Number(d));
    return isNaN(+dt) ? null : +dt;
  }

  let startAtMs = $derived.by(() => parseDateToMs(startAt));

  $effect(() => {
    if (startAt) return;
    if (!Array.isArray(incidents) || incidents.length === 0) return;
    const first = incidents
      .map((x) => x?.date)
      .filter((t) => Number.isFinite(t))
      .sort((a, b) => a - b)[0];
    if (Number.isFinite(first)) startAt = fmtDateMs(first);
  });

  let filteredIncidents = $derived(
    regionFilter === "all"
      ? incidents
      : incidents.filter((x) => x.region === regionFilter),
  );

  const getIncidents = () => filteredIncidents;
  const getSettings = () => ({
    daysPerSecond,
    lineScale,
    growthMode,
    resetVersion,
    regionFilter,
    startAtMs,
    timelineSeekRatio,
    timelineSeekVersion,
  });

  function handleTimelineSeek(ratio) {
    timelineSeekRatio = Math.max(0, Math.min(1, Number(ratio) || 0));
    timelineSeekVersion += 1;
  }

  function handleRestart() {
    resetVersion += 1;
    timelineSeekRatio = 0;
    timelineSeekVersion += 1;
  }

  function firstIncidentDateForRegion(region) {
    const list =
      region === "all"
        ? incidents
        : incidents.filter((x) => x?.region === region);
    const first = (Array.isArray(list) ? list : [])
      .map((x) => x?.date)
      .filter((t) => Number.isFinite(t))
      .sort((a, b) => a - b)[0];
    return Number.isFinite(first) ? first : null;
  }

  function handleAreaChange(region) {
    regionFilter = region;
    const first = firstIncidentDateForRegion(region);
    startAt = Number.isFinite(first) ? fmtDateMs(first) : "";
    resetVersion += 1;
    timelineSeekRatio = 0;
    timelineSeekVersion += 1;
  }

  let sketch = $derived(
    createMapTextSketch({
      getIncidents,
      getSettings,
      setStatus: (s) => (status = s),
    }),
  );

  onMount(async () => {
    try {
      const rows = await d3.csv("/geocoded_data.csv");
      incidents = rows.map(normalizeGeocodedRow).filter((x) => x.date != null);
      loading = false;
    } catch (e) {
      loading = false;
      errMsg = String(e?.message || e || "Failed to initialize map");
    }
  });
</script>

<main>
  {#if !errMsg}
    <div class="overlay">
      <P5 {sketch} />
    </div>
  {/if}

  <div class="controls">
    <MapControls
      {loading}
      {errMsg}
      bind:regionFilter
      bind:growthMode
      bind:daysPerSecond
      timelineRatio={status.ratio}
      onSeek={handleTimelineSeek}
      onRestart={handleRestart}
      onAreaChange={handleAreaChange}
    />
  </div>

  <MapTimelineHud
    {loading}
    {errMsg}
    incidents={filteredIncidents}
    playhead={status.playhead}
    minT={status.minT}
  />
</main>

<style>
  :global(body) {
    margin: 0;
  }
  main {
    height: 100vh;
  }
  .overlay {
    position: fixed;
    inset: 0;
    pointer-events: none;
    z-index: 0;
  }
  .controls {
    position: fixed;
    top: 12px;
    left: 12px;
    z-index: 1;
  }
  :global(.overlay canvas) {
    width: 100% !important;
    height: 100% !important;
    display: block;
    pointer-events: none;
  }
</style>
