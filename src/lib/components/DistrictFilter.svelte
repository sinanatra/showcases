<script>
  import { filters, availableDistricts } from "$lib/stores";
  import { t } from "$lib/i18n";
</script>

<label>
  {$t("filters.district")}
  <select
    bind:value={$filters.district}
    on:change={(e) => filters.set({ ...$filters, district: e.target.value })}
    aria-label={$t("filters.district")}
  >
    <option value="">{$t("filters.all")}</option>
    {#each $availableDistricts ?? [] as d}
      <option value={d}>{d}</option>
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
