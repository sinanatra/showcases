<script>
  // The filter bar of the site, reading and writing the shared `filters` store.
  // <Query fields={["keyword", "year", "search"]} /> shows those fields in that order.
  // Colours and direction come from --query-bg, --query-fg, --query-direction.
  import {
    filters,
    availableRegions,
    availableDistricts,
    availableKeywordsLabeled,
    availableYears,
  } from "$lib/stores";
  import { t } from "$lib/i18n";
  import TextSearch from "$lib/components/TextSearch.svelte";

  let { fields = ["keyword", "search"], labels = true, textLang } = $props();

  const options = $derived({
    region: $availableRegions,
    district: $availableDistricts,
    keyword: $availableKeywordsLabeled,
    year: $availableYears,
  });

  const set = (field, value) => filters.update((f) => ({ ...f, [field]: value }));

  $effect(() => {
    for (const field of fields) {
      const value = $filters[field];
      if (field === "search" || !value) continue;
      if (!options[field].some((o) => (o?.value ?? o) === value)) set(field, "");
    }
  });
</script>

<div class="query">
  {#each fields as field}
    <label>
      {#if labels}<span>{$t(`filters.${field}`)}</span>{/if}
      {#if field === "search"}
        <TextSearch {textLang} />
      {:else}
        <select
          class:chosen={$filters[field]}
          value={$filters[field]}
          onchange={(e) => set(field, e.currentTarget.value)}
          aria-label={$t(`filters.${field}`)}
        >
          <option value="">{$t("filters.all")}</option>
          {#each options[field] as o}
            <option value={o?.value ?? o}>{o?.label ?? o}</option>
          {/each}
        </select>
      {/if}
    </label>
  {/each}
</div>

<style>
  .query {
    display: flex;
    flex-direction: var(--query-direction, row);
    flex-wrap: wrap;
    gap: 10px;
    font-size: 13px;
  }
  label {
    display: flex;
    flex-direction: column;
    gap: 5px;
  }
  .query,
  .query :global(*) {
    font-family: Arial, Helvetica, sans-serif;
  }
  select,
  .query :global(input) {
    box-sizing: border-box;
    width: 200px;
    height: 36px;
    margin: 0;
    padding: 5px 10px;
    font-size: 16px;
    line-height: 1.25;
    background-color: var(--query-bg, #fff);
    color: var(--query-fg, #000);
    border: 1px solid var(--query-fg, #000);
    border-radius: 0;
    outline: none;
    appearance: none;
  }
  select.chosen {
    background-color: var(--query-fg, #000);
    color: var(--query-bg, #fff);
  }
  /* own arrow, drawn in the text colour */
  select {
    padding-right: 30px;
    background-image:
      linear-gradient(45deg, transparent 50%, currentColor 50%),
      linear-gradient(135deg, currentColor 50%, transparent 50%);
    background-size: 5px 5px;
    background-position:
      right 15px center,
      right 10px center;
    background-repeat: no-repeat;
    cursor: pointer;
  }
</style>
