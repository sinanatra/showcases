<script>
  import { onMount } from "svelte";
  import { writable, derived } from "svelte/store";
  import * as d3 from "d3";

  const articles = writable([]);
  const filters = writable({ district: "", keyword: "" });

  function parseList(str) {
    if (!str) return [];

    try {
      const json = str.replace(/'/g, '"');
      const arr = JSON.parse(json);
      if (Array.isArray(arr)) return arr;
    } catch (e) {}

    return str.split(/[,;]\s*/).filter(Boolean);
  }

  const filtered = derived([articles, filters], ([$articles, $filters]) =>
    $articles.filter((a) => {
      if ($filters.district && a.ExtractedDistrict !== $filters.district)
        return false;
      if ($filters.keyword && !a.KeywordMatch.includes($filters.keyword))
        return false;
      return true;
    })
  );

  let districts = [];
  let keywords = [];

  articles.subscribe((data) => {
    districts = Array.from(new Set(data.map((d) => d.ExtractedDistrict)))
      .filter(Boolean)
      .sort();
    keywords = Array.from(new Set(data.flatMap((d) => d.KeywordMatch)))
      .filter(Boolean)
      .sort();
  });

  onMount(async () => {
    const raw = await d3.csv("/parsed.csv");
    const data = raw.map((d) => {
      const km = parseList(d.KeywordMatch);
      const ke = parseList(d.KeywordExtracted);
      const dtTimes = parseList(d.ExtractedTime);
      const ages = parseList(d.ExtractedAge);
      const genders = parseList(d.ExtractedGender);
      const actions = parseList(d.ExtractedAction);

      const distArr = parseList(d.ExtractedDistrict);
      const district = distArr.length > 0 ? distArr[0] : d.Location || "";
      return {
        ...d,
        KeywordMatch: km,
        KeywordExtracted: ke,

        ExtractedTime: dtTimes,
        ExtractedAge: ages,
        ExtractedGender: genders,
        ExtractedAction: actions,
        ExtractedDistrict: district,
        ExtractedDate: d.ExtractedDate || d.Date,
      };
    });
    articles.set(data);
  });

  function highlight(text, terms) {
    let html = text;
    terms.forEach((term) => {
      const re = new RegExp(`(${term})`, "gi");
      html = html.replace(re, '<span class="highlight">$1</span>');
    });
    return html;
  }
</script>

<article>
  <div class="filters">
    <label>
      District:
      <select
        bind:value={$filters.district}
        on:change={(e) =>
          filters.set({ ...$filters, district: e.target.value })}
      >
        <option value="">All</option>
        {#each districts as d}
          <option value={d}>{d}</option>
        {/each}
      </select>
    </label>

    <label>
      Keyword:
      <select
        bind:value={$filters.keyword}
        on:change={(e) => filters.set({ ...$filters, keyword: e.target.value })}
      >
        <option value="">All</option>
        {#each keywords as kw}
          <option value={kw}>{kw}</option>
        {/each}
      </select>
    </label>
  </div>

  {#if $filtered.length === 0}
    <p>No articles match the selected filters.</p>
  {:else}
    {#each $filtered as article}
      <article>
        <h2>{article.Title}</h2>
        <p>
          <strong>Date:</strong>
          {article.ExtractedDate}
          <strong>Time:</strong>
          {article.ExtractedTime.join(", ")}
        </p>
        <p><strong>District:</strong> {article.ExtractedDistrict}</p>
        <p><strong>Keywords:</strong> {article.KeywordMatch.join(", ")}</p>
        <div>{@html highlight(article.Text, article.KeywordExtracted)}</div>
      </article>
    {/each}
  {/if}
</article>

<style>
  article {
    font-family: Arial, Helvetica, sans-serif;
  }

  :global(.highlight) {
    background-color: yellow;
  }
  .filters {
    margin-bottom: 1rem;
  }
  article {
    padding: 1rem;
    border-bottom: 1px solid #ddd;
  }
</style>
