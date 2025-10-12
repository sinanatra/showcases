<script>
  import { filters, availableKeywords } from "$lib/stores";
  import { t } from "$lib/i18n";
</script>

<label>
  {$t("filters.keyword")}
  <select
    bind:value={$filters.keyword}
    on:change={(e) => filters.set({ ...$filters, keyword: e.target.value })}
    aria-label={$t("filters.keyword")}
  >
    <option value="">{$t("filters.all")}</option>
    {#each $availableKeywords ?? [] as kw}
      <option value={kw}>{kw}</option>
    {/each}
  </select>
</label>

<style>
  label {
    display: flex;
    gap: 0.2rem;
    align-items: center;
    font-family: Arial, sans-serif;
  }
  select {
    background: #fff;
    padding: 1px;
    width: 150px;
  }
</style>
