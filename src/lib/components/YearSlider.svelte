<script>
  import { filters, yearsExtent } from "$lib/stores";

  $: extent = $yearsExtent;
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
    filters.update((f) => ({
      ...f,
      yearMin: extent.min,
      yearMax: extent.max,
    }));
  }
</script>

<label>
  Year range:
  <input
    type="number"
    min={extent.min}
    max={extent.max}
    value={yearMin}
    on:input={updateMin}
  />
  –
  <input
    type="number"
    min={extent.min}
    max={extent.max}
    value={yearMax}
    on:input={updateMax}
  />
  <button type="button" on:click={reset}>↺</button>
</label>

<style>
  label {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-family: Arial, sans-serif;
    margin: 0.5rem 0;
  }
  input[type="number"] {
    width: 5em;
  }
  button {
    background: none;
    border: 1px solid #ccc;
    border-radius: 4px;
    cursor: pointer;
    padding: 0 0.4em;
  }
</style>
