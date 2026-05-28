<script>
  import { filters } from "$lib/stores";
  import { lang, t } from "$lib/i18n";
  import { translateEN_DE } from "$lib/utils/translate";

  let displayValue = $filters.text ?? "";
  let debounceTimer;

  function onInput(e) {
    displayValue = e.target.value;
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => applyFilter(displayValue), 400);
  }

  async function applyFilter(raw) {
    if ($lang !== "en") {
      filters.update((f) => ({ ...f, text: raw }));
      return;
    }
    const translated = raw.trim() ? await translateEN_DE(raw) : raw;
    filters.update((f) => ({ ...f, text: translated }));
  }
</script>

<label>
  {$t("filters.search")}
  <input
    type="search"
    placeholder={$t("filters.searchPlaceholder")}
    value={displayValue}
    on:input={onInput}
    aria-label={$t("filters.search")}
  />
</label>

<style>
  label {
    display: flex;
    gap: 0.2rem;
    align-items: center;
    font-family: Arial, sans-serif;
  }
  input[type="search"] {
    max-width: 100%;
    margin: 10px 0;
  }
</style>
