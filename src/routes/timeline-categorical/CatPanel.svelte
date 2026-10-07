<script>
  import CategoryJsonEditor from "./CategoryJsonEditor.svelte";
  import TimelineExport from "$lib/components/TimelineExport.svelte";
  import { settings, defaults, EDITABLE, saveSettings, resetSettings, isChanged } from "./settings.svelte.js";

  let {
    categories = $bindable([]),
    langMode = $bindable("both"),
    pdfWidthCm = $bindable(null),
    pdfHeightCm = $bindable(null),
    showBerlin = $bindable(true),
    showBrandenburg = $bindable(true),
    textPtTarget = $bindable(null),
    exportDivisor = $bindable(1),
    textPt = null,
    printSizeCm = null,
    fitNote = "",
    tooTall = false,
    solvedDaySpacing = null,
    onFitHeight = () => {},
    onPrintSize = () => {},
    counts = {},
    hasRows = false,
    exporting = false,
    exportingPng = false,
    exportingPdf = false,
    onResetZoom = () => {},
    onExportSVG = () => {},
    onExportPNG = () => {},
    onExportPDF = () => {},
  } = $props();

  function notifyChange() {}

  function setSetting(key, value) {
    const n = Number(value);
    settings[key] = value === "" || !Number.isFinite(n) ? defaults[key] : n;
    saveSettings();
  }

  async function copySettings() {
    const lines = Object.keys(defaults)
      .filter((k) => settings[k] !== defaults[k])
      .map((k) => `export const ${k} = ${JSON.stringify(settings[k])};`);
    await navigator.clipboard.writeText(lines.join("\n") || "// nothing changed");
  }
</script>

