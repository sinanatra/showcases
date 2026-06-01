<svelte:options namespace="svg" />

<script>
  import { FONT, FS, CHAR_W } from "./config.js";

  let { placed, baseline, translatedMap, lang, textAlign = "start" } = $props();
</script>

{#each placed as item}
  {@const catColor = item.color ?? "#999"}
  {@const op = item.active ? 1 : 0.18}
  {@const displayLabel = lang === "en" ? (translatedMap[item.label] ?? item.label) : item.label}
  {@const textY = baseline - item.y - 1}
  {@const tw = Math.ceil(displayLabel.length * CHAR_W)}
  {@const rectX = textAlign === "middle" ? item.x - tw / 2 - 2 : textAlign === "end" ? item.x - tw - 2 : item.x - 2}
  {#if item.raw?.URL}
    <a href={item.raw.URL} target="_blank" rel="noreferrer" class="item-link">
      <rect x={rectX} y={textY - FS} width={tw + 4} height={FS + 3}
            fill={catColor} opacity={op} />
      <text x={item.x} y={textY} font-family={FONT} font-size={FS}
            text-anchor={textAlign} fill="#000" opacity={op} class="item">
        {displayLabel}
      </text>
    </a>
  {:else}
    <rect x={rectX} y={textY - FS} width={tw + 4} height={FS + 3}
          fill={catColor} opacity={op} />
    <text x={item.x} y={textY} font-family={FONT} font-size={FS}
          text-anchor={textAlign} fill="#000" opacity={op} class="item">
      {displayLabel}
    </text>
  {/if}
{/each}
