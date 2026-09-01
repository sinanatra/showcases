<script>
  let {
    categories = $bindable([]),
    onChange = () => {},
  } = $props();

  let copyStatus = $state("");
  let jsonText = $state("");
  let jsonDirty = $state(false);
  let jsonError = $state("");

  $effect(() => {
    const serialized = JSON.stringify(categories, null, 2);
    if (!jsonDirty) jsonText = serialized;
  });

  function applyJson() {
    try {
      const nextCategories = JSON.parse(jsonText);
      if (!Array.isArray(nextCategories)) throw new Error("Expected a JSON array");
      if (nextCategories.some((category) => !category.id || !category.label || !category.type)) {
        throw new Error("Every category needs id, label, and type");
      }
      categories = nextCategories;
      jsonDirty = false;
      jsonError = "";
      onChange();
    } catch (error) {
      jsonError = error instanceof Error ? error.message : "Invalid JSON";
    }
  }

  async function copyJson() {
    await navigator.clipboard.writeText(JSON.stringify(categories, null, 2));
    copyStatus = "Copied";
    setTimeout(() => { copyStatus = ""; }, 1500);
  }
</script>

<div class="section-title" style="margin-top:16px">Category JSON</div>
<textarea
  class="json-editor"
  bind:value={jsonText}
  oninput={() => { jsonDirty = true; jsonError = ""; }}
  spellcheck="false"
></textarea>
<div class="json-actions">
  <button onclick={applyJson}>Apply JSON</button>
  <button onclick={copyJson}>Copy JSON</button>
</div>
{#if jsonError}<div class="json-error">{jsonError}</div>{/if}
{#if copyStatus}<span class="copy-status">{copyStatus}</span>{/if}

<style>
  .section-title {
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: #aaa;
    margin: 6px 0 4px;
  }
  .json-editor {
    box-sizing: border-box;
    width: 100%;
    min-height: 240px;
    border: 1px solid #d4d4d4;
    background: #fff;
    color: #222;
    font: inherit;
    font-size: 10px;
    line-height: 1.35;
    padding: 5px;
    resize: vertical;
  }
  .json-actions {
    display: flex;
    gap: 4px;
    margin-top: 5px;
  }
  .json-actions button {
    flex: 1;
    border: 1px solid #bbb;
    background: #fff;
    color: #333;
    cursor: pointer;
    font: inherit;
    padding: 5px;
  }
  .json-actions button:hover { background: #111; color: #fff; border-color: #111; }
  .copy-status { color: #6b8e23; font-size: 10px; }
  .json-error { color: #b42318; font-size: 10px; margin-top: 4px; }
</style>