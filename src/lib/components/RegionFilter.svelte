<script>
  import { filters, availableRegions } from "$lib/stores";
  const labels = { berlin: "Berlin", brandenburg: "Brandenburg" };
</script>

<label>
  Region:
  <select
    value={$filters.region}
    on:change={(e) => filters.update((f) => ({ ...f, region: e.target.value }))}
  >
    <option value="">All</option>
    {#each $availableRegions ?? [] as r}
      <option value={r}>{labels[r] ?? r}</option>
    {/each}
  </select>
</label>

<style>
  select {
    background: white;
    padding: 1px;
  }
</style>
