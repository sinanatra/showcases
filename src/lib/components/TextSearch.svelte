<script>
  import { filters } from "$lib/stores";
</script>

<label>
  Search text:
  <input
    type="search"
    placeholder="type to filter…"
    value={$filters.text}
    on:input={(e) => filters.update((f) => ({ ...f, text: e.target.value }))}
  />
</label>

<style>
  input[type="search"] {
    padding: 4px 6px;
    width: 18rem;
    max-width: 100%;
  }
</style>
