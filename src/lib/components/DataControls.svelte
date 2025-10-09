<script>
  import { onMount } from "svelte";
  import {
    filters,
    articles,
    availableKeywordsLabeled,
    availableGendersLabeled,
    availableTimeClustersLabeled,
    recent,
    filteredData,
  } from "$lib/stores";
  import Record from "$lib/components/Record.svelte";
  import { t, tn, lang, setLang, availableLangs } from "$lib/i18n";

  let lastActivity = Date.now();
  let cycling = false;
  let cycles = 0;
  let hasCycledSinceIdle = false; 

  const idle_delay = 10000;
  const check_ms = 5000;
  const max_cycles = 2;

  function markActivity() {
    lastActivity = Date.now();
    cycling = false;
    cycles = 0;
    hasCycledSinceIdle = false; 
  }

  function setKeywordFilter(val) {
    markActivity();
    filters.update((f) => ({ ...f, keyword: val }));
  }

  function setTextFilter(val) {
    markActivity();
    const q = String(val || "").trim();
    filters.update((f) => ({ ...f, text: q.length >= 3 ? q : "" }));
  }
  function setShowOnlyLatest(val) {
    markActivity();
    filters.update((f) => ({ ...f, showOnlyLatest: val }));
  }

  onMount(() => {
    const activityEvents = [
      "mousemove",
      "mousedown",
      "click",
      "keydown",
      "wheel",
      "touchstart",
      "pointermove",
    ];
    activityEvents.forEach((ev) =>
      window.addEventListener(ev, markActivity, { passive: true })
    );

    let index = 0;
    const tick = setInterval(() => {
      const idleFor = Date.now() - lastActivity;

      
      if (
        !cycling &&
        !hasCycledSinceIdle &&
        idleFor >= idle_delay &&
        $availableKeywordsLabeled.length > 0
      ) {
        cycling = true;
        cycles = 0;
      }

      if (cycling && $availableKeywordsLabeled.length > 0) {
        index = (index + 1) % $availableKeywordsLabeled.length;
        filters.update((f) => ({
          ...f,
          keyword: $availableKeywordsLabeled[index].value,
        }));
        cycles++;
        if (cycles >= max_cycles) {
          cycling = false;
          hasCycledSinceIdle = true; 
        }
      }
    }, check_ms);

    return () => {
      clearInterval(tick);
      activityEvents.forEach((ev) =>
        window.removeEventListener(ev, markActivity)
      );
    };
  });
</script>

<div class="lang-switch">
  <!-- <Record /> -->

  {#each availableLangs as l}
    <button
      class:active={$lang === l}
      on:click={() => setLang(l)}
      aria-pressed={$lang === l}
    >
      {l.toUpperCase()}
    </button>
  {/each}
</div>
<div class="controls">
  <div>
    {$t("controls_showingLast")}
    <strong
      >{$filteredData.length !== $recent.length
        ? `${$filteredData.length}/${$recent.length}`
        : `${$filteredData.length}/${$articles.length}`}
    </strong>
    {#if $filteredData.length === 1}
      {$tn("controls_report", 1)}
    {:else}
      {$tn("controls_report", $filteredData.length)}
    {/if}
  </div>
  <div>
    {#if $availableKeywordsLabeled.length}
      {$t("controls_filter")}
      <select
        value={$filters.keyword}
        on:change={(e) => setKeywordFilter(e.target.value)}
      >
        <option value="">{$t("controls_any")}</option>
        {#each $availableKeywordsLabeled as opt}
          <option value={opt.value}>{opt.label}</option>
        {/each}
      </select>
    {/if}
    <input
      type="text"
      value={$filters.text}
      on:input={(e) => setTextFilter(e.target.value)}
      minlength="3"
      placeholder={$t("controls_textPlaceholder")}
      class="inline-input"
    />

    <label class="inline-checkbox">
      <input
        type="checkbox"
        checked={$filters.showOnlyLatest}
        on:change={(e) => setShowOnlyLatest(e.target.checked)}
      />
      {$t("controls_onlyLatest")}
    </label>
  </div>
</div>

<style>
  .controls {
    font-family: Arial, Helvetica, sans-serif;
    position: absolute;
    z-index: 10;
    color: #b2b2b2;
    background: #000;
    padding: 5px 10px;
    font-size: 2rem;
    line-height: 2.8rem;
    align-items: center;
    gap: 0.25rem;
  }

  .controls > div {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
  }

  strong {
    color: white;
  }

  .lang-switch {
    position: fixed;
    bottom: 1rem;
    right: 1rem;
    z-index: 10;
    display: flex;
    gap: 0.4rem;
  }

  .lang-switch button {
    background: #111;
    color: #eee;
    font-size: 0.9rem;
    cursor: pointer;
    border: none;
  }

  .lang-switch button.active {
    color: #000;
    background: #fff;
    opacity: 1;
  }

  .controls select,
  .controls .inline-input {
    display: inline-block;
    margin: 0;
    font-size: 0.8em;
    width: 220px;
    vertical-align: middle;
    font-family: Arial, Helvetica, sans-serif;
  }

  label {
    font-family: Arial, Helvetica, sans-serif;
  }

  select,
  input {
    background-color: black;
    color: white;
    border: 1px solid;
  }

  .inline-checkbox {
    display: inline-flex;
    align-items: center;
    font-weight: 400;
    cursor: pointer;
    user-select: none;
  }

  .inline-checkbox input[type="checkbox"] {
    accent-color: var(--color-1);
    width: 1.8rem;
    height: 1.8rem;
    vertical-align: middle;
  }
</style>
