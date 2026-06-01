<svelte:options namespace="svg" />

<script>
  import { FONT, TOP_PAD } from "./config.js";

  let { ticks, baseline, dataSvgW } = $props();
</script>

<!-- grid lines -->
{#each ticks as t}
  <line
    x1={t.x}
    y1={TOP_PAD}
    x2={t.x}
    y2={baseline}
    stroke={t.isYear ? "#888" : "#e8e8e8"}
    stroke-width=".5"
  />
{/each}

<!-- baseline -->
<line
  x1={0}
  y1={baseline}
  x2={dataSvgW}
  y2={baseline}
  stroke="#888"
  stroke-width=".5"
/>

<!-- axis labels — all identical style -->
{#each ticks as t}
  <text
    x={t.x}
    y={baseline + 14}
    text-anchor="middle"
    font-family={FONT}
    font-size={8}
    fill="#aaa"
  >{t.isFirst || t.isLast
      ? `${t.month} ${t.year}`
      : t.isYear
        ? t.year
        : t.month}</text>
{/each}
