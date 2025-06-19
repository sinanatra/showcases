<script>
  import { filters, availableTimeClusters } from '$lib/stores';
</script>

<label>
  Time of Day:
  <select
    bind:value={$filters.timeCluster}
    on:change={e => filters.set({ ...$filters, timeCluster: e.target.value })}
  >
    <option value="">All</option>
    {#each $availableTimeClusters ?? [] as tc}
      <option value={tc}>{tc}</option>
    {/each}
  </select>
</label>
