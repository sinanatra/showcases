<script>
  import { highlightTerms } from "$lib/utils/highlightTerms.js";
  import { t } from "$lib/i18n";
  let { 
    hoveredText = "",
    hoveredTitle = "",
    hoveredUrl = "",
    tooltipX = 0,
    tooltipY = 0,
    keywords = [],
    date = "",
    isPinned = false
  } = $props();
</script>

{#if hoveredText}
  <div
    class="tooltip {isPinned ? 'pinned' : ''}"
    style="left: {tooltipX + 15}px; top: {tooltipY}px;"
  >
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
        <a href={hoveredUrl} target="_blank" rel="noopener noreferrer">Link</a>
      </div>
    {/if}
  </div>
{/if}

<style>
  .tooltip {
    position: fixed;
    background: rgba(0, 0, 0, 1);
    color: #cccccc;
    padding: 5px 10px;
    z-index: 10;
    /* pointer-events: none; */
    box-shadow: 0 2px 24px #0008;
    max-width: 450px;
    min-width: 140px;
    transform: translateY(-100%);
  }

  a {
    color: white;
  }

  :global(.highlight) {
    color: white;
    font-weight: 700;
    box-decoration-break: clone;
  }
</style>
