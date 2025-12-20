<script>
  import {
    articles,
    filtered,
    keywordsGroup,
    availableGendersLabeled,
  } from "$lib/stores";

  const canon = (k) => keywordsGroup[String(k).toLowerCase()] ?? String(k);

  const canonGender = (g) => {
    const x = String(g).toLowerCase();
    if (x === "frau") return "Adult Female";
    if (x === "mann") return "Adult Male";
    if (x === "junge" || x === "mädchen" || x === "jugendliche") return "Youth";
    return "Other";
  };

  let total = $derived(Array.isArray($articles) ? $articles.length : 0);
  let shown = $derived(Array.isArray($filtered) ? $filtered.length : 0);

  let byKeyword = $derived.by(() => {
    const m = new Map();
    ($filtered ?? []).forEach((a) => {
      (Array.isArray(a.KeywordMatch) ? a.KeywordMatch : []).forEach((k) => {
        const c = canon(k);
        m.set(c, (m.get(c) ?? 0) + 1);
      });
    });
    return Array.from(m.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  });

  let byDistrict = $derived.by(() => {
    const m = new Map();
    ($filtered ?? []).forEach((a) => {
      const d = a.ExtractedDistrict || "(unknown)";
      m.set(d, (m.get(d) ?? 0) + 1);
    });
    return Array.from(m.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  });

  let byTime = $derived.by(() => {
    const m = new Map();
    ($filtered ?? []).forEach((a) => {
      (Array.isArray(a.ExtractedTime) ? a.ExtractedTime : []).forEach((t) => {
        const h = Number(String(t).split(":")[0]);
        const label =
          h >= 6 && h < 12
            ? "Morning"
            : h >= 12 && h < 18
              ? "Afternoon"
              : h >= 18 && h < 24
                ? "Evening"
                : "Night";
        m.set(label, (m.get(label) ?? 0) + 1);
      });
    });
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  });

  let byGender = $derived.by(() => {
    const counts = new Map();
    ($filtered ?? []).forEach((a) => {
      const gs = Array.isArray(a.ExtractedGender) ? a.ExtractedGender : [];
      (gs.length ? gs : ["Other"]).forEach((g) => {
        const v = canonGender(g);
        counts.set(v, (counts.get(v) ?? 0) + 1);
      });
    });

    const labelMap = new Map(
      ($availableGendersLabeled ?? []).map((g) => [g.value, g.label])
    );
    return Array.from(counts.entries())
      .map(([value, count]) => ({
        value,
        label: labelMap.get(value) ?? value,
        count,
      }))
      .sort((a, b) => b.count - a.count);
  })();
</script>

<div class="stats">
  <div><strong>{shown}</strong> shown of <strong>{total}</strong> total</div>
  <div class="row">
    <div>
      <div class="h">Top keywords</div>
      {#if byKeyword.length === 0}—{/if}
      {#each byKeyword as [k, c]}
        <div>{k}: {c}</div>
      {/each}
    </div>

    <div>
      <div class="h">Top districts</div>
      {#if byDistrict.length === 0}—{/if}
      {#each byDistrict as [d, c]}
        <div>{d}: {c}</div>
      {/each}
    </div>

    <div>
      <div class="h">Time of day</div>
      {#if byTime.length === 0}—{/if}
      {#each byTime as [t, c]}
        <div>{t}: {c}</div>
      {/each}
    </div>

    <!-- NEW -->
    <div>
      <div class="h">Genders</div>
      {#if byGender.length === 0}—{/if}
      {#each byGender as g}
        <div>{g.label}: {g.count}</div>
      {/each}
    </div>
  </div>
</div>

<style>
  .stats {
    padding: 8px 10px;
    background: #fafafa;
    border: 1px solid #eee;
    border-radius: 8px;
  }
  .row {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr)); /* was 3 */
    gap: 12px;
    margin-top: 6px;
  }
  .h {
    font-weight: 600;
    margin-bottom: 4px;
  }
  @media (max-width: 720px) {
    .row {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
</style>
