<script>
  import { onMount } from "svelte";
  import * as d3 from "d3";
  import { lang, setLang, availableLangs, t } from "$lib/i18n";
  import { articles, filtered, parseDateLoose } from "$lib/stores";
  import RegionFilter from "$lib/components/RegionFilter.svelte";
  import DistrictFilter from "$lib/components/DistrictFilter.svelte";
  import KeywordFilter from "$lib/components/KeywordFilter.svelte";
  import GenderFilter from "$lib/components/GenderFilter.svelte";
  import YearSlider from "$lib/components/YearSlider.svelte";
  import TimeClusterFilter from "$lib/components/TimeClusterFilter.svelte";
  import TextSearch from "$lib/components/TextSearch.svelte";
  import Timeline from "$lib/components/Timeline.svelte";

  function parseList(str) {
    if (!str) return [];
    try {
      const arr = JSON.parse(String(str).replace(/'/g, '"'));
      return Array.isArray(arr) ? arr : [];
    } catch {
      return String(str)
        .replace(/[\[\]'"]/g, "")
        .split(/[,;]\s*/)
        .map((s) => s.trim())
        .filter(Boolean);
    }
  }

  function normalizeRecord(d) {
    const keywordMatch = parseList(d.KeywordMatch);
    const keywordExtracted = parseList(d.KeywordExtracted);
    const extractedTime = parseList(d.ExtractedTime);
    const extractedAge = parseList(d.ExtractedAge);
    const extractedGender = parseList(d.ExtractedGender);
    const extractedAction = parseList(d.ExtractedAction);
    const districtArr = parseList(d.ExtractedDistrict);
    const extractedDistrict = districtArr[0] || d.Location || "";
    return {
      ...d,
      KeywordMatch: keywordMatch,
      KeywordExtracted: keywordExtracted,
      ExtractedTime: extractedTime,
      ExtractedAge: extractedAge,
      ExtractedGender: extractedGender,
      ExtractedAction: extractedAction,
      ExtractedDistrict: extractedDistrict,
      ExtractedDate: d.ExtractedDate || d.Date,
      Text: d.Text || "",
      Title: d.Title || "",
      URL: d.URL || "",
    };
  }

  onMount(async () => {
    const raw = await d3.csv("/all_merged.csv");
    const data = raw.map(normalizeRecord);
    articles.set(data);
  });

  $: locale = $lang === "de" ? "de-DE" : "en-GB";
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

  $: list = Array.isArray($filtered) ? $filtered : [];
  $: count = list.length;
  $: span = spanFor(list);
  $: toText = $t("summary_l1_to");
  $: midText = $t("summary_l1_mid");
  $: controlsText = $t("controls_filter");

  $: urls = Array.from(
    new Set((list || []).map((d) => String(d.URL || "").trim()).filter(Boolean))
  );

  function copy() {
    const text = JSON.stringify(urls, null, 2);
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText)
      navigator.clipboard.writeText(text);
  }
</script>

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
      <KeywordFilter />
      <!-- <GenderFilter /> -->
      <YearSlider />
      <TimeClusterFilter />
      <TextSearch />
    </div>
  </section>
</article>

<main>
  <Timeline />
</main>

<button type="button" on:click={copy}>Copy URLs</button>

<style>
  article {
    font-family: Arial, Helvetica, sans-serif;
    background-color: black;
    color: white;
    overflow: scroll;
    display: grid;
    grid-template-columns: minmax(320px, 640px) repeat(
        auto-fit,
        minmax(40px, 1fr)
      );
    column-gap: 5px;
    row-gap: 5px;
    align-items: start;
    padding: 10px;
    z-index: 10;
  }

  h2 {
    font-weight: 400;
    font-size: 2rem;
    line-height: 2.2rem;
    color: white;
    margin: 0;
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
    display: grid;
    grid-template-columns: repeat(3, 1fr);
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
