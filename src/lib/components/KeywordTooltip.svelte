<script>
  import { highlightTerms } from "$lib/utils/highlightTerms.js";
  export let hoveredText = "";
  export let hoveredTitle = "";

  export let hoveredUrl = "";
  export let tooltipX = 0;
  export let tooltipY = 0;
  export let keywords = [];
  export let date = "";
</script>

{#if hoveredText}
  <div class="tooltip" style="left: {tooltipX + 15}px; top: {tooltipY}px;">
    {#if date}
      <div style="font-size: 0.98em; margin-bottom: 0.25em;">
        <b>{date}</b>
      </div>
    {/if}
    {#if hoveredTitle}
      <div style="font-size: 0.98em; ; margin-bottom: 0.25em;">
        {@html highlightTerms(hoveredTitle, keywords)}
      </div>
    {/if}
    {@html highlightTerms(hoveredText, keywords)}
    {#if hoveredUrl}
      <div style="font-size:0.92em; margin-top:0.5em;">
        [Press <kbd>space</kbd> to open link]
      </div>
    {/if}
  </div>
{/if}

<style>
  .tooltip {
    position: fixed;
    background: rgba(0, 0, 0, 1);
    color: #cccccc;
    border-radius: 9px;
    padding: 5px 10px;
    z-index: 10000;
    pointer-events: none;
    box-shadow: 0 2px 24px #0008;
    max-width: 450px;
    min-width: 140px;
    transform: translateY(-100%);
  }

  :global(.highlight) {
    color: white;

    border-radius: 3px;
    font-weight: 700;
    box-decoration-break: clone;
  }
</style>
