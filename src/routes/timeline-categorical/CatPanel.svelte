<script>
  import { t } from "$lib/i18n";

  let {
    categories      = $bindable([]),
    counts          = {},
    catColors       = [],
    showBerlin      = $bindable(true),
    showBrandenburg = $bindable(false),
    reversed        = $bindable(false),
    displayMode     = $bindable("title"),
    panelOpen       = $bindable(true),
    onRebuild       = () => {},
  } = $props();

  let expandedCats = $state(/** @type {Set<string>} */ (new Set()));
  let editingId    = $state(/** @type {string|null} */ (null));
  let editLabel    = $state("");
  let editQuery    = $state("");
  let editType     = $state("text");
  let editDesc     = $state("");
  let newLabel     = $state("");
  let newQuery     = $state("");
  let newDesc      = $state("");
  let newType      = $state("text");

  function toggleDesc(id) {
    const s = new Set(expandedCats);
    s.has(id) ? s.delete(id) : s.add(id);
    expandedCats = s;
  }

  function startEdit(cat) {
    editingId = cat.id;
    editLabel = cat.label;
    editQuery = cat.query;
    editType  = cat.type;
    editDesc  = cat.desc ?? "";
  }

  function saveEdit() {
    categories = categories.map(c =>
      c.id === editingId
        ? { ...c, label: editLabel.trim(), query: editQuery.trim(), type: editType, desc: editDesc.trim() }
        : c
    );
    editingId = null;
    onRebuild();
  }

  function addCategory() {
    if (!newLabel.trim() || !newQuery.trim()) return;
    categories = [...categories, {
      id: crypto.randomUUID(),
      label: newLabel.trim(), type: newType,
      query: newQuery.trim(), on: true,
      desc: newDesc.trim(),
    }];
    newLabel = ""; newQuery = ""; newDesc = "";
  }

  function removeCategory(id) { categories = categories.filter(c => c.id !== id); }
</script>

