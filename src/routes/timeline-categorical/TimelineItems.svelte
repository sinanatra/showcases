<svelte:options namespace="svg" />

<script>
  import { FS, CHAR_W } from "./config.js";

  let {
    placed,
    baseline,
    translatedMap,
    lang,
    textAlign = "start",
    locationIcons = {},
  } = $props();
</script>

{#each placed as item}
  {@const catColor = item.color ?? "#999"}
  {@const op = item.active ? 1 : 0.18}
  {@const catIcon = item.icon ?? ""}
  {@const locIcon =
    item.district && locationIcons[item.district]
      ? `[${locationIcons[item.district]}]`
      : ""}
  {@const prefix = `${catIcon}${locIcon} `}
  {@const rawLabel =
    lang === "en" ? (translatedMap[item.label] ?? item.label) : item.label}
  {@const displayLabel = `${prefix}${rawLabel}`}
  {@const textY = baseline - item.y - 1}
  {@const tw = Math.ceil(displayLabel.length * CHAR_W)}
  {@const rectX =
    textAlign === "middle"
      ? item.x - tw / 2 - 2
      : textAlign === "end"
        ? item.x - tw - 2
        : item.x - 2}
  {#if item.raw?.URL}
    <a href={item.raw.URL} target="_blank" rel="noreferrer" class="item-link">
      <rect
        x={rectX}
        y={textY - FS}
        width={tw + 4}
        height={FS + 3}
        fill={catColor}
        fill-opacity={op}
        stroke="none"
        stroke-width={0}
      />
      <text
        x={item.x}
        y={textY}
        style="font-family: var(--font-mono)"
        font-size={FS}
        text-anchor={textAlign}
        fill="#000"
        opacity={op}
        class="item"
      >
        <tspan font-weight="900" font-size={FS / 2} dy={-(FS - FS / 2) / 4}>{prefix}</tspan><tspan dy={(FS - FS / 2) / 4}>{rawLabel}</tspan>
      </text>
    </a>
  {:else}
    <rect
      x={rectX}
      y={textY - FS}
      width={tw + 4}
      height={FS + 3}
      fill={catColor}
      fill-opacity={op}
      stroke="none"
      stroke-width={0}
    />
    <text
      x={item.x}
      y={textY}
      style="font-family: var(--font-mono)"
      font-size={FS}
      text-anchor={textAlign}
      fill="#000"
      opacity={op}
      class="item"
    >
      <tspan font-weight="900" font-size={FS / 2} dy={-(FS - FS / 2) / 4}>{prefix}</tspan><tspan dy={(FS - FS / 2) / 4}>{rawLabel}</tspan>
    </text>
  {/if}
{/each}
