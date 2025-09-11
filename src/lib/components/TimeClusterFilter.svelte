<script>
  import { filters, availableTimeClustersLabeled } from "$lib/stores";
</script>

<label>
  Time of Day:
  <select
    value={$filters.timeCluster}
    on:change={(e) =>
      filters.update((f) => ({ ...f, timeCluster: e.target.value }))}
  >
    <option value="">All</option>
    {#each $availableTimeClustersLabeled ?? [] as tc}
      <option value={tc.value}>{tc.label}</option>
    {/each}
  </select>
</label>

<style>
  select {
    background: white;
    padding: 1px;
  }
</style>
