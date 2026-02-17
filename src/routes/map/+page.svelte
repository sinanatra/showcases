<script>
  import * as d3 from "d3";
  import P5 from "p5-svelte";
  import { onDestroy, onMount } from "svelte";
  import MapControls from "$lib/components/MapControls.svelte";
  import Title from "$lib/components/map/Title.svelte";
  import TimelineHud from "$lib/components/map/TimelineHud.svelte";
  import { getMapViewLabel } from "$lib/components/map/viewLabel";
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
  let recording = $state(false);
  let recordingSupported = $state(true);
  let recordingLabel = $state("");

  const RECORD_WIDTH = 3840;
  const RECORD_HEIGHT = 2160;
  const RECORD_FPS = 30;
  const RECORD_BITRATE = 40_000_000;

  let mediaRecorder = null;
  let recordingChunks = [];
  let recordingStream = null;
  let recordingCanvas = null;
  let recordingCtx = null;
  let recordingRaf = null;
  let shouldSaveRecording = true;

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

  function pickRecordingMimeType() {
    if (typeof window === "undefined" || !window.MediaRecorder) return "";
    const candidates = [
      "video/webm;codecs=vp9,opus",
      "video/webm;codecs=vp8,opus",
      "video/webm",
    ];
    for (const mime of candidates) {
      if (window.MediaRecorder.isTypeSupported?.(mime)) return mime;
    }
    return "";
  }

  function mapCanvasEl() {
    if (typeof document === "undefined") return null;
    return document.querySelector(".overlay canvas");
  }

  function stopFramePump() {
    if (recordingRaf != null) {
      cancelAnimationFrame(recordingRaf);
      recordingRaf = null;
    }
  }

  function stopRecordingTracks() {
    if (!recordingStream) return;
    for (const t of recordingStream.getTracks()) t.stop();
    recordingStream = null;
  }

  function cleanupRecorderRuntime() {
    stopFramePump();
    stopRecordingTracks();
    mediaRecorder = null;
    recordingCanvas = null;
    recordingCtx = null;
  }

  function downloadRecording(blob) {
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    const districtSuffix = districtFilter ? `-${districtFilter}` : "";
    const regionSuffix =
      regionFilter === "all" ? "berlin-brandenburg" : String(regionFilter);
    const filename = `map-${regionSuffix}${districtSuffix}-${RECORD_WIDTH}x${RECORD_HEIGHT}-${ts}.webm`;

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  function drawRecordingViewLabel(ctx, width, height) {
    const label = getMapViewLabel(regionFilter, districtFilter);
    if (!label) return;
    const padX = Math.round(width * 0.018);
    const padY = Math.round(height * 0.02);
    const titleSize = Math.max(24, Math.round(width * 0.012));

    ctx.save();
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.font = `${titleSize}px "Courier New", Courier, monospace`;
    const labelW = ctx.measureText(label).width;

    const cardW = Math.ceil(labelW + 24);
    const textH = titleSize;
    const cardH = Math.ceil(textH + 18);
    const cardX = width - padX - cardW;
    const cardY = padY;

    ctx.fillStyle = "rgba(0, 0, 0, 0.62)";
    ctx.fillRect(cardX, cardY, cardW, cardH);

    ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
    ctx.font = `${titleSize}px "Courier New", Courier, monospace`;
    ctx.fillText(label, cardX + 12, cardY + 8);
    ctx.restore();
  }

  function startFramePump(sourceCanvas) {
    const tick = () => {
      if (!recordingCtx || !recordingCanvas) return;
      recordingCtx.clearRect(0, 0, RECORD_WIDTH, RECORD_HEIGHT);
      recordingCtx.drawImage(sourceCanvas, 0, 0, RECORD_WIDTH, RECORD_HEIGHT);
      drawRecordingViewLabel(recordingCtx, RECORD_WIDTH, RECORD_HEIGHT);
      recordingRaf = requestAnimationFrame(tick);
    };
    tick();
  }

  function stopRecordingInternal({ save = true } = {}) {
    const rec = mediaRecorder;
    if (!rec) {
      recording = false;
      cleanupRecorderRuntime();
      recordingLabel = "";
      return;
    }
    if (rec.state !== "inactive") {
      rec.stop();
      return;
    }
    const shouldSave = save && shouldSaveRecording;
    if (shouldSave && recordingChunks.length > 0) {
      const blob = new Blob(recordingChunks, { type: "video/webm" });
      if (blob.size > 0) downloadRecording(blob);
    }
    recordingChunks = [];
    recording = false;
    recordingLabel = "";
    shouldSaveRecording = true;
    cleanupRecorderRuntime();
  }

  function startRecording() {
    try {
      const sourceCanvas = mapCanvasEl();
      if (!sourceCanvas) {
        recordingLabel = "Canvas not ready yet";
        return;
      }
      if (typeof window === "undefined" || !window.MediaRecorder) {
        recordingSupported = false;
        recordingLabel = "MediaRecorder not supported in this browser";
        return;
      }

      const mimeType = pickRecordingMimeType();
      recordingCanvas = document.createElement("canvas");
      recordingCanvas.width = RECORD_WIDTH;
      recordingCanvas.height = RECORD_HEIGHT;
      recordingCtx = recordingCanvas.getContext("2d", {
        alpha: false,
        desynchronized: true,
      });
      if (!recordingCtx) {
        recordingLabel = "Could not initialize recorder context";
        return;
      }

      startFramePump(sourceCanvas);
      recordingStream = recordingCanvas.captureStream(RECORD_FPS);
      recordingChunks = [];
      shouldSaveRecording = true;

      mediaRecorder = mimeType
        ? new MediaRecorder(recordingStream, {
            mimeType,
            videoBitsPerSecond: RECORD_BITRATE,
          })
        : new MediaRecorder(recordingStream, {
            videoBitsPerSecond: RECORD_BITRATE,
          });

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) recordingChunks.push(e.data);
      };

      mediaRecorder.onerror = () => {
        recordingLabel = "Recording failed";
        shouldSaveRecording = false;
        if (mediaRecorder && mediaRecorder.state !== "inactive") {
          mediaRecorder.stop();
        } else {
          stopRecordingInternal({ save: false });
        }
      };

      mediaRecorder.onstop = () => {
        stopRecordingInternal({ save: true });
      };

      mediaRecorder.start(1000);
      recording = true;
      recordingLabel = "Recording...";
    } catch (e) {
      recording = false;
      recordingLabel = String(e?.message || e || "Failed to start recording");
      cleanupRecorderRuntime();
    }
  }

  function handleToggleRecording() {
    if (recording) {
      if (mediaRecorder && mediaRecorder.state !== "inactive") {
        mediaRecorder.stop();
      } else {
        stopRecordingInternal({ save: true });
      }
      return;
    }
    startRecording();
  }

  let sketch = $derived(
    createTextSketch({
      getIncidents,
      getSettings,
      setStatus: (s) => (status = s),
    }),
  );

  onMount(async () => {
    recordingSupported =
      typeof window !== "undefined" && typeof window.MediaRecorder !== "undefined";

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

  onDestroy(() => {
    shouldSaveRecording = false;
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
      mediaRecorder.stop();
    } else {
      stopRecordingInternal({ save: false });
    }
  });
</script>

<main>
  {#if !errMsg}
    <div class="overlay">
      <P5 {sketch} />
    </div>
    <Title {regionFilter} {districtFilter} />
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
      {recording}
      {recordingSupported}
      {recordingLabel}
      onSeek={handleTimelineSeek}
      onRestart={handleRestart}
      onAreaChange={handleAreaChange}
      onDistrictChange={handleDistrictChange}
      onToggleRecording={handleToggleRecording}
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
