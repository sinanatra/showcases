<script>
  import { filters, datesExtent } from "$lib/stores";
  import { t } from "$lib/i18n";

  const formatDateInput = (value) => {
    if (!value) return "";
    const date = value instanceof Date ? value : new Date(value);
    if (isNaN(+date)) return "";
    return date.toISOString().slice(0, 10);
  };

  $: extent = $datesExtent || { min: null, max: null };
  $: defaultMin = formatDateInput(extent.min);
  $: defaultMax = formatDateInput(extent.max);
  $: minAttr = defaultMin || undefined;
  $: maxAttr = defaultMax || undefined;
  $: dateMin = $filters.dateMin ?? defaultMin;
  $: dateMax = $filters.dateMax ?? defaultMax;

  function updateMin(e) {
    const val = e.target.value || null;
    filters.update((f) => ({ ...f, dateMin: val }));
  }

  function updateMax(e) {
    const val = e.target.value || null;
    filters.update((f) => ({ ...f, dateMax: val }));
  }

  function reset() {
    filters.update((f) => ({ ...f, dateMin: null, dateMax: null }));
  }
</script>

<label>
  {$t("filters.dateRange")}
  <input
    type="date"
    min={minAttr}
    max={maxAttr}
    value={dateMin}
    on:input={updateMin}
    aria-label={$t("filters.dateStart")}
  />
  –
  <input
    type="date"
    min={minAttr}
    max={maxAttr}
    value={dateMax}
    on:input={updateMax}
    aria-label={$t("filters.dateEnd")}
  />
  <button type="button" on:click={reset} aria-label={$t("filters.reset")}
    >↺</button
  >
</label>

<style>
  label {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    font-family: Arial, sans-serif;
  }

  input[type="date"] {
    width: 11em;
    padding: 0.1rem 0.2rem;
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
