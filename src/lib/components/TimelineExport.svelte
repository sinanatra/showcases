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
    /** wanted text size on paper (pt); null = follows from the size */
    textPtTarget = $bindable(null),
    /** the exported file is 1/exportDivisor of the print size */
    exportDivisor = $bindable(1),
    /** resulting text size (pt) and print size [w, h] in cm */
    textPt = null,
    /** @type {number[]|null} */
    printSizeCm = null,
    fitNote = "",
    tooTall = false,
  } = $props();

  const parsePt = (/** @type {string} */ v) => (v === "" || !(Number(v) > 0) ? null : Number(v));

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
        placeholder={printSizeCm ? String(Math.round(printSizeCm[0])) : "auto"}
        value={pdfWidthCm ?? ""}
        onchange={(e) => (pdfWidthCm = parseCm(e.currentTarget.value))}
      />
      <span class="times">×</span>
      <input
        type="number"
        min="1"
        placeholder={printSizeCm ? String(Math.round(printSizeCm[1])) : "auto"}
        value={pdfHeightCm ?? ""}
        onchange={(e) => (pdfHeightCm = parseCm(e.currentTarget.value))}
      />
      <span class="unit">cm</span>
    </div>
    <div class="pdf-size" title="Fix any of width, height and text size; what you leave empty follows from the chart and is shown in grey.">
      <span class="unit">text</span>
      <input
        type="number"
        min="1"
        step="0.5"
        placeholder={textPt ? String(Math.round(textPt * 10) / 10) : "auto"}
        value={textPtTarget ?? ""}
        onchange={(e) => (textPtTarget = parsePt(e.currentTarget.value))}
      />
      <span class="unit">pt</span>
    </div>
    {#if fitNote}
      <span class="size" class:warn={tooTall}>{fitNote}</span>
    {/if}
    <div class="pdf-size" title="Export the file smaller than the print size. Everything is vector, so the printer scales it back up without loss.">
      <span class="unit">file 1 /</span>
      <input
        type="number"
        min="1"
        step="1"
        value={exportDivisor}
        onchange={(e) => (exportDivisor = Math.max(1, Number(e.currentTarget.value) || 1))}
      />
    </div>
    {#if exportDivisor > 1 && printSizeCm}
      <span class="size">
        file {Math.round(printSizeCm[0] / exportDivisor)} × {Math.round(printSizeCm[1] / exportDivisor)} cm,
        text {textPt ? Math.round((textPt / exportDivisor) * 10) / 10 : "–"} pt.
        Print at {exportDivisor * 100} %.
      </span>
    {/if}
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
  .size {
    color: #333;
  }
  .size.warn {
    color: #c0392b;
  }
</style>
