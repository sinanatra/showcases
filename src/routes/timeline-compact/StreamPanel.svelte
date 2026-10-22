<script>
  import { settings } from "../timeline-categorical/settings.svelte.js";
  import { MIN_TEXT_PT, CM, CAP_HEIGHT, X_HEIGHT } from "./config.js";

  let {
    params = $bindable(),
    categories = $bindable([]),
    counts = {},
    shades = {},
    type,
    chart = null,
    paperCm = null,
    fitting = false,
    tooTall = false,
    exportingPdf = false,
    onFit = () => {},
    onFitHeight = () => {},
    onRealSize = () => {},
    onFitSnippets = () => {},
    onExportPdf = () => {},
    onExportSvg = () => {},
  } = $props();

  const mm = (pt) => ((pt / CM) * 10).toFixed(1);
</script>

{#snippet num(label, title, key, min = 0, step = 1)}
  <label class="param-row" {title}>
    <span>{label}</span><input
      type="number"
      {min}
      {step}
      value={params[key]}
      onchange={(e) => (params[key] = +e.currentTarget.value)}
    />
  </label>
{/snippet}
{#snippet choice(key, options)}
  <div class="btn-row">
    {#each options as [value, label]}
      <button
        class="toggle-btn"
        class:active={params[key] === value}
        onclick={() => (params[key] = value)}>{label}</button
      >
    {/each}
  </div>
{/snippet}
{#snippet check(key, label, title = "")}
  <label class="check-row" {title}
    ><input type="checkbox" bind:checked={params[key]} /> {label}</label
  >
{/snippet}

<aside class="panel">
  <div class="section-title">Paper</div>
  <div class="paper" class:over={tooTall}>
    {#if paperCm}{paperCm[0]} × {paperCm[1]} cm{:else}…{/if}
  </div>
  <div class="note">
    {#if fitting}fitting…{:else if chart}text fills {Math.round(chart.fill * 100)}%
      · snippets {settings.SEGMENT_SNIP_MAX} characters{/if}
    {#if tooTall}<br /><span class="over"
        >larger than the paper even with the shortest snippets</span
      >{/if}
  </div>
  <div class="pair">
    {@render num("Width (cm)", "Width of the print: the time axis", "widthCm", 50, 10)}
    {@render num("Height (cm)", "Height of the print", "heightCm", 20, 10)}
  </div>
  <div class="pair">
    {@render num(
      "From (year)",
      "The time axis starts on 1 January of this year; earlier reports are left out",
      "fromYear",
      1990,
    )}
    {@render num(
      "To (year)",
      "The time axis ends on 1 January of this year; later reports are left out",
      "toYear",
      1991,
    )}
  </div>

  <div class="section-title">View</div>
  <div class="btn-row">
    <button class="plain-btn" onclick={onFit} title="Whole chart in view">Fit</button>
    <button class="plain-btn" onclick={onFitHeight} title="Full height in view"
      >Height</button
    >
    <button
      class="plain-btn"
      onclick={onRealSize}
      title="Real size: text as big on screen as on paper">1:1</button
    >
  </div>

  <div class="section-title">Language</div>
  {@render choice("langMode", [
    ["de", "DE"],
    ["en", "EN"],
    ["both", "Both"],
  ])}

  <div class="section-title">Lines</div>
  {@render choice("dateMode", [
    ["aligned", "2 lines"],
    ["inline", "1 line"],
  ])}
  {#if params.dateMode !== "aligned" && params.langMode === "both"}
    <div class="gap"></div>
    {@render choice("bandPerLang", [
      [false, "One band"],
      [true, "Band per language"],
    ])}
  {/if}

  <div class="section-title">Order</div>
  {@render choice("stackMode", [
    ["big", "Biggest at bottom"],
    ["small", "Smallest at bottom"],
    ["centre", "Smallest in centre"],
  ])}
  <div class="gap"></div>
  {@render choice("newestLeft", [
    [false, "Oldest → newest"],
    [true, "Newest → oldest"],
  ])}

  <div class="section-title">Look</div>
  <div class="btn-row">
    <button
      class="toggle-btn"
      class:active={params.dark}
      onclick={() => (params.dark = !params.dark)}
      title="Light text on black">Dark</button
    >
  </div>

  {#each [["Categories", true], ["Commentary", false]] as [title, canonical]}
    <div class="section-title">{title}</div>
    {#each categories.filter((c) => (c.type === "canonical") === canonical) as cat}
      <button class="leg-row" class:off={!cat.on} onclick={() => (cat.on = !cat.on)}>
        <span
          class="leg-chip"
          style:background={cat.on ? (shades[cat.id]?.band ?? cat.color ?? "#999") : undefined}
          >{cat.label}</span
        >
        <span class="leg-count">{counts[cat.id] ?? 0}</span>
      </button>
    {/each}
  {/each}

  <div class="section-title">Region</div>
  {@render check("showBerlin", "Berlin")}
  {@render check("showBrandenburg", "Brandenburg")}

  <div class="section-title">Export</div>
  <div class="btn-row">
    <button
      class="plain-btn"
      onclick={onExportPdf}
      disabled={!chart || exportingPdf}
      title="Vector PDF at print size; takes a few seconds"
      >{exportingPdf ? "Making…" : "PDF"}</button
    >
    <button class="plain-btn" onclick={onExportSvg} disabled={!chart} title="SVG at print size"
      >SVG</button
    >
  </div>

  <details class="advanced">
    <summary>Advanced</summary>
    {@render num(
      "Text (pt)",
      `Printed size of the report text, never below ${MIN_TEXT_PT} pt. Dates and places are set at 14/18 of it, category names at 22/18.`,
      "textPt",
      MIN_TEXT_PT,
    )}
    <div class="note" title="What a ruler measures on paper">
      {(type.fs / CM).toFixed(2)} cm font size · capitals {mm(type.fs * CAP_HEIGHT)} mm
      · lowercase {mm(type.fs * X_HEIGHT)} mm
    </div>
    {@render check(
      "autoFit",
      "Always fit the paper",
      "Whenever something changes the size, the snippet length is found again so the chart fits the paper",
    )}
    {@render num(
      "Min snippet",
      "Fitting never makes snippets shorter than this many characters; the chart grows taller than the paper instead",
      "minSnip",
      5,
      5,
    )}
    {#if !params.autoFit}
      <label class="param-row" title="Longest quoted snippet in characters, per language">
        <span>Snippet length</span><input
          type="number"
          min="20"
          step="10"
          value={settings.SEGMENT_SNIP_MAX}
          onchange={(e) => (settings.SEGMENT_SNIP_MAX = +e.currentTarget.value)}
        />
      </label>
      <button
        class="plain-btn"
        onclick={onFitSnippets}
        disabled={!chart}
        title="Longest snippets with which the chart still fits the paper"
        >Fit snippet length</button
      >
    {/if}
    {@render check(
      "fillGaps",
      "Fill gaps with more text",
      "Each report grows, still centred on its word, into the free room beside it on its line",
    )}
    {@render num("Wave (cm)", "How far the lines swing up and down. 0 = no wave.", "waveCm")}
    {@render num("Wave length (cm)", "The length of one swing of the wave", "waveLengthCm", 10, 10)}
    {@render num("Time slack (cm)", "How far a report may move from its date to fit", "slackCm", 0, 5)}
    {@render num("Smoothing (cm)", "How far the amount of text is smoothed along time", "smoothCm", 2, 5)}
    {@render num(
      "Max slope",
      "Steepest an edge between two streams may be (height / width)",
      "maxSlope",
      0.05,
      0.05,
    )}
    {@render num("Room (%)", "Room in each stream, in % of its text", "roomPct", 100, 5)}
    {@render num("Gap between streams", "White between two streams, in lines", "gapLines", 0, 0.2)}
    {@render check("showLabels", "Category names", "Category names, set bigger than the text")}
    {#if params.showLabels}
      {@render num(
        "Name size (pt)",
        "Size of the category names. 0 = automatic, 22/18 of the text.",
        "namePt",
        0,
        10,
      )}
      <div class="note">
        {Math.round(type.labelFs)} pt · capitals {((type.labelFs * CAP_HEIGHT) / CM).toFixed(1)} cm
      </div>
      {@render num(
        "Name every (cm)",
        "A stream repeats its name every this many cm",
        "labelEveryCm",
        20,
        10,
      )}
    {/if}
    {#if chart?.overflow}<div class="note over">
        {chart.overflow} reports did not fit their stream: more room
      </div>{/if}
  </details>
</aside>

<style>
  .panel {
    flex-shrink: 0;
    box-sizing: border-box;
    width: 220px;
    height: 100vh;
    padding: 12px;
    overflow-y: auto;
    background: #f4f3ef;
    border-left: 1px solid #ddd;
    font-family: var(--font-mono);
    font-size: 11px;
    color: #555;
  }
  .section-title,
  .advanced summary {
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: #aaa;
  }
  .section-title {
    margin: 16px 0 4px;
  }
  .section-title:first-child {
    margin-top: 0;
  }
  .paper {
    font-size: 16px;
    color: #000;
  }
  .over {
    color: #d00000 !important;
  }
  .note {
    font-size: 10px;
    color: #888;
    padding: 3px 0;
  }
  .gap {
    height: 4px;
  }

  .pair {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px;
  }
  .pair .param-row {
    flex-direction: column;
    align-items: stretch;
  }
  .pair .param-row input {
    width: 100%;
    box-sizing: border-box;
  }
  .advanced {
    margin-top: 16px;
  }
  .advanced summary {
    cursor: pointer;
    margin-bottom: 6px;
  }
  .btn-row {
    display: flex;
    gap: 4px;
  }
  .plain-btn,
  .toggle-btn {
    flex: 1;
    width: 100%;
    box-sizing: border-box;
    border: 1px solid #bbb;
    background: #fff;
    color: #333;
    cursor: pointer;
    font: inherit;
    padding: 5px;
    text-align: center;
  }
  .plain-btn:hover,
  .toggle-btn:hover,
  .toggle-btn.active {
    background: #111;
    color: #fff;
    border-color: #111;
  }
  .plain-btn:disabled {
    opacity: 0.4;
    cursor: default;
  }

  .param-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 6px;
    padding: 1px 0;
    font-size: 10px;
  }
  .param-row input {
    width: 3.6rem;
    border: 1px solid #d4d4d4;
    background: #fff;
    font: inherit;
    padding: 2px 4px;
  }
  .check-row {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 3px 0;
    cursor: pointer;
  }
  .check-row input {
    accent-color: #555;
  }

  .leg-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 6px;
    width: 100%;
    background: none;
    border: none;
    cursor: pointer;
    font: inherit;
    color: #000;
    padding: 2px 0;
    text-align: left;
  }
  .leg-count {
    font-size: 10px;
    color: #aaa;
    flex-shrink: 0;
  }
  .leg-chip {
    padding: 1px 4px;
    background: #e0e0e0;
  }
  .leg-row.off .leg-chip {
    background: none !important;
    color: #bbb;
    text-decoration: line-through;
  }
</style>
