<script>
  import { lang, setLang, availableLangs, t } from "$lib/i18n";
  import { filtered, parseDateLoose } from "$lib/stores";
  import { loadArticles } from "$lib/utils/loadArticles";
  import RegionFilter from "$lib/components/RegionFilter.svelte";
  import DistrictFilter from "$lib/components/DistrictFilter.svelte";
  import KeywordFilter from "$lib/components/KeywordFilter.svelte";
  import GenderFilter from "$lib/components/GenderFilter.svelte";
  import YearSlider from "$lib/components/YearSlider.svelte";
  import TimeClusterFilter from "$lib/components/TimeClusterFilter.svelte";
  import TextSearch from "$lib/components/TextSearch.svelte";
  import Timeline from "$lib/components/Timeline.svelte";

  let timelineDataLoaded = $state(false);

  $effect(() => {
    if (timelineDataLoaded) return;
    loadArticles()
      .then(() => { timelineDataLoaded = true; })
      .catch((err) => console.error("Failed to load timeline data:", err));
  });

  let locale = $derived($lang === "de" ? "de-DE" : "en-GB");
  const fmtNum = (n) => new Intl.NumberFormat(locale).format(n ?? 0);
  const fmtDate = (d) =>
    d
      ? new Intl.DateTimeFormat(locale, {
          year: "numeric",
          month: "long",
          day: "numeric",
        }).format(d)
      : "—";

  function spanFor(arr) {
    if (!Array.isArray(arr) || !arr.length) return null;
    let start = null;
    let end = null;
    for (const a of arr) {
      const d = parseDateLoose(a?.ExtractedDate || a?.Date);
      if (!d || isNaN(+d)) continue;
      if (!start || d < start) start = d;
      if (!end || d > end) end = d;
    }
    return start && end ? { start, end } : null;
  }

  const sameDay = (a, b) =>
    a &&
    b &&
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  function fmtRange(range, toText) {
    if (!range) return "—";
    const { start, end } = range;
    if (!end || sameDay(start, end)) return `${fmtDate(start)}`;
    return `${fmtDate(start)} ${toText} ${fmtDate(end)}`;
  }

  let list = $derived(Array.isArray($filtered) ? $filtered : []);
  let count = $derived(list.length);
  let span = $derived(spanFor(list));
  let toText = $derived($t("summary_l1_to"));
  let midText = $derived($t("summary_l1_mid"));
  let controlsText = $derived($t("controls_filter"));

  let urls = $derived(Array.from(
    new Set((list || []).map((d) => String(d.URL || "").trim()).filter(Boolean))
  ));

  function copy() {
    const text = JSON.stringify(urls, null, 2);
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText)
      navigator.clipboard.writeText(text);
  }
</script>

<div class="page">
<article>
  <header class="top">
    <div class="lang-switch" aria-label="Language switcher">
      {#each availableLangs as l}
        <button
          class:active={$lang === l}
          on:click={() => setLang(l)}
          aria-pressed={$lang === l}
          type="button"
        >
          {l.toUpperCase()}
        </button>
      {/each}
    </div>

    <h2>{fmtNum(count)} {midText} {fmtRange(span, toText)}.</h2>
  </header>

  <section class="filters">
    <h3 class="visually-hidden">{controlsText}</h3>
    <div class="filters-grid">
      <RegionFilter />
      <DistrictFilter />
      <!-- <GenderFilter /> -->

      <YearSlider />
      <TimeClusterFilter />

      <KeywordFilter />
      <TextSearch />
    </div>
  </section>
</article>

<main>
  <Timeline />
</main>
</div>

<!-- <button type="button" on:click={copy}>Copy URLs</button> -->

<style>
  .page {
    display: flex;
    flex-direction: column;
  }

  article {
    font-family: Arial, Helvetica, sans-serif;
    background-color: black;
    color: white;
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 10px;
  }

  main {
    width: 100%;
  }

  h2 {
    font-weight: 400;
    font-size: 2rem;
    line-height: 2.2rem;
    color: white;
    margin: 0;
    margin-bottom: 2rem;
  }

  .lang-switch {
    position: fixed;
    bottom: 1rem;
    right: 1rem;
    z-index: 10;
    display: flex;
    gap: 0.5rem;
  }

  .lang-switch button {
    background: #111;
    color: #eee;
    border: none;
    cursor: pointer;
    padding: 0.35rem 0.6rem;
  }

  .lang-switch button.active {
    background: #fff;
    color: #000;
  }

  .filters-grid {
    display: flex;
    flex-wrap: wrap;
    max-width: 940px;
    /* grid-template-columns: repeat(3, 1fr);
    max-width: 1040px; */
    gap: 10px;
  }

  @media (max-width: 600px) {
    .filters-grid {
      grid-template-columns: 1fr;
    }
    article {
      display: block;
    }
    .filters {
      padding-top: 10px;
    }
  }

  .visually-hidden {
    position: absolute;
    left: -9999px;
  }
</style>
