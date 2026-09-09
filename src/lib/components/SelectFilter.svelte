<script>
  import { filters } from "$lib/stores";
  import { t } from "$lib/i18n";

  export let filterKey;
  export let labelKey;
  export let options;
  export let getValue = (o) => o?.value ?? o;
  export let getLabel = (o) => o?.label ?? o;
</script>

<label>
  {$t(labelKey)}
  <select
    value={$filters[filterKey]}
    on:change={(e) => filters.update((f) => ({ ...f, [filterKey]: e.target.value }))}
    aria-label={$t(labelKey)}
  >
    <option value="">{$t("filters.all")}</option>
    {#each options ?? [] as o}
      <option value={getValue(o)}>{getLabel(o)}</option>
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
