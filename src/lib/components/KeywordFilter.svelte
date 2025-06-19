<script>
  import { filters, availableKeywords } from '$lib/stores';
</script>

<label>
  Keyword:
  <select
    bind:value={$filters.keyword}
    on:change={e => filters.set({ ...$filters, keyword: e.target.value })}
  >
    <option value="">All</option>
    {#each $availableKeywords ?? [] as kw}
      <option value={kw}>{kw}</option>
    {/each}
  </select>
</label>
