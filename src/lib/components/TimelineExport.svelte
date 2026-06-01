<script>
  let {
    onExportSVG = () => {},
    onExportPNG = () => {},
    exporting = false,
    exportingPng = false,
    translating = false,
    hasRows = false,
  } = $props();
</script>

{#if hasRows}
  <div class="export-panel">
    {#if translating}
      <span class="status">translating…</span>
    {/if}
    <button onclick={onExportPNG} disabled={exporting || exportingPng}>
      {exportingPng ? "rendering…" : "↓ PNG"}
    </button>
    <button onclick={onExportSVG} disabled={exporting || exportingPng}>
      {exporting ? "translating…" : "↓ SVG"}
    </button>
  </div>
{/if}

<style>
  .export-panel {
    position: fixed;
    bottom: 1rem;
    left: 1rem;
    z-index: 10;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.35rem;
  }

  button {
    background: #111;
    color: #eee;
    border: none;
    cursor: pointer;
    padding: 0.35rem 0.6rem;
    font-family: Courier, monospace;
    font-size: inherit;
  }

  button:hover:not(:disabled) {
    background: white;
    color: black;
  }

  button:disabled {
    opacity: 0.5;
    cursor: default;
  }

  .status {
    font-family: Courier, monospace;
    font-size: 0.75rem;
    color: var(--color-1);
q    opacity: 0.8;
  }
</style>
