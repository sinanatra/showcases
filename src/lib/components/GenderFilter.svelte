<script>
  import { filters, availableGendersLabeled } from "$lib/stores";
  import { t } from "$lib/i18n";
</script>

<label>
  {$t("filters.gender")}
  <select
    value={$filters.gender}
    on:change={(e) => filters.update((f) => ({ ...f, gender: e.target.value }))}
    aria-label={$t("filters.gender")}
  >
    <option value="">{$t("filters.all")}</option>
    {#each $availableGendersLabeled ?? [] as g}
      <option value={g.value}>{g.label}</option>
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
