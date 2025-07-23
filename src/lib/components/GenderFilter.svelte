<script>
  import { filters, availableGenders } from "$lib/stores";
</script>

<label>
  Gender:
  <select
    bind:value={$filters.gender}
    on:change={(e) => filters.set({ ...$filters, gender: e.target.value })}
  >
    <option value="">All</option>
    {#each $availableGenders ?? [] as g}
      <option value={g}>{g}</option>
    {/each}
  </select>
</label>

<style>
  select {
    background-color: white;
    padding: 1px;
  }
</style>
