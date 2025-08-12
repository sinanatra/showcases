<script>
  import { onMount } from "svelte";
  import {
    filters,
    availableKeywordsLabeled,
    availableGendersLabeled,
    availableTimeClustersLabeled,
    filteredData,
  } from "$lib/stores";

  import { t, tn, lang, setLang, availableLangs } from "$lib/i18n";

  let lastActivity = Date.now();
  let cycling = false;
  let cycles = 0;

  const idle_delay = 10000;
  const check_ms = 5000;
  const max_cycles = 20;

  function markActivity() {
    lastActivity = Date.now();
    cycling = false;
    cycles = 0;
  }

  function setKeywordFilter(val) {
    markActivity();
    filters.update((f) => ({ ...f, keyword: val }));
  }
  function setTextFilter(val) {
    markActivity();
    filters.update((f) => ({ ...f, text: val }));
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
  {$t("controls_showingLast")}
  <strong>{$filteredData.length}</strong>
  {#if $filteredData.length === 1}
    {$tn("controls_report", 1)}
  {:else}
    {$tn("controls_report", $filteredData.length)}
  {/if}

  {#if $availableKeywordsLabeled.length}
    &nbsp;{$t("controls_mentioning")}
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

  {$t("controls_containing")}
  <input
    type="text"
    value={$filters.text}
    on:input={(e) => setTextFilter(e.target.value)}
    placeholder={$t("controls_textPlaceholder")}
    class="inline-input"
  />

  {$t("controls_or")}
  <label class="inline-checkbox">
    <input
      type="checkbox"
      checked={$filters.showOnlyLatest}
      on:change={(e) => setShowOnlyLatest(e.target.checked)}
    />
    {$t("controls_onlyLatest")}
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
    gap: 0.25rem;
  }

  .lang-switch {
    position: fixed;
    bottom: 1rem;
    right: 1rem;
    z-index: 10;
    display: flex;
    gap: 10px;
  }

  .lang-switch button {
    background: #111;
    color: #eee;
    border: 1px solid #333;
    border-radius: 8px;
    padding: 0.35rem 0.6rem;
    font-size: 0.9rem;
    cursor: pointer;
    opacity: 0.85;
  }
  .lang-switch button.active {
    border-color: #888;
    background: #222;
    opacity: 1;
  }

  .controls select,
  .controls .inline-input {
    display: inline-block;
    margin: 0 0.25em;
    background-color: #272727;
    color: white;
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
    padding: 0 10px;
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
