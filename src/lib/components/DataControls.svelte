<script>
  import { filters, availableKeywords, filteredData } from "$lib/stores";

  function setKeywordFilter(val) {
    filters.set({ ...$filters, keyword: val });
  }
  function setTextFilter(val) {
    filters.set({ ...$filters, text: val });
  }
  function setShowOnlyLatest(val) {
    filters.set({ ...$filters, showOnlyLatest: val });
  }
</script>

<div class="controls">
  Showing
  <strong>{$filteredData.length}</strong>
  police-reported incident{$filteredData.length === 1 ? "" : "s"}
  {#if $availableKeywords.length}
    &nbsp;with keyword
    <select
      bind:value={$filters.keyword}
      on:change={(e) => setKeywordFilter(e.target.value)}
    >
      <option value="">any</option>
      {#each $availableKeywords as canon}
        <option value={canon}>{canon}</option>
      {/each}
    </select>
  {/if}
  , containing
  <input
    type="text"
    bind:value={$filters.text}
    on:input={(e) => setTextFilter(e.target.value)}
    placeholder="text…"
    class="inline-input"
  />
  in the description, or
  <label class="inline-checkbox">
    <input
      type="checkbox"
      bind:checked={$filters.showOnlyLatest}
      on:change={(e) => setShowOnlyLatest(e.target.checked)}
    />
    only the latest.
  </label>
</div>

<style>
  .controls {
    position: absolute;
    top: 1rem;
    left: 1rem;
    z-index: 10;
    color: #eee;
    background: #000;
    padding: 0.7rem 1rem;
    border-radius: 10px;
    box-shadow: 0 2px 24px #0005;
    font-size: 1rem;
    line-height: 1.7;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    white-space: none;
  }
  .controls select,
  .controls .inline-input {
    display: inline-block;
    margin: 0 0.25em;
    background: #fff;
    color: #111;
    border: 1px solid #444;
    border-radius: 6px;
    padding: 0.2rem 0.4rem;
    font-size: 1em;
    min-width: 90px;
    vertical-align: middle;
  }

  strong,
  select,
  input {
    padding: 0px 10px;
  }

  .inline-input {
    width: 110px;
  }

  .inline-checkbox {
    display: inline-flex;
    align-items: center;
    font-weight: 400;
    cursor: pointer;
    user-select: none;
  }
  .inline-checkbox input[type="checkbox"] {
    accent-color: #0055ff;
    width: 1.1em;
    height: 1.1em;
    vertical-align: middle;
  }
</style>
