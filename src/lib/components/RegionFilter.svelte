<script>
  import { filters, availableRegions } from "$lib/stores";
  import { t } from "$lib/i18n";
  const labels = { berlin: "Berlin", brandenburg: "Brandenburg" };
</script>

<label>
  {$t("filters.region")}
  <select
    value={$filters.region}
    on:change={(e) => filters.update((f) => ({ ...f, region: e.target.value }))}
    aria-label={$t("filters.region")}
  >
    <option value="">{$t("filters.all")}</option>
    {#each $availableRegions ?? [] as r}
      <option value={r}>{labels[r] ?? r}</option>
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
