<script>
  import CategoryJsonEditor from "./CategoryJsonEditor.svelte";
  import TimelineExport from "$lib/components/TimelineExport.svelte";

  let {
    categories = $bindable([]),
    showBerlin = $bindable(true),
    showBrandenburg = $bindable(false),
    langMode = $bindable("both"),
    pdfWidthCm = $bindable(null),
    pdfHeightCm = $bindable(null),
    counts = {},
    hasRows = false,
    exporting = false,
    exportingPng = false,
    exportingPdf = false,
    onRebuild = () => {},
    onResetZoom = () => {},
    onExportSVG = () => {},
    onExportPNG = () => {},
    onExportPDF = () => {},
  } = $props();

  function notifyChange() {
    onRebuild();
  }
</script>

<aside class="panel">
  <div class="panel-body">
    <div class="section-title">View</div>
    <button class="plain-btn" onclick={onResetZoom}>Fit to viewport</button>

    <div class="section-title" style="margin-top:16px">Categories</div>
    {#each categories as cat}
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

    <div class="section-title" style="margin-top:16px">Export</div>
    <TimelineExport
      {hasRows}
      {exporting}
      {exportingPng}
      {exportingPdf}
      bind:pdfWidthCm
      bind:pdfHeightCm
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
