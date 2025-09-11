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
    max-width: 100%;
    margin: 10px 0;
  }
</style>
