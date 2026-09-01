<script>
  import CategoryJsonEditor from "./CategoryJsonEditor.svelte";

  let {
    categories = $bindable([]),
    showBerlin = $bindable(true),
    showBrandenburg = $bindable(false),
    panelOpen = $bindable(true),
    langMode = $bindable("both"),
    counts = {},
    onRebuild = () => {},
  } = $props();

  function notifyChange() {
    onRebuild();
  }
</script>

<aside class="panel" class:closed={!panelOpen}>
  <button
    class="toggle"
    onclick={() => {
      panelOpen = !panelOpen;
      onRebuild();
    }}
  >
    {panelOpen ? "✕" : "☰"}
  </button>

  {#if panelOpen}
    <div class="panel-body">
      <div class="section-title">Categories</div>
      {#each categories as cat}
        <button
          class="leg-row"
          class:off={!cat.on}
          onclick={() => {
            cat.on = !cat.on;
            notifyChange();
          }}
        >
          <span class="leg-chip" style:background={cat.on ? (cat.color ?? "#999") : undefined}>{cat.label}</span>
          <span class="leg-count">{counts[cat.id] ?? 0}</span>
        </button>
      {/each}

      <CategoryJsonEditor bind:categories onChange={notifyChange} />

      <div class="section-title" style="margin-top:16px">Region</div>
      <label class="check-row"
        ><input type="checkbox" bind:checked={showBerlin} /> Berlin</label
      >
      <label class="check-row"
        ><input type="checkbox" bind:checked={showBrandenburg} /> Brandenburg</label
      >

      <div class="section-title" style="margin-top:16px">Language</div>
      <div class="lang-row">
        {#each [["de", "DE"], ["en", "EN"], ["both", "Both"]] as [value, label]}
          <button
            class="lang-btn"
            class:active={langMode === value}
            onclick={() => { langMode = value; }}
          >{label}</button>
        {/each}
      </div>
    </div>
  {/if}
</aside>

<style>
  .panel {
    flex-shrink: 0;
    width: 200px;
    height: 100vh;
    background: rgba(244, 243, 239, 0.97);
    border-left: 1px solid #ddd;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    transition: width 0.15s;
  }
  .panel.closed {
    width: 36px;
  }

  .toggle {
    align-self: flex-end;
    background: none;
    border: none;
    color: #aaa;
    font-size: 14px;
    cursor: pointer;
    padding: 10px 10px 6px;
    font-family: var(--font-mono);
    flex-shrink: 0;
  }
  .toggle:hover {
    color: #555;
  }

  .panel-body {
    padding: 0 12px 16px;
    overflow-y: auto;
    flex: 1;
    font-family: var(--font-mono);
    font-size: 11px;
    color: #555;
  }

  .section-title {
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: #aaa;
    margin: 6px 0 4px;
  }

  .leg-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 6px;
    background: none;
    border: none;
    cursor: pointer;
    font-family: var(--font-mono);
    font-size: 11px;
    color: #000;
    padding: 2px 0;
    text-align: left;
    width: 100%;
  }
  .leg-count {
    font-size: 10px;
    color: #aaa;
    flex-shrink: 0;
  }
  .leg-chip {
    display: inline-block;
    padding: 1px 4px;
    font-size: 11px;
    color: #000;
    background: #e0e0e0;
  }
  .leg-row.off .leg-chip {
    background: none !important;
    color: #bbb;
    text-decoration: line-through;
  }

  .check-row {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    color: #555;
    padding: 3px 0;
    cursor: pointer;
  }
  .check-row input {
    accent-color: #555;
    cursor: pointer;
  }

  .lang-row {
    display: flex;
    gap: 2px;
  }
  .lang-btn {
    flex: 1;
    background: none;
    border: 1px solid #ddd;
    font-family: var(--font-mono);
    font-size: 10px;
    color: #999;
    cursor: pointer;
    padding: 4px 2px;
    text-align: center;
  }
  .lang-btn:hover,
  .lang-btn.active {
    background: #000;
    color: #fff;
    border-color: #000;
  }
</style>