<aside class="panel" class:closed={!panelOpen}>
  <button class="toggle" onclick={() => { panelOpen = !panelOpen; onRebuild(); }}>
    {panelOpen ? "✕" : "☰"}
  </button>

  {#if panelOpen}
    <div class="panel-body">

      <div class="section-title">{$t("cat.categories")}</div>
      {#each categories as cat}
        {@const color = catColors[categories.indexOf(cat) % catColors.length]}
        {@const open  = expandedCats.has(cat.id)}
        <div class="cat-block">
          {#if editingId === cat.id}
            <div class="edit-form">
              <input class="inp" bind:value={editLabel} placeholder={$t("cat.name")} />
              <input class="inp" bind:value={editQuery} placeholder={$t("cat.queryHint")} />
              <select class="sel" bind:value={editType}>
                <option value="text">{$t("cat.freeText")}</option>
                <option value="canonical">{$t("cat.canonicalKeyword")}</option>
              </select>
              <textarea class="inp desc-inp" bind:value={editDesc} rows="3" placeholder={$t("cat.descriptionOptional")}></textarea>
              <div class="edit-btns">
                <button class="save-btn" onclick={saveEdit}>{$t("cat.save")}</button>
                <button class="cancel-btn" onclick={() => { editingId = null; }}>{$t("cat.cancel")}</button>
              </div>
            </div>
          {:else}
            <div class="leg-row-wrap">
              <button class="leg-row" class:off={!cat.on} onclick={() => { cat.on = !cat.on; }}>
                <span class="leg-dot" style:color={cat.on ? color : undefined}>{cat.on ? "●" : "○"}</span>
                <span class="leg-name" style:color={cat.on ? color : undefined}>{cat.label}</span>
                <span class="leg-n">{counts[cat.id] ?? 0}</span>
              </button>
              <button class="edit-btn" onclick={() => startEdit(cat)} title={$t("cat.save")}>✎</button>
              <button class="rm" onclick={() => removeCategory(cat.id)} title="Remove">✕</button>
              {#if cat.desc}
                <button class="desc-toggle" onclick={() => toggleDesc(cat.id)}>{open ? "▾" : "▸"}</button>
              {/if}
            </div>
            {#if open && cat.desc}
              <div class="cat-desc">{cat.desc}</div>
            {/if}
          {/if}
        </div>
      {/each}

      <div class="section-title" style="margin-top:16px">{$t("cat.region")}</div>
      <label class="check-row"><input type="checkbox" bind:checked={showBerlin} /> Berlin</label>
      <label class="check-row"><input type="checkbox" bind:checked={showBrandenburg} /> Brandenburg</label>
      {#if showBerlin || showBrandenburg}
        <div class="filter-note">
          {showBerlin && showBrandenburg ? $t("cat.berlinBrandenburg") : showBerlin ? $t("cat.berlinOnly") : $t("cat.brandenburgOnly")}
        </div>
      {/if}

      <div class="section-title" style="margin-top:16px">{$t("cat.display")}</div>
      <button class="ctrl-btn" class:active={displayMode === "title"} onclick={() => { displayMode = "title"; }}>{$t("cat.displayTitle")}</button>
      <button class="ctrl-btn" class:active={displayMode === "text"}  onclick={() => { displayMode = "text";  }}>{$t("cat.displaySnippet")}</button>

      <div class="section-title" style="margin-top:16px">{$t("cat.order")}</div>
      <button class="ctrl-btn" onclick={() => { reversed = !reversed; }}>
        {reversed ? $t("cat.orderNewest") : $t("cat.orderOldest")}
      </button>

      <div class="section-title" style="margin-top:16px">{$t("cat.addCategory")}</div>
      <input class="inp" placeholder={$t("cat.name")} bind:value={newLabel} />
      <input class="inp" placeholder={$t("cat.queryPlaceholder")} bind:value={newQuery} />
      <select class="sel" bind:value={newType}>
        <option value="text">{$t("cat.freeText")}</option>
        <option value="canonical">{$t("cat.canonicalKeyword")}</option>
      </select>
      <textarea class="inp desc-inp" placeholder={$t("cat.descriptionOptional")} bind:value={newDesc} rows="3"></textarea>
      <button class="add-btn" onclick={addCategory}>{$t("cat.add")}</button>

    </div>
  {/if}
</aside>

<style>
  .panel {
    flex-shrink: 0; width: 252px; height: 100vh;
    background: rgba(244,243,239,0.97); border-left: 1px solid #ccc;
    display: flex; flex-direction: column;
    overflow: hidden; transition: width 0.15s;
  }
  .panel.closed { width: 36px; }

  .toggle {
    align-self: flex-end; background: none; border: none;
    color: #aaa; font-size: 14px; cursor: pointer;
    padding: 10px 10px 6px; font-family: Courier, monospace; flex-shrink: 0;
  }
  .toggle:hover { color: #111; }

  .panel-body {
    padding: 0 12px 16px; overflow-y: auto; flex: 1;
    font-family: Courier, monospace; font-size: 11px; color: #555;
  }

  .section-title {
    font-size: 9px; text-transform: uppercase;
    letter-spacing: 0.1em; color: #aaa; margin: 6px 0 4px;
  }

  .cat-block { margin-bottom: 2px; }

  .leg-row-wrap { display: flex; align-items: center; gap: 2px; }
  .leg-row-wrap .leg-row { flex: 1; }

  .leg-row {
    display: flex; align-items: center; gap: 5px;
    background: none; border: none; cursor: pointer;
    font-family: Courier, monospace; font-size: 11px;
    color: #333; padding: 2px 0; text-align: left; width: 100%;
  }
  .leg-row.off .leg-name { color: #ccc !important; text-decoration: line-through; }
  .leg-row.off .leg-dot  { color: #ccc !important; }
  .leg-dot  { font-size: 11px; flex-shrink: 0; }
  .leg-name { flex: 1; }
  .leg-n    { color: #bbb; font-size: 10px; min-width: 22px; text-align: right; }

  .edit-btn {
    flex-shrink: 0; background: none; border: none; color: #ccc;
    cursor: pointer; font-size: 11px; padding: 2px 3px;
    font-family: Courier, monospace; line-height: 1;
  }
  .edit-btn:hover { color: #555; }

  .desc-toggle {
    flex-shrink: 0; background: none; border: none;
    color: #bbb; cursor: pointer; font-size: 10px;
    padding: 2px 4px; font-family: Courier, monospace;
  }
  .desc-toggle:hover { color: #555; }

  .cat-desc {
    font-size: 10px; color: #888; line-height: 1.5;
    padding: 4px 0 4px 14px; border-left: 2px solid #e0e0e0;
    margin-bottom: 4px;
  }

  .edit-form { display: flex; flex-direction: column; gap: 3px; padding: 4px 0 6px; }
  .edit-btns { display: flex; gap: 4px; margin-top: 2px; }

  .save-btn {
    flex: 1; background: #111; color: #f4f3ef; border: none;
    font-family: Courier, monospace; font-size: 10px; cursor: pointer; padding: 4px 0;
  }
  .save-btn:hover { background: #000; }

  .cancel-btn {
    background: none; border: 1px solid #ccc; color: #888;
    font-family: Courier, monospace; font-size: 10px; cursor: pointer; padding: 4px 8px;
  }
  .cancel-btn:hover { border-color: #888; color: #333; }

  .check-row {
    display: flex; align-items: center; gap: 6px;
    font-size: 11px; color: #555; padding: 3px 0; cursor: pointer;
  }
  .check-row input { accent-color: #111; cursor: pointer; }

  .filter-note { font-size: 10px; color: #888; margin-top: 2px; font-style: italic; }

  .ctrl-btn {
    width: 100%; background: none; border: 1px solid #ccc;
    font-family: Courier, monospace; font-size: 10px;
    color: #888; cursor: pointer; padding: 4px 6px; text-align: left; margin-bottom: 4px;
  }
  .ctrl-btn:hover, .ctrl-btn.active { background: #111; color: #f4f3ef; border-color: #111; }

  .inp {
    width: 100%; box-sizing: border-box;
    background: #ebe9e3; border: 1px solid #d8d5ce;
    font-family: Courier, monospace; font-size: 11px;
    padding: 4px 6px; color: #333; margin-bottom: 4px; display: block;
  }
  .sel {
    width: 100%; box-sizing: border-box;
    background: #ebe9e3; border: 1px solid #d8d5ce;
    font-family: Courier, monospace; font-size: 11px;
    padding: 4px; color: #333; margin-bottom: 4px; display: block;
  }
  .add-btn {
    width: 100%; background: #111; color: #f4f3ef;
    border: none; font-family: Courier, monospace; font-size: 11px;
    cursor: pointer; padding: 5px 0; margin-top: 2px;
  }
  .add-btn:hover { background: #000; }
  .desc-inp { resize: vertical; }

  .rm { background: none; border: none; color: #ccc; cursor: pointer; font-size: 10px; padding: 2px 3px; flex-shrink: 0; font-family: Courier, monospace; }
  .rm:hover { color: #c00; }
</style>
