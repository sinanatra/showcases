<svelte:options namespace="svg" />

<script>
  import { TICK_STROKE, TICK_COLOR_YEAR, TICK_COLOR, TICK_COLOR_MID, DEFAULT_REVERSED } from "./config.js";
  import { settings, dateCW } from "./settings.svelte.js";

  let TOP_PAD = $derived(settings.TOP_PAD);
  let DATE_FS = $derived(settings.DATE_FS);
  let DATE_CW = $derived(dateCW());
  let AXIS_LABEL_GAP = $derived(settings.AXIS_LABEL_GAP);
  let YEAR_FS = $derived(settings.YEAR_FS);

  let { ticks, baseline, dataSvgW } = $props();

  let visibleLabels = $derived.by(() => {
    const labelW = Math.max(...ticks.map((t) => t.label?.length ?? 0), 1) * DATE_CW;
    const GAP = 6;
    const monthTicks = ticks.filter((t) => !t.isWeek);
    const yearTicks = monthTicks.filter((t) => t.isYear);
    const otherTicks = monthTicks.filter((t) => !t.isYear).slice().sort((a, b) => a.x - b.x);

    const spans = yearTicks.map((t) => [t.x - labelW / 2, t.x + labelW / 2]);
    const result = [...yearTicks];
    for (const t of otherTicks) {
      const left = t.x - labelW / 2, right = t.x + labelW / 2;
      const overlaps = spans.some(([sL, sR]) => left < sR + GAP && right > sL - GAP);
      if (!overlaps) {
        spans.push([left, right]);
        result.push(t);
      }
    }
    return result;
  });
</script>

{#each ticks as t}
  <line
    x1={t.x}
    y1={TOP_PAD}
    x2={t.x}
    y2={baseline}
    stroke={t.isYear ? TICK_COLOR_YEAR : t.isWeek ? TICK_COLOR_MID : TICK_COLOR}
    stroke-width={TICK_STROKE}
  />
{/each}

<line
  x1={0}
  y1={baseline}
  x2={dataSvgW}
  y2={baseline}
  stroke="#888"
  stroke-width=".5"
/>

{#each visibleLabels as t}
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

{#if YEAR_FS > 0}
  {#each ticks.filter((t) => t.isYear) as t}
    <text
      x={t.x}
      y={baseline + AXIS_LABEL_GAP + DATE_FS * 0.4 + YEAR_FS}
      dx={DEFAULT_REVERSED ? -YEAR_FS * 0.15 : YEAR_FS * 0.15}
      text-anchor={DEFAULT_REVERSED ? "end" : "start"}
      style="font-family: var(--font-mono)"
      font-size={YEAR_FS}
      font-weight={400}
      fill="#000"
    >{t.year}</text>
  {/each}
{/if}
