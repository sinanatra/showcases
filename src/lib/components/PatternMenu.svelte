<script>
  export let growthMode;
  export let setGrowthMode;
  export let keywordFilter;
  export let setKeywordFilter;
  export let textFilter;
  export let setTextFilter;
  export let canonicalKeywords;
  export let count;
  export let showOnlyLatest = false;
  export let setShowOnlyLatest = () => {};
</script>

<div class="inline-menu">
  This visualization shows the latest <b>{count}</b> police-reported incident{count ===
  1
    ? ""
    : "s"}. Filter by keyword
  <select
    bind:value={keywordFilter}
    on:change={(e) => setKeywordFilter(e.target.value)}
    aria-label="Keyword filter"
  >
    <option value="">(all topics)</option>
    {#each canonicalKeywords as kw}
      <option value={kw}>{kw}</option>
    {/each}
  </select>
  , search for a word or phrase
  <input
    type="text"
    bind:value={textFilter}
    on:input={(e) => setTextFilter(e.target.value)}
    placeholder="type to search…"
    style="width: 8.5em"
    aria-label="Text search"
  />
  or
  <label style="display: inline; font-weight: 500;">
    <input
      type="checkbox"
      bind:checked={showOnlyLatest}
      on:change={(e) => setShowOnlyLatest(e.target.checked)}
      aria-label="Show only last incident"
    />
    focus on the very latest case
  </label>
  .
</div>
<!-- <div>
  <span style="margin-left: 1.2em;">
    Growth pattern:
    <select
      bind:value={growthMode}
      on:change={(e) => setGrowthMode(e.target.value)}
      aria-label="Visualization pattern"
    >
      <option value="fungal">Fungal</option>
      <option value="leaf">Leaf</option>
      <option value="root">Root</option>
      <option value="chaos">Chaos</option>
      <option value="covid">COVID</option>
    </select>
  </span>
</div> -->

<style>
  .inline-menu {
    position: absolute;
    top: 1em;
    left: 1em;
    z-index: 10;
    color: #eee;
    font-size: 1.09em;
    background: #111;
    padding: 0.82em 1.45em;
    border-radius: 11px;
    margin: 0.8em auto 1em auto;
    width: fit-content;
    font-family: inherit;
    box-shadow: 0 2px 24px #0005;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.52ch;
    user-select: none;
  }
  select,
  input[type="text"] {
    margin: 0 0.23em;
    border-radius: 5px;
    border: 1px solid #444;
    font-size: inherit;
    padding: 0.13em 0.57em;
    background: #fff;
    color: #111;
  }
  input[type="checkbox"] {
    accent-color: #222;
    margin-right: 0.23em;
    transform: scale(1.13);
  }
</style>
