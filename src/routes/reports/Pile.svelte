<script>
  import FlyingSheet from "./FlyingSheet.svelte";
  import Sheet from "./Sheet.svelte";
  import { toSheet } from "./report.js";
  import {
    W,
    H,
    GAP,
    STEP,
    FLIGHT,
    fit,
    boxHeight,
    dropOf,
    outline,
  } from "./pile.js";

  let { reports, top, progress, query, map } = $props();

  let width = $state(1200);
  let height = $state(800);

  const t = $derived(Math.min(1, progress - top));
  const scale = $derived(fit(width, height));
  const drop = $derived(dropOf(scale));
  const points = $derived(outline(scale));

  const depths = $derived.by(() => {
    const onScreen = Math.ceil((height + boxHeight(scale)) / 2 / drop) + 1;
    const lowest = Math.min(reports.length - top - 1, onScreen);
    return Array.from(
      { length: Math.max(0, lowest - 1) },
      (_, k) => lowest - k,
    );
  });

  const flown = (i) =>
    i < reports.length - 1
      ? Math.max(0, Math.min(1, (progress - i) / FLIGHT))
      : 0;

  const sheets = $derived(
    [top + 1, top, top - 1].filter((i) => reports[i] && flown(i) < 1),
  );
</script>

<svelte:window bind:innerWidth={width} bind:innerHeight={height} />

{#if reports[top + 2]}
  <div
    class="scout"
    style:width="{W}px"
    style:height="{H}px"
    aria-hidden="true"
  >
    <Sheet sheet={toSheet(reports[top + 2], query, map)} />
  </div>
{/if}

<div style:height="{(reports.length + FLIGHT - 2) * height * STEP + height}px">
  <div class="stage">
    {#if reports.length}
      <svg
        class="stack"
        aria-hidden="true"
        style:transform="translateY({-t * drop}px)"
      >
        {#each depths as depth (depth)}
          <polygon {points} transform="translate(0 {depth * drop})" />
        {/each}
      </svg>

      {#each sheets as i (i)}
        <FlyingSheet
          sheet={toSheet(reports[i], query, map)}
          index={i}
          t={flown(i)}
          rise={i > top ? (t - 1) * GAP : 0}
          {scale}
          {width}
          {height}
        />
      {/each}
    {/if}
  </div>
</div>

<style>
  .stage {
    position: sticky;
    top: 0;
    height: 100vh;
    overflow: hidden;
  }
  .scout {
    position: fixed;
    top: 0;
    left: 0;
    container-type: size;
    visibility: hidden;
    pointer-events: none;
  }

  .stack {
    position: absolute;
    left: 50%;
    top: 50%;
    width: 1px;
    height: 1px;
    overflow: visible;
    will-change: transform;
  }
  polygon {
    fill: #fff;
    stroke: #ccc;
    stroke-width: 1;
    stroke-linejoin: round;
  }
</style>
