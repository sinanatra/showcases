<script>
  import { untrack } from "svelte";
  import { articles, applyFilters, filters, parseDateLoose } from "$lib/stores";
  import { loadArticles } from "$lib/utils/loadArticles";
  import { loadReportTranslations } from "$lib/utils/reportTranslations";
  import { lang, setLang, availableLangs, t as tr } from "$lib/i18n";
  import Query from "$lib/components/Query.svelte";
  import Curated from "./Curated.svelte";
  import Pile from "./Pile.svelte";
  import TimeBar from "./TimeBar.svelte";
  import { STEP, FLIGHT } from "./pile.js";

  let scrollY = $state(0);
  let innerHeight = $state(800);
  let introHeight = $state(0);

  let translations = $state(null);
  let open = $state(false);
  let view = $state.raw(null); // curated view

  $effect(() => {
    loadArticles();
    loadReportTranslations().then((map) => (translations = map));
  });
  const map = $derived($lang === "en" ? translations : null);

  const date = (d) => parseDateLoose(d.Date)?.getTime() ?? 0;
  const all = $derived([...$articles].sort((a, b) => date(b) - date(a)));

  const reports = $derived.by(() => {
    translations; // re-run for the English
    return applyFilters(all, {
      ...(view?.filters ?? $filters),
      textLang: "both",
    });
  });

  const search = $derived(
    (view
      ? ((map && view.highlightEn) ?? view.filters.text ?? "")
      : $filters.text
    ).trim(),
  );
  const query = $derived(search.length >= 3 ? search : "");

  const stepHeight = $derived(innerHeight * STEP);
  const progress = $derived(
    Math.max(
      0,
      Math.min(
        (scrollY - introHeight) / stepHeight,
        reports.length + FLIGHT - 2,
      ),
    ),
  );
  const top = $derived(Math.min(Math.floor(progress), reports.length - 1));

  let lastFilters = null;
  $effect(() => {
    const current = `${view?.id ?? query}|${$filters.keyword}|${$filters.year}`;
    if (lastFilters !== null && current !== lastFilters)
      window.scrollTo(
        0,
        untrack(() => introHeight),
      );
    lastFilters = current;
  });

  const intro = (key) =>
    $tr(key)
      .replace("{n}", all.length.toLocaleString($lang))
      .replace("{year}", String(all.at(-1).Date).slice(-4));
</script>

<svelte:window bind:scrollY bind:innerHeight />

<TimeBar
  {all}
  {reports}
  time={date}
  current={reports[top] ? date(reports[top]) : 0}
  onpick={(i) => window.scrollTo(0, introHeight + i * stepHeight + 1)}
/>

<div class="langs">
  {#each availableLangs as l}
    <button class:active={$lang === l} onclick={() => setLang(l)}
      >{l.toUpperCase()}</button
    >
  {/each}
</div>

<section class="intro" bind:offsetHeight={introHeight}>
  {#if all.length}
    <p><span class="line-bg">{intro("reports.intro")}</span></p>
    <br />
    <p><span class="line-bg">{intro("reports.how")}</span></p>
  {/if}
</section>

<div class="filters" class:hidden={scrollY <= introHeight / 2} class:open>
  <button class="toggle" class:active={view} onclick={() => (open = !open)}>
    {$tr("filters.toggle")}
  </button>
  <div class="panel">
    {#if !view}
      <Query fields={["keyword", "year", "search"]} textLang="both" />
    {/if}
    <Curated bind:active={view} />
  </div>
</div>

<Pile {reports} {top} {progress} {query} {map} />

<style>
  :global(html body) {
    background: gainsboro;
    font-family: Arial, Helvetica, sans-serif;
  }

  .intro {
    position: sticky;
    top: 0;
    box-sizing: border-box;
    min-height: 20vh;
    max-width: 680px;
    margin: 0 auto;
    padding: 60px 40px 40px;
    display: flex;
    flex-direction: column;
    color: #000;
    text-align: center;
  }
  .intro p {
    font-size: 22px;
    line-height: 1.22;
  }

  .langs {
    position: fixed;
    top: 32px;
    left: 16px;
    z-index: 1;
    display: flex;
    gap: 4px;
  }
  .langs button,
  .toggle {
    padding: 5px 10px;
    font-family: Arial, Helvetica, sans-serif;
    font-size: 16px;
    background: #fff;
    color: #000;
    border: 1px solid #ccc;
    border-radius: 0;
  }
  .langs .active,
  .toggle.active {
    background: #000;
    color: #fff;
  }

  .filters {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 1;
    box-sizing: border-box;
    padding: 64px 16px 16px;
    background: linear-gradient(to top, #fff calc(100% - 64px), transparent);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    color: #000;
    pointer-events: none;
    transition: opacity 0.2s;
  }
  .filters:not(.hidden) > * {
    pointer-events: auto;
  }
  .filters.hidden {
    opacity: 0;
  }
  .panel {
    display: contents;
  }
  .toggle {
    display: none;
    border-color: #000;
  }

  @media (max-width: 900px) {
    .intro {
      padding-top: 76px;
    }
  }

  @media (max-width: 700px) {
    .intro {
      position: static;
      padding: 76px 16px 16px;
    }
    .intro p {
      font-size: 18px;
    }
    .filters {
      --query-search-label: none;
      --query-field: 1 1 40%;
      --query-width: 100%;
      gap: 6px;
      padding: 12px;
      background: none;
    }
    .filters.open {
      align-items: stretch;
      padding-top: 40px;
      background: linear-gradient(to top, #fff calc(100% - 40px), transparent);
    }
    .toggle {
      display: block;
      align-self: center;
    }
    .panel {
      display: none;
    }
    .open .panel {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
  }
</style>
