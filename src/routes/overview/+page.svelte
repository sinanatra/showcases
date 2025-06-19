<script>
  import { onMount } from "svelte";
  import * as d3 from "d3";
  import { articles } from "$lib/stores";
  import DistrictFilter from "$lib/components/DistrictFilter.svelte";
  import KeywordFilter from "$lib/components/KeywordFilter.svelte";
  import GenderFilter from "$lib/components/GenderFilter.svelte";
  import TimeClusterFilter from "$lib/components/TimeClusterFilter.svelte";
  import ArticleList from "$lib/components/ArticleList.svelte";

  function parseList(str) {
    if (!str) return [];
    try {
      const arr = JSON.parse(str.replace(/'/g, '"'));
      return Array.isArray(arr) ? arr : [];
    } catch {
      return str.split(/[,;]\s*/).filter(Boolean);
    }
  }

  onMount(async () => {
    const raw = await d3.csv("parsed.csv");
    const data = raw.map((d) => {
      const km = parseList(d.KeywordMatch);
      const ke = parseList(d.KeywordExtracted);
      const dt = parseList(d.ExtractedTime);
      const ag = parseList(d.ExtractedAge);
      const ge = parseList(d.ExtractedGender);
      const ac = parseList(d.ExtractedAction);
      const distArr = parseList(d.ExtractedDistrict);
      return {
        ...d,
        KeywordMatch: km,
        KeywordExtracted: ke,
        ExtractedTime: dt,
        ExtractedAge: ag,
        ExtractedGender: ge,
        ExtractedAction: ac,
        ExtractedDistrict: distArr[0] || d.Location || "",
        ExtractedDate: d.ExtractedDate || d.Date,
      };
    });
    articles.set(data);
  });
</script>

<main>
  <div class="filters">
    <DistrictFilter />
    <KeywordFilter />
    <GenderFilter />
    <TimeClusterFilter />
  </div>
  <ArticleList />
</main>

<style>
  .filters {
    display: flex;
    gap: 1rem;
    margin-bottom: 1rem;
  }
</style>
