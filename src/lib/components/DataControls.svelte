<script>
  import { onMount } from "svelte";
  import {
    filters,
    createFilterState,
    articles,
    availableKeywordsLabeled,
    recent,
    filteredData,
    parseDateLoose,
  } from "$lib/stores";
  import Record from "$lib/components/Record.svelte";
  import { t, tn, lang, setLang, availableLangs } from "$lib/i18n";

  export let floating = true;

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
    if (val) {
      filters.set(createFilterState({ showOnlyLatest: true }));
    } else {
      filters.update((f) => ({ ...f, showOnlyLatest: false }));
    }
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

  function fmtNum(n) {
    const locale = $lang === "de" ? "de-DE" : "en-GB";
    return new Intl.NumberFormat(locale).format(n);
  }

  function fmtDate(d) {
    if (!d) return "";
    const locale = $lang === "de" ? "de-DE" : "en-GB";
    return new Intl.DateTimeFormat(locale, {
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(d);
  }

  function spanFor(list) {
    if (!Array.isArray(list) || !list.length) return null;
    let start = null,
      end = null;
    for (const a of list) {
      const d = parseDateLoose(a?.ExtractedDate || a?.Date);
      if (!d || isNaN(+d)) continue;
      if (!start || d < start) start = d;
      if (!end || d > end) end = d;
    }
    return start && end ? { start, end } : null;
  }

  function sameDay(a, b) {
    if (!a || !b) return false;
    return (
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate()
    );
  }

  function fmtRange(range, toKey = "summary_l1_to") {
    if (!range) return "";
    const { start, end } = range;
    if (!end || sameDay(start, end)) return `${fmtDate(start)}`;
    return `${fmtDate(start)} ${$t(toKey)} ${fmtDate(end)}`;
  }

  $: totalFiltered = $filteredData.length;
  $: totalRecent = $recent.length;
  $: totalAll = $articles.length;

  $: spanFiltered = spanFor($filteredData);
  $: spanTotal = spanFor($articles);
</script>

<!-- <div class="lang-switch">
  {#each availableLangs as l}
    <button
      class:active={$lang === l}
      on:click={() => setLang(l)}
      aria-pressed={$lang === l}
    >
      {l.toUpperCase()}
    </button>
  {/each}
</div> -->

<div class="controls" class:floating>
  <div>
    <h2>
      <span class="line-bg">
        {fmtNum(totalFiltered)}
        {$t("summary_l1_mid")}
        {fmtRange(spanFiltered, "summary_l1_to")}.
      </span>
    </h2>
    <div>
      <p>
        <span class="line-bg">
          {$t("summary_l2_prefix")}
          {fmtNum(totalRecent)}
          {$t("summary_l2_incidents")}
          {$t("summary_l2_within")}
          {fmtNum(totalAll)}
          {$t("summary_l2_cases")}
          {$t("summary_l2_span_open")}
          {fmtRange(spanTotal, "summary_l2_to")}{$t("summary_l2_span_close")}.
        </span>
      </p>
    </div>
    <br />
    <!-- <p>
      <span class="line-bg">
        {$t("summary_l2_see")}
        <a href="/timeline" data-sveltekit-reload>{$t("summary_l2_link")}</a>
        {$t("summary_l2_for")}
      </span>
    </p> -->
  </div>
  <div>
    {#if $availableKeywordsLabeled.length}
      <p>
        <span>
          {$t("controls_filter")}
        </span>
      </p>
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
    text-align: left;
    color: white;
    padding: 5px 10px;
    font-size: 0.9rem;
    line-height: 1rem;
    display: grid;
    grid-template-columns: 3fr 1fr;
    column-gap: 5px;
    row-gap: 5px;
    align-items: center;
    border-radius: 10px;
    position: relative;
    width: 100%;
    max-width: 1400px;
    z-index: 1;
    background: transparent;
  }

  .controls span {
    padding: 2px 4px;
    background-color: black;
  }

  .controls.floating {
    position: absolute;
    z-index: 1000;
    margin-top: 10px;
  }

  h2,
  p {
    margin: 0;
    margin-bottom: 0.2ch;
  }

  h2 {
    font-weight: 400;
    font-size: 1.6em;
    line-height: 1.2em;
  }

  p {
    font-size: 1.2em;
    line-height: 1.2em;
  }

  a {
    color: var(--color-2);
  }

  /* .lang-switch {
    position: fixed;
    bottom: 1rem;
    right: 1rem;
    z-index: 10;
    display: flex;
    gap: 0.2rem;
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
  } */

  .controls select,
  .controls .inline-input {
    display: block;
    margin: 0;
    margin-bottom: 5px;
    width: 220px;
    font-family: Arial, Helvetica, sans-serif;
  }

  label {
    font-family: Arial, Helvetica, sans-serif;
  }

  select,
  input,
  .inline-checkbox {
    background-color: black;
    color: white;
    padding: 2px;
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
    /* width: 1.8rem;
    height: 1.8rem; */
    vertical-align: middle;
  }

  @media (max-width: 800px) {
    .controls {
      grid-template-columns: 1fr;
      font-size: 1rem;
    }
  }
</style>
