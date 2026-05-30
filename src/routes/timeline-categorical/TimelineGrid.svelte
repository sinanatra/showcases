<svelte:options namespace="svg" />

<script>
  import { FONT, FS, TOP_PAD, H_PAD } from "./config.js";

  let { ticks, baseline, dataSvgW } = $props();
</script>

<!-- year bands -->
{#each ticks.filter((t) => t.isYear) as t, i}
  {@const yt = ticks.filter((tt) => tt.isYear)}
  <rect
    x={Math.min(
      t.x,
      yt[i + 1]?.x ?? (dataSvgW - H_PAD),
    )}
    y={TOP_PAD}
    width={Math.abs(
      (yt[i + 1]?.x ?? (dataSvgW - H_PAD)) - t.x,
    )}
    height={baseline - TOP_PAD}
    fill="transparent"
  />
{/each}

<!-- grid lines -->
{#each ticks as t}
  <line
    x1={t.x}
    y1={TOP_PAD}
    x2={t.x}
    y2={baseline}
    stroke={t.isYear ? "#222" : "#ccc"}
    stroke-width="1"
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

<!-- axis -->
{#each ticks as t}
  <line
    x1={t.x}
    y1={baseline}
    x2={t.x}
    y2={baseline + (t.isYear ? 10 : t.isQuarter ? 6 : 3)}
    stroke={t.isYear ? "#555" : t.isQuarter ? "#999" : "#ccc"}
    stroke-width=".5"
  />
  {#if t.isYear}
    <text
      x={t.x}
      y={baseline + 22}
      text-anchor="middle"
      font-family={FONT}
      font-size={FS}
      fill="#555">{t.label}</text
    >
  {:else if t.isQuarter}
    <text
      x={t.x}
      y={baseline + 16}
      text-anchor="middle"
      font-family={FONT}
      font-size={8}
      fill="#aaa">{t.month}</text
    >
  {/if}
{/each}
