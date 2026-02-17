<script>
  import { onDestroy, onMount } from "svelte";
  import { getMapViewLabel } from "$lib/components/map/viewLabel";

  let {
    regionFilter = "all",
    districtFilter = "",
    canvasSelector = ".overlay canvas",
    width = 3840,
    height = 2160,
    fps = 30,
    bitrate = 40_000_000,
  } = $props();

  let recording = $state(false);
  let recordingSupported = $state(true);
  let recordingLabel = $state("");

  let mediaRecorder = null;
  let recordingChunks = [];
  let recordingStream = null;
  let recordingCanvas = null;
  let recordingCtx = null;
  let recordingRaf = null;
  let shouldSaveRecording = true;

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
    return document.querySelector(canvasSelector);
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
    const regionSuffix = regionFilter === "all" ? "berlin-brandenburg" : String(regionFilter);
    const filename = `map-${regionSuffix}${districtSuffix}-${width}x${height}-${ts}.webm`;

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  function drawRecordingViewLabel(ctx, w, h) {
    const label = getMapViewLabel(regionFilter, districtFilter);
    if (!label) return;
    const padX = Math.round(w * 0.018);
    const padY = Math.round(h * 0.02);
    const titleSize = Math.max(24, Math.round(w * 0.012));

    ctx.save();
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.font = `${titleSize}px "Courier New", Courier, monospace`;
    const labelW = ctx.measureText(label).width;

    const cardW = Math.ceil(labelW + 24);
    const textH = titleSize;
    const cardH = Math.ceil(textH + 18);
    const cardX = w - padX - cardW;
    const cardY = padY;

    ctx.fillStyle = "rgba(0, 0, 0, 0.62)";
    ctx.fillRect(cardX, cardY, cardW, cardH);

    ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
    ctx.fillText(label, cardX + 12, cardY + 8);
    ctx.restore();
  }

  function startFramePump(sourceCanvas) {
    const tick = () => {
      if (!recordingCtx || !recordingCanvas) return;
      recordingCtx.clearRect(0, 0, width, height);
      recordingCtx.drawImage(sourceCanvas, 0, 0, width, height);
      drawRecordingViewLabel(recordingCtx, width, height);
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
      recordingCanvas.width = width;
      recordingCanvas.height = height;
      recordingCtx = recordingCanvas.getContext("2d", {
        alpha: false,
        desynchronized: true,
      });
      if (!recordingCtx) {
        recordingLabel = "Could not initialize recorder context";
        return;
      }

      startFramePump(sourceCanvas);
      recordingStream = recordingCanvas.captureStream(fps);
      recordingChunks = [];
      shouldSaveRecording = true;

      mediaRecorder = mimeType
        ? new MediaRecorder(recordingStream, {
            mimeType,
            videoBitsPerSecond: bitrate,
          })
        : new MediaRecorder(recordingStream, {
            videoBitsPerSecond: bitrate,
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

  onMount(() => {
    recordingSupported =
      typeof window !== "undefined" &&
      typeof window.MediaRecorder !== "undefined";
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

<button
  type="button"
  class:recording
  disabled={!recordingSupported}
  onclick={handleToggleRecording}
>
  {recording ? "Stop recording" : "Record"}
</button>
{#if recordingLabel}
  <div class="hint">{recordingLabel}</div>
{/if}

<style>
  button {
    width: 100%;
    box-sizing: border-box;
    border-radius: 6px;
    border: 1px solid rgba(255, 255, 255, 0.18);
    background: rgba(255, 255, 255, 0.05);
    color: inherit;
    padding: 5px 7px;
    font: inherit;
  }

  button.recording {
    border-color: rgba(255, 90, 90, 0.75);
    color: #ffd8d8;
  }

  .hint {
    margin-top: 8px;
    opacity: 0.7;
  }
</style>
