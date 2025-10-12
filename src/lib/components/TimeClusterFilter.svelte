<script>
  import { filters, availableTimeClustersLabeled } from "$lib/stores";
  import { t } from "$lib/i18n";
</script>

<label>
  {$t("filters.timeOfDay")}
  <select
    value={$filters.timeCluster}
    on:change={(e) =>
      filters.update((f) => ({ ...f, timeCluster: e.target.value }))}
    aria-label={$t("filters.timeOfDay")}
  >
    <option value="">{$t("filters.all")}</option>
    {#each $availableTimeClustersLabeled ?? [] as tc}
      <option value={tc.value}>{tc.label}</option>
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
