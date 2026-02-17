<script>
  import * as d3 from "d3";
  import P5 from "p5-svelte";
  import { onMount } from "svelte";
  import MapControls from "$lib/components/MapControls.svelte";
  import TimelineHud from "$lib/components/map/TimelineHud.svelte";
  import {
    BERLIN_DISTRICTS,
    classifyMapRegion,
    findBerlinDistrict,
  } from "$lib/components/map/outlines";
  import {
    createTextSketch,
    normalizeGeocodedRow,
  } from "$lib/components/map/textSketch";

  let loading = $state(true);
  let errMsg = $state("");
  let incidents = $state([]);

  const MAP_SIDE_PADDING = 500;
  const SKIP_EMPTY_GAPS = true;
  const GAP_SKIP_THRESHOLD_DAYS = 45;

  let daysPerSecond = $state(7);
  let lineScale = $state(0.9);

  let growthMode = $state("fungal");
  let resetVersion = $state(0);
  let regionFilter = $state("Berlin");
  let districtFilter = $state("");
  let startAt = $state(""); // YYYY-MM-DD
  let timelineSeekRatio = $state(0);
  let timelineSeekMode = $state("progressive");
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

  const BERLIN_DISTRICTS_FALLBACK = [
    "Mitte",
    "Friedrichshain-Kreuzberg",
    "Pankow",
    "Charlottenburg-Wilmersdorf",
    "Spandau",
    "Steglitz-Zehlendorf",
    "Tempelhof-Schöneberg",
    "Neukölln",
    "Treptow-Köpenick",
    "Marzahn-Hellersdorf",
    "Lichtenberg",
    "Reinickendorf",
  ];

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

  const berlinDistricts =
    Array.isArray(BERLIN_DISTRICTS) && BERLIN_DISTRICTS.length > 0
      ? BERLIN_DISTRICTS
      : BERLIN_DISTRICTS_FALLBACK;

  function incidentsForView(region, district = "") {
    const list = Array.isArray(incidents) ? incidents : [];
    if (region === "Berlin") {
      const berlin = list.filter((x) => x?.mapRegion === "Berlin");
      if (!district) return berlin;
      return berlin.filter((x) => x?.berlinDistrict === district);
    }
    if (region === "Brandenburg") {
      return list.filter((x) => x?.mapRegion === "Brandenburg");
    }
    return list.filter(
      (x) => x?.mapRegion === "Berlin" || x?.mapRegion === "Brandenburg",
    );
  }

  let filteredIncidents = $derived.by(() =>
    incidentsForView(regionFilter, districtFilter),
  );

  const getIncidents = () => filteredIncidents;
  const getSettings = () => ({
    daysPerSecond,
    sidePadding: MAP_SIDE_PADDING,
    skipEmptyGaps: SKIP_EMPTY_GAPS,
    gapSkipThresholdDays: GAP_SKIP_THRESHOLD_DAYS,
    lineScale,
    growthMode,
    resetVersion,
    regionFilter,
    districtFilter,
    startAtMs,
    timelineSeekRatio,
    timelineSeekMode,
    timelineSeekVersion,
  });

  function handleTimelineSeek(ratio) {
    timelineSeekRatio = Math.max(0, Math.min(1, Number(ratio) || 0));
    timelineSeekMode = "exact-date";
    timelineSeekVersion += 1;
  }

  function handleRestart() {
    resetVersion += 1;
    timelineSeekRatio = 0;
    timelineSeekMode = "progressive";
    timelineSeekVersion += 1;
  }

  function firstIncidentDateForSelection(region, district = "") {
    const list = incidentsForView(region, district);
    const first = (Array.isArray(list) ? list : [])
      .map((x) => x?.date)
      .filter((t) => Number.isFinite(t))
      .sort((a, b) => a - b)[0];
    return Number.isFinite(first) ? first : null;
  }

  function handleAreaChange(region) {
    regionFilter = region;
    if (region !== "Berlin") districtFilter = "";
    const first = firstIncidentDateForSelection(region, districtFilter);
    startAt = Number.isFinite(first) ? fmtDateMs(first) : "";
    resetVersion += 1;
    timelineSeekRatio = 0;
    timelineSeekMode = "progressive";
    timelineSeekVersion += 1;
  }

  function handleDistrictChange(district) {
    districtFilter = district;
    const first = firstIncidentDateForSelection(regionFilter, district);
    startAt = Number.isFinite(first) ? fmtDateMs(first) : "";
    resetVersion += 1;
    timelineSeekRatio = 0;
    timelineSeekMode = "progressive";
    timelineSeekVersion += 1;
  }

  let sketch = $derived(
    createTextSketch({
      getIncidents,
      getSettings,
      setStatus: (s) => (status = s),
    }),
  );

  onMount(async () => {
    try {
      const rows = await d3.csv("/geocoded_data.csv");
      incidents = rows
        .map(normalizeGeocodedRow)
        .filter((x) => x.date != null)
        .map((x) => {
          const mapRegion = classifyMapRegion(Number(x?.lon), Number(x?.lat));
          return {
            ...x,
            mapRegion,
            berlinDistrict:
              mapRegion === "Berlin"
                ? findBerlinDistrict(Number(x?.lon), Number(x?.lat))
                : "",
          };
        });
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
      bind:districtFilter
      {berlinDistricts}
      bind:growthMode
      bind:daysPerSecond
      timelineRatio={status.ratio}
      onSeek={handleTimelineSeek}
      onRestart={handleRestart}
      onAreaChange={handleAreaChange}
      onDistrictChange={handleDistrictChange}
    />
  </div>

  <TimelineHud
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
