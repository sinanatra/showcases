<svelte:options namespace="svg" />

<script>
  import { TOP_PAD, DATE_FS, AXIS_LABEL_GAP } from "./config.js";

  let { ticks, baseline, dataSvgW } = $props();
</script>

<!-- grid lines -->
{#each ticks as t}
  <line
    x1={t.x}
    y1={TOP_PAD}
    x2={t.x}
    y2={baseline}
    stroke={t.isYear ? "#888" : t.isWeek ? "#f0f0f0" : "#e0e0e0"}
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

<!-- axis labels — month/year only, skip week ticks -->
{#each ticks.filter(t => !t.isWeek) as t}
  <text
    x={t.x}
    y={baseline + AXIS_LABEL_GAP}
    text-anchor="middle"
    style="font-family: var(--font-mono)"
    font-size={DATE_FS}
    font-weight={400}
    fill="#000"
  >{t.label}</text>
{/each}
