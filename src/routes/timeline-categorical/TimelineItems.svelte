<svelte:options namespace="svg" />

<script>
  import { FONT, FS } from "./config.js";

  let { placed, baseline, translatedMap, lang, catColors } = $props();
</script>

{#each placed as item}
  {@const catColor = catColors[item.colorIdx % catColors.length]}
  {@const op = item.active ? 1 : 0.18}
  {@const displayLabel = lang === "en" ? (translatedMap[item.label] ?? item.label) : item.label}
  {@const textY = baseline - item.y - 1}
  {#if item.raw?.URL}
    <a href={item.raw.URL} target="_blank" rel="noreferrer" class="item-link">
      <text x={item.x} y={textY} font-family={FONT} font-size={FS}
            text-anchor="middle" fill={item.active ? catColor : "#ccc"} opacity={op} class="item">
        {displayLabel}
      </text>
    </a>
  {:else}
    <text x={item.x} y={textY} font-family={FONT} font-size={FS}
          text-anchor="middle" fill={item.active ? catColor : "#ccc"} opacity={op} class="item">
      {displayLabel}
    </text>
  {/if}
{/each}