<aside class="panel">
  <div class="panel-body">
    <div class="section-title">View</div>
    <div class="btn-row">
      <button class="plain-btn" onclick={onResetZoom} title="Whole chart in view">Fit</button>
      <button class="plain-btn" onclick={onFitHeight} title="Full height in view, scroll sideways through time">Height</button>
      <button class="plain-btn" onclick={onPrintSize} title="Real size: text as big on screen as on paper (needs a print size or text size under Export)">1:1</button>
    </div>

    {#each [["Categories", "canonical"], ["Commentary", "text"]] as [title, type]}
      <div class="section-title" style="margin-top:16px">{title}</div>
      {#each categories.filter((c) => (c.type === "canonical") === (type === "canonical")) as cat}
        <button
          class="leg-row"
          class:off={!cat.on}
          onclick={() => {
            cat.on = !cat.on;
            notifyChange();
          }}
        >
          <span class="leg-chip" style:background={cat.on ? (cat.color ?? "#999") : undefined}>{cat.label}</span>
          <span class="leg-count">{counts[cat.id] ?? 0}</span>
        </button>
      {/each}
    {/each}

    <CategoryJsonEditor bind:categories onChange={notifyChange} />

    <div class="section-title" style="margin-top:16px">Region</div>
    <label class="check-row"
      ><input type="checkbox" bind:checked={showBerlin} /> Berlin</label
    >
    <label class="check-row"
      ><input type="checkbox" bind:checked={showBrandenburg} /> Brandenburg</label
    >

    <div class="section-title" style="margin-top:16px">Language</div>
    <div class="lang-row">
      {#each [["de", "DE"], ["en", "EN"], ["both", "Both"]] as [value, label]}
        <button
          class="lang-btn"
          class:active={langMode === value}
          onclick={() => { langMode = value; }}
        >{label}</button>
      {/each}
    </div>

    <label class="check-row" title="Both languages: English under German, or after it on the same line"
      ><input
        type="checkbox"
        checked={settings.LANG_STACKED}
        onchange={(e) => { settings.LANG_STACKED = e.currentTarget.checked; saveSettings(); }}
      /> Stack EN under DE</label
    >

    <div class="section-title" style="margin-top:16px">Layout</div>
    {#each EDITABLE as [key, label, hint]}
      <label class="param-row" title={hint}>
        <span class:changed={settings[key] !== defaults[key]}>{label}</span>
        {#if key === "PX_PER_DAY" && solvedDaySpacing != null}
          <input
            type="number"
            value={Math.round(solvedDaySpacing * 100) / 100}
            disabled
            title="Worked out from the fixed size. Leave one of width / height / text size empty to set it yourself."
          />
        {:else}
          <input
            type="number"
            step="any"
            value={settings[key]}
            onchange={(e) => setSetting(key, e.currentTarget.value)}
          />
        {/if}
      </label>
    {/each}
    <div class="btn-row" style="margin-top:6px">
      <button class="plain-btn" onclick={resetSettings} disabled={!isChanged()} title="Back to the values in config.js">Reset</button>
      <button class="plain-btn" onclick={copySettings} title="Copy the changed values as lines for config.js">Copy</button>
    </div>

    <div class="section-title" style="margin-top:16px">Export</div>
    <TimelineExport
      {hasRows}
      {exporting}
      {exportingPng}
      {exportingPdf}
      bind:pdfWidthCm
      bind:pdfHeightCm
      bind:textPtTarget
      bind:exportDivisor
      {textPt}
      {printSizeCm}
      {fitNote}
      {tooTall}
      {onExportSVG}
      {onExportPNG}
      {onExportPDF}
    />
  </div>
</aside>

<style>
  .panel {
    flex-shrink: 0;
    width: 220px;
    height: 100vh;
    background: #f4f3ef;
    border-left: 1px solid #ddd;
    overflow: hidden;
  }

  .panel-body {
    box-sizing: border-box;
    height: 100%;
    padding: 12px;
    overflow-y: auto;
    font-family: var(--font-mono);
    font-size: 11px;
    color: #555;
  }

  .section-title {
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: #aaa;
    margin: 6px 0 4px;
  }

  .plain-btn {
    display: block;
    width: 100%;
    box-sizing: border-box;
    border: 1px solid #bbb;
    background: #fff;
    color: #333;
    cursor: pointer;
    font: inherit;
    padding: 5px;
    text-align: left;
  }
  .plain-btn:hover {
    background: #111;
    color: #fff;
    border-color: #111;
  }

  .btn-row {
    display: flex;
    gap: 4px;
  }
  .btn-row .plain-btn {
    text-align: center;
  }
  .plain-btn:disabled {
    opacity: 0.4;
    cursor: default;
  }

  .param-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 6px;
    padding: 1px 0;
    font-size: 10px;
    color: #555;
  }
  .param-row .changed {
    color: #000;
    font-weight: 700;
  }
  .param-row input:disabled {
    background: #eee;
    color: #999;
  }
  .param-row input {
    width: 3.6rem;
    border: 1px solid #d4d4d4;
    background: #fff;
    font: inherit;
    padding: 2px 4px;
  }

  .leg-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 6px;
    background: none;
    border: none;
    cursor: pointer;
    font-family: var(--font-mono);
    font-size: 11px;
    color: #000;
    padding: 2px 0;
    text-align: left;
    width: 100%;
  }
  .leg-count {
    font-size: 10px;
    color: #aaa;
    flex-shrink: 0;
  }
  .leg-chip {
    display: inline-block;
    padding: 1px 4px;
    font-size: 11px;
    color: #000;
    background: #e0e0e0;
  }
  .leg-row.off .leg-chip {
    background: none !important;
    color: #bbb;
    text-decoration: line-through;
  }

  .check-row {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    color: #555;
    padding: 3px 0;
    cursor: pointer;
  }
  .check-row input {
    accent-color: #555;
    cursor: pointer;
  }

  .lang-row {
    display: flex;
    gap: 2px;
  }
  .lang-btn {
    flex: 1;
    background: none;
    border: 1px solid #ddd;
    font-family: var(--font-mono);
    font-size: 10px;
    color: #999;
    cursor: pointer;
    padding: 4px 2px;
    text-align: center;
  }
  .lang-btn:hover,
  .lang-btn.active {
    background: #000;
    color: #fff;
    border-color: #000;
  }
</style>
