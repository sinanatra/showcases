<script>
  let {
    loading = false,
    errMsg = "",
    regionFilter = $bindable("all"),
    growthMode = $bindable("fungal"),
    daysPerSecond = $bindable(25),
    timelineRatio = 0,
    onSeek = () => {},
    onRestart = () => {},
    onAreaChange = () => {},
  } = $props();

  let timelineSlider = $state(0);
  let isScrubbing = $state(false);

  $effect(() => {
    if (isScrubbing) return;
    timelineSlider = Math.round(
      Math.max(0, Math.min(1, Number(timelineRatio) || 0)) * 1000,
    );
  });
</script>

<div class="panel">
  {#if loading}
    <div class="message">Loading map + data…</div>
  {:else if errMsg}
    <div class="message error">{errMsg}</div>
    <div class="hint">Check `static/geocoded_data.csv` and reload.</div>
  {:else}
    <label class="field">
      <span>Timeline</span>
      <input
        type="range"
        min="0"
        max="1000"
        step="1"
        bind:value={timelineSlider}
        oninput={(e) => {
          isScrubbing = true;
          timelineSlider = Number(e.currentTarget.value);
          onSeek(timelineSlider / 1000);
        }}
        onchange={() => {
          isScrubbing = false;
        }}
      />
    </label>

    <button type="button" class="restart" onclick={onRestart}>Restart</button>

    <label class="field">
      <span>Speed ({Math.round(Number(daysPerSecond) || 0)} days/s)</span>
      <input
        type="range"
        min="1"
        max="120"
        step="1"
        bind:value={daysPerSecond}
      />
    </label>

    <label class="field">
      <span>Area</span>
      <select
        bind:value={regionFilter}
        onchange={(e) => onAreaChange(e.currentTarget.value)}
      >
        <option value="all">Berlin + Brandenburg</option>
        <option value="Berlin">Berlin</option>
        <option value="Brandenburg">Brandenburg</option>
      </select>
    </label>

    <label class="field">
      <span>Growth mode</span>
      <select bind:value={growthMode}>
        <option value="fungal">fungal</option>
        <option value="chaos">chaos</option>
        <option value="tendrils">tendrils</option>
        <option value="river">river</option>
        <option value="spiral">spiral</option>
        <option value="covid">covid</option>
      </select>
    </label>
  {/if}
</div>

<style>
  .panel {
    width: min(220px, calc(100vw - 24px));
    max-height: calc(100vh - 24px);
    overflow: auto;
    background: rgba(10, 11, 15, 0.88);
    color: #f4f4f4;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 10px;
    padding: 12px;
    backdrop-filter: blur(8px);
  }

  .field {
    display: grid;
    grid-template-columns: 1fr;
    gap: 4px;
    margin-bottom: 8px;
  }

  .field span {
    opacity: 0.92;
  }

  input,
  select,
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

  input[type="range"] {
    padding: 0;
    background: transparent;
    border: 0;
  }

  .restart {
    margin-bottom: 10px;
    cursor: pointer;
  }

  .message {
    opacity: 0.9;
  }

  .message.error {
    color: #ffc6c6;
  }

  .hint {
    margin-top: 8px;
    opacity: 0.7;
  }
</style>
