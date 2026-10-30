<script>
  let { all, reports, time, current, onpick } = $props();

  const oldest = $derived(all.length ? time(all.at(-1)) : 0);
  const newest = $derived(all.length ? time(all[0]) : 1);
  const at = (ms) => ((newest - ms) / (newest - oldest || 1)) * 100;

  const lines = (list) => list.map((d) => `M${at(time(d)).toFixed(3)} 0V1`).join("");
  const others = $derived.by(() => {
    const inPile = new Set(reports);
    return lines(all.filter((d) => !inPile.has(d)));
  });
  const pile = $derived(lines(reports));

  const years = $derived.by(() => {
    const out = [];
    const first = new Date(oldest).getFullYear();
    for (let y = new Date(newest).getFullYear(); y >= first; y--)
      out.push({ year: y, left: Math.max(0, at(+new Date(y + 1, 0, 1))) });
    return out;
  });

  function pick(e) {
    const i = reports.findIndex((d) => time(d) <= +e.currentTarget.value);
    onpick(i < 0 ? reports.length - 1 : i);
  }
</script>

<div class="bar">
  <svg viewBox="0 0 100 1" preserveAspectRatio="none" aria-hidden="true">
    <path d={others} class="others" />
    <path d={pile} />
  </svg>
  {#each years as { year, left } (year)}
    <span style:left="{left}%">{year}</span>
  {/each}
  <input
    dir="rtl"
    type="range"
    aria-label="Timeline"
    min={oldest}
    max={newest}
    step="86400000"
    value={current}
    oninput={pick}
  />
</div>

<style>
  .bar {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 2;
    height: 20px;
    box-sizing: border-box;
    background: #fff;
    border-bottom: 1px solid #000;
  }
  svg {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
  }
  path {
    fill: none;
    stroke: #000;
    stroke-width: 1px;
    vector-effect: non-scaling-stroke;
  }
  .others {
    stroke: #dcdcdc;
  }
  span {
    position: absolute;
    top: 3px;
    padding: 0 3px;
    font-family: Arial, Helvetica, sans-serif;
    font-size: 11px;
    line-height: 13px;
    color: #000;
    background: #fff;
    pointer-events: none;
  }
  input {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    margin: 0;
    background: none;
    appearance: none;
    cursor: pointer;
  }
  input::-webkit-slider-runnable-track {
    height: 100%;
    background: none;
  }
  input::-moz-range-track {
    height: 100%;
    background: none;
  }
  input::-webkit-slider-thumb {
    appearance: none;
    width: 4px;
    height: 19px;
    background: #f00;
    border: 0;
    border-radius: 0;
    cursor: ew-resize;
  }
  input::-moz-range-thumb {
    width: 4px;
    height: 19px;
    background: #f00;
    border: 0;
    border-radius: 0;
    cursor: ew-resize;
  }
</style>
