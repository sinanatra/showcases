<script>
  import { t } from "$lib/i18n";

  let {
    categories = $bindable([]),
    counts = {},
    showBilanz = $bindable(false),
    showBerlin = $bindable(true),
    showBrandenburg = $bindable(false),
    reversed = $bindable(false),
    displayMode = $bindable("title"),
    textAlign = $bindable("start"),
    panelOpen = $bindable(true),
    onRebuild = () => {},
  } = $props();

  let expandedCats = $state(/** @type {Set<string>} */ (new Set()));
  let addOpen = $state(false);
  let newLabel = $state("");
  let newColor = $state("#dddddd");
  let newType = $state("text");
  let newQuery = $state("");
  let newDesc = $state("");
  let copyFeedback = $state("");
  let editingId = $state(/** @type {string|null} */ (null));
  let editDraft = $state(/** @type {{label:string,color:string,type:string,query:string,desc:string}|null} */ (null));

  function toggleDesc(/** @type {string} */ id) {
    const s = new Set(expandedCats);
    s.has(id) ? s.delete(id) : s.add(id);
    expandedCats = s;
  }

  function slugify(/** @type {string} */ s) {
    return s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 20);
  }

  function addCategory() {
    if (!newLabel.trim()) return;
    const id = slugify(newLabel) || `cat_${Date.now()}`;
    const cat = { id, label: newLabel.trim(), color: newColor, type: newType, query: newQuery.trim(), on: true, desc: newDesc.trim() };
    categories = [...categories, cat];
    newLabel = ""; newColor = "#dddddd"; newType = "text"; newQuery = ""; newDesc = "";
    onRebuild();
  }

  function startEdit(/** @type {any} */ cat) {
    editingId = cat.id;
    editDraft = { label: cat.label, color: cat.color, type: cat.type, query: cat.query ?? "", desc: cat.desc ?? "" };
  }

  function saveEdit() {
    if (!editDraft) return;
    categories = categories.map((c) => c.id === editingId ? { ...c, ...editDraft } : c);
    editingId = null; editDraft = null;
    onRebuild();
  }

  function cancelEdit() {
    editingId = null; editDraft = null;
  }

  function deleteCategory(/** @type {string} */ id) {
    categories = categories.filter((c) => c.id !== id);
    onRebuild();
  }

  async function copyCatJSON(/** @type {any} */ cat) {
    const safeStr = (/** @type {string|undefined} */ s) => (s ?? "").replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    const lines = [
      `{`,
      `  id: "${safeStr(cat.id)}",`,
      `  label: "${safeStr(cat.label)}",`,
      `  color: "${safeStr(cat.color)}",`,
      `  type: "${safeStr(cat.type)}",`,
      `  query: "${safeStr(cat.query)}",`,
      `  on: true,`,
    ];
    if (cat.desc) lines.push(`  desc: "${safeStr(cat.desc)}",`);
    lines.push(`},`);
    await navigator.clipboard.writeText(lines.join("\n"));
    copyFeedback = cat.id;
    setTimeout(() => { copyFeedback = ""; }, 1400);
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
            <button
              class="copy-btn"
              class:copied={copyFeedback === cat.id}
              title="Copy JSON"
              onclick={() => copyCatJSON(cat)}
            >{copyFeedback === cat.id ? "✓" : "⎘"}</button>
            <button class="copy-btn" title="Edit" onclick={() => startEdit(cat)}>✎</button>
            <button class="copy-btn del-btn" title="Delete" onclick={() => deleteCategory(cat.id)}>×</button>
          </div>
          {#if open && cat.desc}
            <div class="cat-desc">{cat.desc}</div>
          {/if}
          {#if editingId === cat.id && editDraft}
            <div class="add-form edit-form">
              <label class="add-label">Label
                <input class="add-input" bind:value={editDraft.label} />
              </label>
              <label class="add-label">Color
                <div class="color-row">
                  <input type="color" bind:value={editDraft.color} class="color-swatch" />
                  <input class="add-input" bind:value={editDraft.color} style="flex:1" />
                </div>
              </label>
              <label class="add-label">Type
                <select class="add-input" bind:value={editDraft.type}>
                  <option value="text">text</option>
                  <option value="canonical">canonical</option>
                </select>
              </label>
              <label class="add-label">Query
                <input class="add-input" bind:value={editDraft.query} />
              </label>
              <label class="add-label">Description
                <textarea class="add-input add-textarea" bind:value={editDraft.desc}></textarea>
              </label>
              <div class="edit-actions">
                <button class="ctrl-btn add-submit" onclick={saveEdit}>save</button>
                <button class="ctrl-btn" onclick={cancelEdit}>cancel</button>
              </div>
            </div>
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

      <div class="section-title" style="margin-top:16px">{$t("cat.filters")}</div>
      <label class="check-row">
        <input type="checkbox" bind:checked={showBilanz} /> Bilanz reports
      </label>

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

      <div class="section-title" style="margin-top:16px">Align</div>
      <div class="align-row">
        {#each ["start", "middle", "end"] as a}
          <button
            class="ctrl-btn"
            class:active={textAlign === a}
            onclick={() => { textAlign = a; }}
          >{a === "start" ? "left" : a === "middle" ? "center" : "right"}</button>
        {/each}
      </div>

      <div class="section-title" style="margin-top:16px">{$t("cat.order")}</div>
      <button
        class="ctrl-btn"
        onclick={() => {
          reversed = !reversed;
        }}
      >
        {reversed ? $t("cat.orderNewest") : $t("cat.orderOldest")}
      </button>

      <div class="section-title" style="margin-top:16px">Add category</div>
      <button class="ctrl-btn" onclick={() => { addOpen = !addOpen; }}>
        {addOpen ? "▾ cancel" : "▸ new…"}
      </button>
      {#if addOpen}
        <div class="add-form">
          <label class="add-label">Label
            <input class="add-input" bind:value={newLabel} placeholder="e.g. Islamophobia" />
          </label>
          <label class="add-label">Color
            <div class="color-row">
              <input type="color" bind:value={newColor} class="color-swatch" />
              <input class="add-input" bind:value={newColor} placeholder="#dddddd" style="flex:1" />
            </div>
          </label>
          <label class="add-label">Type
            <select class="add-input" bind:value={newType}>
              <option value="text">text</option>
              <option value="canonical">canonical</option>
            </select>
          </label>
          <label class="add-label">Query (comma-separated)
            <input class="add-input" bind:value={newQuery} placeholder="term1,term2,…" />
          </label>
          <label class="add-label">Description
            <textarea class="add-input add-textarea" bind:value={newDesc} placeholder="Optional note…"></textarea>
          </label>
          {#if newLabel.trim()}
            <div class="id-preview">id: {slugify(newLabel) || "…"}</div>
          {/if}
          <button class="ctrl-btn add-submit" onclick={addCategory}>+ Add to timeline</button>
        </div>
      {/if}
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
    font-family: var(--font-mono);
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
    font-family: var(--font-mono);
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

  .align-row {
    display: flex;
    gap: 2px;
  }
  .align-row .ctrl-btn {
    flex: 1;
    padding: 4px 2px;
    text-align: center;
    margin-bottom: 0;
  }

  .ctrl-btn {
    width: 100%;
    background: none;
    border: 1px solid #ddd;
    font-family: var(--font-mono);
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

  .copy-btn {
    flex-shrink: 0;
    background: none;
    border: none;
    color: #ccc;
    cursor: pointer;
    font-size: 11px;
    padding: 2px 4px;
    font-family: var(--font-mono);
    line-height: 1;
  }
  .copy-btn:hover { color: #555; }
  .copy-btn.copied { color: #4a4; }
  .del-btn:hover { color: #c44; }

  .edit-form {
    margin-top: 4px;
    padding: 6px;
    background: #f2f1ed;
    border-left: 2px solid #ddd;
  }
  .edit-actions {
    display: flex;
    gap: 4px;
  }
  .edit-actions .ctrl-btn {
    flex: 1;
    margin-bottom: 0;
  }

  .add-form {
    margin-top: 4px;
    display: flex;
    flex-direction: column;
    gap: 5px;
  }
  .add-label {
    display: flex;
    flex-direction: column;
    gap: 2px;
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #aaa;
  }
  .add-input {
    font-family: var(--font-mono);
    font-size: 11px;
    color: #333;
    background: #f9f9f7;
    border: 1px solid #ddd;
    padding: 3px 5px;
    width: 100%;
    box-sizing: border-box;
  }
  .add-input:focus { outline: 1px solid #aaa; }
  .add-textarea {
    resize: vertical;
    min-height: 42px;
  }
  .color-row {
    display: flex;
    align-items: center;
    gap: 5px;
  }
  .color-swatch {
    width: 28px;
    height: 22px;
    border: 1px solid #ddd;
    padding: 0;
    cursor: pointer;
    flex-shrink: 0;
  }
  .id-preview {
    font-size: 9px;
    color: #bbb;
    font-style: italic;
    padding-left: 2px;
  }
  .add-submit {
    margin-top: 2px;
    color: #555;
    border-color: #aaa;
  }
  .add-submit:hover {
    background: #222;
    color: #fff;
    border-color: #222;
  }
</style>
