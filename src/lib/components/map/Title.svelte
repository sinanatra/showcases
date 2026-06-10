<script>
  import { getMapViewLabel } from "$lib/components/map/viewLabel";

  let { regionFilter = "all", districtFilter = "" } = $props();

  let viewLabel = $derived.by(() =>
    getMapViewLabel(regionFilter, districtFilter),
  );
</script>

{#if viewLabel}
  <div class="map-view-label" aria-hidden="true">
    <div class="title">{viewLabel}</div>
  </div>
{/if}

<style>
  .map-view-label {
    position: fixed;
    top: 2vh;
    right: 1.8vw;
    z-index: 1;
    pointer-events: none;
    font-family: var(--font-mono);
    color: rgba(255, 255, 255, 0.95);
    background: rgba(0, 0, 0, 0.62);
    border-radius: 6px;
    padding: 8px 12px;
    max-width: min(48vw, 560px);
  }

  .title {
    font-size: clamp(14px, 1.25vw, 26px);
    line-height: 1.15;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
</style>
