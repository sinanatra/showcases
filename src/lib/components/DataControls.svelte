<script>
  import { onMount } from "svelte";
  import { filters, availableKeywords, filteredData } from "$lib/stores";

  let lastInteraction = Date.now();
  let stopped = false;
  let controlsEl;

  function markInteraction() {
    lastInteraction = Date.now();
    stopped = true;
  }

  function setKeywordFilter(val) {
    markInteraction();
    filters.update((f) => ({ ...f, keyword: val }));
  }
  function setTextFilter(val) {
    markInteraction();
    filters.update((f) => ({ ...f, text: val }));
  }
  function setShowOnlyLatest(val) {
    markInteraction();
    filters.update((f) => ({ ...f, showOnlyLatest: val }));
  }

  onMount(() => {
    let index = 0;
    let cycles = 0;
    const maxCycles = 10;
    const checkIntervalMs = 3000;
    const idleThresholdMs = 10000;

    const interval = setInterval(() => {
      if (stopped) return;

      const idleFor = Date.now() - lastInteraction;
      if (idleFor >= idleThresholdMs && $availableKeywords.length > 0) {
        index = (index + 1) % $availableKeywords.length;

        filters.update((f) => ({ ...f, keyword: $availableKeywords[index] }));
        cycles++;
        if (cycles >= maxCycles) {
          clearInterval(interval);
        }
      }
    }, checkIntervalMs);

    const stopOnActivity = () => {
      if (!stopped) {
        stopped = true;
        clearInterval(interval);
      }
    };

    const events = [
      "mousemove",
      "pointerdown",
      "keydown",
      "wheel",
      "touchstart",
    ];
    events.forEach((e) =>
      window.addEventListener(e, stopOnActivity, { passive: true })
    );

    const focusHandler = stopOnActivity;
    controlsEl?.addEventListener("focusin", focusHandler);

    return () => {
      clearInterval(interval);
      events.forEach((e) => window.removeEventListener(e, stopOnActivity));
      controlsEl?.removeEventListener("focusin", focusHandler);
    };
  });
</script>

<div class="controls" bind:this={controlsEl}>
  Showing the last
  <strong>{$filteredData.length}</strong>
  police reports {$filteredData.length === 1 ? "" : "s"}
  {#if $availableKeywords.length}
    mentioning:
    <select
      value={$filters.keyword}
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
    value={$filters.text}
    on:input={(e) => setTextFilter(e.target.value)}
    placeholder="text…"
    class="inline-input"
  />
  , or
  <label class="inline-checkbox">
    <input
      type="checkbox"
      checked={$filters.showOnlyLatest}
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
