<script>
  import { filters, availableGendersLabeled } from "$lib/stores";
</script>

<label>
  Gender:
  <select
    value={$filters.gender}
    on:change={(e) => filters.update((f) => ({ ...f, gender: e.target.value }))}
  >
    <option value="">All</option>
    {#each $availableGendersLabeled ?? [] as g}
      <option value={g.value}>{g.label}</option>
    {/each}
  </select>
</label>

<style>
  select {
    background: white;
    padding: 1px;
  }
</style>
