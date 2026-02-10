<script>
  let {
    loading = false,
    errMsg = "",
    incidents = [],
    playhead = null,
    minT = null,
  } = $props();

  let orderedIncidents = $derived.by(() =>
    (Array.isArray(incidents) ? incidents.slice() : [])
      .filter((x) => Number.isFinite(x?.date))
      .sort((a, b) => a.date - b.date),
  );

  function floorIndexByDate(list, t) {
    if (!Array.isArray(list) || list.length === 0 || !Number.isFinite(t))
      return -1;
    let lo = 0;
    let hi = list.length - 1;
    let ans = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (list[mid].date <= t) {
        ans = mid;
        lo = mid + 1;
      } else hi = mid - 1;
    }
    return ans;
  }

  let currentIncident = $derived.by(() => {
    const t = Number(playhead);
    const idx = floorIndexByDate(orderedIncidents, t);
    return idx >= 0 ? orderedIncidents[idx] : null;
  });

  function fmtDateLarge(ms) {
    if (!Number.isFinite(ms)) return "—";
    const d = new Date(ms);
    if (isNaN(+d)) return "—";
    return d.toLocaleDateString("en-GB", {
      year: "numeric",
      month: "long",
      day: "2-digit",
    });
  }
</script>

{#if !loading && !errMsg}
  <aside class="hud">
    <div class="hud-date">
      {fmtDateLarge(Number.isFinite(playhead) ? playhead : minT)}
    </div>
    {#if currentIncident}
      <div class="hud-text">
        {currentIncident.sentence || currentIncident.kw}
      </div>
    {/if}
  </aside>
{/if}

<style>
  .hud {
    position: fixed;
    left: 16px;
    bottom: 16px;
    width: fit-content;
    z-index: 1;
    color: #ececec;
  }

  .hud > * {
    background-color: black;
    width: fit-content;
    padding: 0 10px;
  }

  .hud-text {
    margin-top: 6px;
    opacity: 0.9;
    max-height: min(22vh, 220px);
    overflow: auto;
  }

  @media (max-width: 700px) {
    .hud {
      left: 12px;
      right: 12px;
      width: auto;
      bottom: 12px;
      padding: 10px 12px;
    }

    .hud-text {
      font-size: 12px;
    }
  }
</style>
