<script>
  import { t } from "$lib/i18n";

  let {
    categories = $bindable([]),
    counts = {},
    showBerlin = $bindable(true),
    showBrandenburg = $bindable(false),
    reversed = $bindable(false),
    displayMode = $bindable("title"),
    panelOpen = $bindable(true),
    onRebuild = () => {},
  } = $props();

  let expandedCats = $state(/** @type {Set<string>} */ (new Set()));

  function toggleDesc(id) {
    const s = new Set(expandedCats);
    s.has(id) ? s.delete(id) : s.add(id);
    expandedCats = s;
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
      <div class="section-title">{$t("cat.categories")}</div>
      {#each categories as cat}
        {@const color = cat.color ?? "#999"}
        {@const open = expandedCats.has(cat.id)}
        <div class="cat-block">
          <div class="leg-row-wrap">
            <button
              class="leg-row"
              class:off={!cat.on}
              onclick={() => {
                cat.on = !cat.on;
              }}
            >
              <span
                class="leg-chip"
                style:background={cat.on ? color : undefined}>{cat.label}</span
              >
              <span class="leg-n">{counts[cat.id] ?? 0}</span>
            </button>
            {#if cat.desc}
              <button class="desc-toggle" onclick={() => toggleDesc(cat.id)}
                >{open ? "▾" : "▸"}</button
              >
            {/if}
          </div>
          {#if open && cat.desc}
            <div class="cat-desc">{cat.desc}</div>
          {/if}
        </div>
      {/each}

      <div class="section-title" style="margin-top:16px">
        {$t("cat.region")}
      </div>
      <label class="check-row"
        ><input type="checkbox" bind:checked={showBerlin} /> Berlin</label
      >
      <label class="check-row"
        ><input type="checkbox" bind:checked={showBrandenburg} /> Brandenburg</label
      >
      {#if showBerlin || showBrandenburg}
        <div class="filter-note">
          {showBerlin && showBrandenburg
            ? $t("cat.berlinBrandenburg")
            : showBerlin
              ? $t("cat.berlinOnly")
              : $t("cat.brandenburgOnly")}
        </div>
      {/if}

      <div class="section-title" style="margin-top:16px">
        {$t("cat.display")}
      </div>
      <button
        class="ctrl-btn"
        class:active={displayMode === "title"}
        onclick={() => {
          displayMode = "title";
        }}>{$t("cat.displayTitle")}</button
      >
      <button
        class="ctrl-btn"
        class:active={displayMode === "text"}
        onclick={() => {
          displayMode = "text";
        }}>{$t("cat.displaySnippet")}</button
      >

      <div class="section-title" style="margin-top:16px">{$t("cat.order")}</div>
      <button
        class="ctrl-btn"
        onclick={() => {
          reversed = !reversed;
        }}
      >
        {reversed ? $t("cat.orderNewest") : $t("cat.orderOldest")}
      </button>
    </div>
  {/if}
</aside>

<style>
  .panel {
    flex-shrink: 0;
    width: 252px;
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
    font-family: Courier, monospace;
    flex-shrink: 0;
  }
  .toggle:hover {
    color: #555;
  }

  .panel-body {
    padding: 0 12px 16px;
    overflow-y: auto;
    flex: 1;
    font-family: Courier, monospace;
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

  .cat-block {
    margin-bottom: 2px;
  }

  .leg-row-wrap {
    display: flex;
    align-items: center;
    gap: 2px;
  }
  .leg-row-wrap .leg-row {
    flex: 1;
  }

  .leg-row {
    display: flex;
    align-items: center;
    gap: 5px;
    background: none;
    border: none;
    cursor: pointer;
    font-family: Courier, monospace;
    font-size: 11px;
    color: #333;
    padding: 2px 0;
    text-align: left;
    width: 100%;
  }
  .leg-chip {
    flex: 1;
    padding: 1px 4px;
    font-size: 11px;
    color: #000;
    background: #e0e0e0;
    display: inline-block;
  }
  .leg-row.off .leg-chip {
    background: none !important;
    color: #bbb;
    text-decoration: line-through;
  }
  .leg-n {
    color: #aaa;
    font-size: 10px;
    min-width: 22px;
    text-align: right;
  }

  .desc-toggle {
    flex-shrink: 0;
    background: none;
    border: none;
    color: #ccc;
    cursor: pointer;
    font-size: 10px;
    padding: 2px 4px;
    font-family: Courier, monospace;
  }
  .desc-toggle:hover {
    color: #555;
  }

  .cat-desc {
    font-size: 10px;
    color: #999;
    line-height: 1.5;
    padding: 4px 0 4px 14px;
    border-left: 2px solid #e0e0e0;
    margin-bottom: 4px;
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

  .filter-note {
    font-size: 10px;
    color: #999;
    margin-top: 2px;
    font-style: italic;
  }

  .ctrl-btn {
    width: 100%;
    background: none;
    border: 1px solid #ddd;
    font-family: Courier, monospace;
    font-size: 10px;
    color: #999;
    cursor: pointer;
    padding: 4px 6px;
    text-align: left;
    margin-bottom: 4px;
  }
  .ctrl-btn:hover,
  .ctrl-btn.active {
    background: #333;
    color: #fff;
    border-color: #333;
  }
</style>
