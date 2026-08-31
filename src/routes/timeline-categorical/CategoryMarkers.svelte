<svelte:options namespace="svg" />

<script>
  import { MARKER_LABEL_FS } from "./config.js";

  let { branchPaths } = $props();
</script>

<defs>
  {#each branchPaths as bp}
    <path id={bp.id} d={bp.d} fill="none" stroke="none" />
  {/each}
</defs>

{#each branchPaths as bp}
  <text
    font-size={MARKER_LABEL_FS}
    fill="#000"
    stroke="#fff"
    stroke-width="4"
    paint-order="stroke fill"
    style="font-family: var(--font-mono)"
    text-anchor="middle"
    ><textPath href={`#${bp.id}`} startOffset={bp.startOffset}
      >{bp.cat.label}</textPath
    ></text
  >
{/each}
