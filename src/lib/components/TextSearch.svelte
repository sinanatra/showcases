<script>
  import { filters } from "$lib/stores";
  import { t } from "$lib/i18n";
</script>

<label>
  {$t("filters.search")}
  <input
    type="search"
    placeholder={$t("filters.searchPlaceholder")}
    value={$filters.text}
    on:input={(e) => filters.update((f) => ({ ...f, text: e.target.value }))}
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
