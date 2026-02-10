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

  function dayKey(ms) {
    if (!Number.isFinite(ms)) return "";
    const d = new Date(ms);
    if (isNaN(+d)) return "";
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${dd}`;
  }

  let incidentsByDay = $derived.by(() => {
    const map = new Map();
    for (let i = 0; i < orderedIncidents.length; i++) {
      const inc = orderedIncidents[i];
      const key = dayKey(inc?.date);
      if (key && !map.has(key)) map.set(key, inc);
    }
    return map;
  });

  let currentIncident = $derived.by(() => {
    const key = dayKey(Number(playhead));
    if (!key) return null;
    return incidentsByDay.get(key) || null;
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
    {:else}
      <div class="hud-text"></div>
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
    min-height: 20px;
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
