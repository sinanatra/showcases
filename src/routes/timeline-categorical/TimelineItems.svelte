<svelte:options namespace="svg" />

<script>
  import { FONT, FS, CHAR_W } from "./config.js";

  let { placed, baseline, translatedMap, lang } = $props();
</script>

{#each placed as item}
  {@const catColor = item.color ?? "#999"}
  {@const op = item.active ? 1 : 0.18}
  {@const displayLabel = lang === "en" ? (translatedMap[item.label] ?? item.label) : item.label}
  {@const textY = baseline - item.y - 1}
  {@const hw = Math.ceil(displayLabel.length * CHAR_W) / 2}
  {#if item.raw?.URL}
    <a href={item.raw.URL} target="_blank" rel="noreferrer" class="item-link">
      <rect x={item.x - hw - 2} y={textY - FS} width={hw * 2 + 4} height={FS + 3}
            fill={catColor} opacity={op} />
      <text x={item.x} y={textY} font-family={FONT} font-size={FS}
            text-anchor="middle" fill="#000" opacity={op} class="item">
        {displayLabel}
      </text>
    </a>
  {:else}
    <rect x={item.x - hw - 2} y={textY - FS} width={hw * 2 + 4} height={FS + 3}
          fill={catColor} opacity={op} />
    <text x={item.x} y={textY} font-family={FONT} font-size={FS}
          text-anchor="middle" fill="#000" opacity={op} class="item">
      {displayLabel}
    </text>
  {/if}
{/each}
