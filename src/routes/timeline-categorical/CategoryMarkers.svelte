<svelte:options namespace="svg" />

<script>
  import { MARKER_LABEL_DY, MARKER_LABEL_FS } from "./config.js";

  let { branchPaths } = $props();
</script>

<defs>
  {#each branchPaths as bp}
    <path id={bp.id} d={bp.d} fill="none" stroke="none" />
  {/each}
</defs>

{#each branchPaths as bp}
  <text
    dy={MARKER_LABEL_DY}
    font-size={MARKER_LABEL_FS}
    fill="#000"
    stroke="#fff"
    stroke-width="4"
    paint-order="stroke fill"
    style="font-family: var(--font-mono)"
    text-anchor="middle"
    ><textPath href={`#${bp.id}`} startOffset={bp.startOffset}>{bp.text}</textPath></text
  >
{/each}
