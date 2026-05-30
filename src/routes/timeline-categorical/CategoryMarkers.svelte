<svelte:options namespace="svg" />

<script>
  import { FONT, CAT_COLORS } from "./config.js";

  let { catMarkers, counts, baseline, translatedMap, lang, catColors } = $props();
</script>

<!-- category marker tick lines (rendered first, behind labels) -->
{#each catMarkers as m}
  {#if m.hasTick && (counts[m.cat.id] ?? 0) > 0}
    {@const color = catColors[m.colorIdx % catColors.length]}
    {@const opacity = m.cat.on ? 1 : 0.18}
    {@const labelY = baseline + 36 + m.yOff}
    <line
      x1={m.x}
      y1={baseline}
      x2={m.x}
      y2={labelY - 10}
      stroke={color}
      stroke-width=".5"
      {opacity}
    />
  {/if}
{/each}

<!-- category marker labels (rendered on top of tick lines) -->
{#each catMarkers as m}
  {@const hasItems = (counts[m.cat.id] ?? 0) > 0}
  {#if hasItems}
  {@const color = catColors[m.colorIdx % catColors.length]}
  {@const opacity = m.cat.on ? 1 : 0.18}
  {@const labelY = baseline + 36 + m.yOff}
  {@const labelText = lang === "en" ? (translatedMap[m.cat.label] ?? m.cat.label) : m.cat.label}
  {@const labelW = labelText.length * 5.4 + 6}
  {@const activeDescLines = hasItems ? m.descLines : []}
  {@const descW = activeDescLines.length ? Math.max(...activeDescLines.map(/** @param {any} l */ l => l.length)) * 4.2 + 6 : 0}
  {@const bgW = Math.max(labelW, descW)}
  {@const bgH = 11 + activeDescLines.length * 9.5 + 6}
  <rect
    x={m.x - 2}
    y={labelY - 10}
    width={bgW}
    height={bgH}
    fill="white"
  />
  <text
    x={m.x}
    y={labelY}
    font-family={FONT}
    font-size={9}
    fill={color}
    text-anchor="start"
    {opacity}>{labelText}</text
  >
  {#if activeDescLines.length}
    <text
      x={m.x}
      y={labelY + 11}
      font-family={FONT}
      font-size={7}
      fill={color}
      opacity={m.cat.on ? 0.7 : 0.3}
      text-anchor="start"
    >
      {#each activeDescLines as line, i}
        <tspan x={m.x} dy={i === 0 ? 0 : "1.3em"}>{line}</tspan>
      {/each}
    </text>
  {/if}
  {/if}
{/each}
