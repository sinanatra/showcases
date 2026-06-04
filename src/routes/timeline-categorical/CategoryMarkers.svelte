<svelte:options namespace="svg" />

<script>
  import { FONT, MARKER_LABEL_FS, MARKER_DESC_FS } from "./config.js";

  const LABEL_CW   = MARKER_LABEL_FS * 0.601;
  const DESC_CW    = MARKER_DESC_FS  * 0.601;
  const LABEL_H    = MARKER_LABEL_FS + 4;
  const DESC_LINE_H = MARKER_DESC_FS + 2;
  const PAD        = 4;

  let { catMarkers, counts, baseline, translatedMap, lang } = $props();
</script>

<!-- category marker tick lines (rendered first, behind labels) -->
{#each catMarkers as m}
  {#if m.hasTick && (counts[m.cat.id] ?? 0) > 0}
    {@const color = m.cat.color ?? "#999"}
    {@const opacity = m.cat.on ? 1 : 0.18}
    {@const labelY = baseline + 36 + m.yOff}
    <line
      x1={m.x}
      y1={baseline}
      x2={m.x}
      y2={labelY - MARKER_LABEL_FS}
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
  {@const color = m.cat.color ?? "#999"}
  {@const opacity = m.cat.on ? 1 : 0.18}
  {@const labelY = baseline + 36 + m.yOff}
  {@const labelText = lang === "en" ? (translatedMap[m.cat.label] ?? m.cat.label) : m.cat.label}
  {@const labelW = labelText.length * LABEL_CW + PAD * 2}
  {@const activeDescLines = hasItems ? m.descLines : []}
  {@const descW = activeDescLines.length ? Math.max(...activeDescLines.map(/** @param {any} l */ l => l.length)) * DESC_CW + PAD * 2 : 0}
  {@const bgW = Math.max(labelW, descW)}
  {@const descBlockH = activeDescLines.length * DESC_LINE_H + PAD}
  <!-- colored rect for title -->
  <rect
    x={m.x}
    y={labelY - MARKER_LABEL_FS}
    width={labelW}
    height={LABEL_H}
    fill={color}
    {opacity}
  />
  <!-- white rect for description -->
  {#if activeDescLines.length}
    <rect
      x={m.x}
      y={labelY - MARKER_LABEL_FS + LABEL_H}
      width={bgW}
      height={descBlockH}
      fill="white"
      {opacity}
    />
  {/if}
  <text
    x={m.x + PAD}
    y={labelY}
    font-family={FONT}
    font-size={MARKER_LABEL_FS}
    fill="#000"
    text-anchor="start"
    {opacity}>{labelText}</text
  >
  {#if activeDescLines.length}
    <text
      x={m.x + PAD}
      y={labelY - MARKER_LABEL_FS + LABEL_H + MARKER_DESC_FS + 2}
      font-family={FONT}
      font-size={MARKER_DESC_FS}
      fill="#000"
      opacity={m.cat.on ? 0.7 : 0.3}
      text-anchor="start"
    >
      {#each activeDescLines as line, i}
        <tspan x={m.x + PAD} dy={i === 0 ? 0 : "1.3em"}>{line}</tspan>
      {/each}
    </text>
  {/if}
  {/if}
{/each}
