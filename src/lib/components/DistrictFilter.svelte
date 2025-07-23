<script>
  import { filters, availableDistricts } from '$lib/stores';
</script>

<label>
  District:
  <select
    bind:value={$filters.district}
    on:change={e => filters.set({ ...$filters, district: e.target.value })}
  >
    <option value="">All</option>
    {#each $availableDistricts ?? [] as d}
      <option value={d}>{d}</option>
    {/each}
  </select>
</label>

<style>
  select {
    background-color: white;
    padding: 1px;
  }
</style>