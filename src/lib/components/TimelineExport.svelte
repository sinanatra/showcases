<script>
  let {
    onExportSVG = () => {},
    onExportPNG = () => {},
    onExportPDF = () => {},
    exporting = false,
    exportingPng = false,
    exportingPdf = false,
    translating = false,
    hasRows = false,
    pdfWidthCm = $bindable(null),
    pdfHeightCm = $bindable(null),
  } = $props();

  const parseCm = (/** @type {string} */ v) => (v === "" ? null : Math.max(1, Number(v)));
</script>

{#if hasRows}
  <div class="export-section">
    {#if translating}
      <span class="status">translating…</span>
    {/if}
    <div class="pdf-size" title="PDF page size — leave blank to size it from the chart itself">
      <input
        type="number"
        min="1"
        placeholder="auto"
        value={pdfWidthCm ?? ""}
        oninput={(e) => (pdfWidthCm = parseCm(e.currentTarget.value))}
      />
      <span class="times">×</span>
      <input
        type="number"
        min="1"
        placeholder="auto"
        value={pdfHeightCm ?? ""}
        oninput={(e) => (pdfHeightCm = parseCm(e.currentTarget.value))}
      />
      <span class="unit">cm</span>
    </div>
    <div class="export-buttons">
      <button onclick={onExportPNG} disabled={exporting || exportingPng || exportingPdf}>
        {exportingPng ? "rendering…" : "↓ PNG"}
      </button>
      <button onclick={onExportPDF} disabled={exporting || exportingPng || exportingPdf}>
        {exportingPdf ? "rendering…" : "↓ PDF"}
      </button>
      <button onclick={onExportSVG} disabled={exporting || exportingPng || exportingPdf}>
        {exporting ? "translating…" : "↓ SVG"}
      </button>
    </div>
  </div>
{/if}

<style>
  .export-section {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .pdf-size {
    display: flex;
    align-items: center;
    gap: 4px;
    color: #999;
  }

  .pdf-size input {
    width: 3.2rem;
    border: 1px solid #d4d4d4;
    background: #fff;
    font: inherit;
    padding: 3px 5px;
  }

  .pdf-size .times {
    opacity: 0.6;
  }

  .export-buttons {
    display: flex;
    gap: 4px;
  }

  .export-buttons button {
    flex: 1;
    border: 1px solid #bbb;
    background: #fff;
    color: #333;
    cursor: pointer;
    font: inherit;
    padding: 5px;
  }

  .export-buttons button:hover:not(:disabled) {
    background: #111;
    color: #fff;
    border-color: #111;
  }

  .export-buttons button:disabled {
    opacity: 0.5;
    cursor: default;
  }

  .status {
    font-size: 10px;
    color: #6b8e23;
  }
</style>
