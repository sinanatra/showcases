<script>
  import { filters, yearsExtent } from "$lib/stores";
  import { t } from "$lib/i18n";

  $: extent = $yearsExtent || { min: null, max: null };
  $: yearMin = $filters.yearMin ?? extent.min;
  $: yearMax = $filters.yearMax ?? extent.max;

  function updateMin(e) {
    const val = Number(e.target.value) || null;
    filters.update((f) => ({ ...f, yearMin: val }));
  }
  function updateMax(e) {
    const val = Number(e.target.value) || null;
    filters.update((f) => ({ ...f, yearMax: val }));
  }
  function reset() {
    filters.update((f) => ({ ...f, yearMin: extent.min, yearMax: extent.max }));
  }
</script>

<label>
  {$t("filters.yearRange")}
  <input
    type="number"
    min={extent.min}
    max={extent.max}
    value={yearMin}
    on:input={updateMin}
    aria-label={$t("filters.yearStart")}
  />
  –
  <input
    type="number"
    min={extent.min}
    max={extent.max}
    value={yearMax}
    on:input={updateMax}
    aria-label={$t("filters.yearEnd")}
  />
  <button type="button" on:click={reset} aria-label={$t("filters.reset")}
    >↺</button
  >
</label>

<style>
  label {
    display: flex;
    align-items: center;
    gap: 0.2rem;
    font-family: Arial, sans-serif;
  }
  input[type="number"] {
    width: 5em;
  }
  button {
    background: none;
    border: 1px solid white;
    color: white;
    border-radius: 4px;
    cursor: pointer;
    padding: 0 0.4em;
  }
</style>
