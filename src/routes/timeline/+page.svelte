<script>
  import { onMount } from "svelte";
  import * as d3 from "d3";
  import { articles } from "$lib/stores";
  import DistrictFilter from "$lib/components/DistrictFilter.svelte";
  import KeywordFilter from "$lib/components/KeywordFilter.svelte";
  import GenderFilter from "$lib/components/GenderFilter.svelte";
  import TimeClusterFilter from "$lib/components/TimeClusterFilter.svelte";
  import Timeline from "$lib/components/Timeline.svelte";

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
      const times = parseList(d.ExtractedTime);
      const ages = parseList(d.ExtractedAge);
      const genders = parseList(d.ExtractedGender);
      const actions = parseList(d.ExtractedAction);
      const distArr = parseList(d.ExtractedDistrict);
      const district = distArr[0] || d.Location || "";
      return {
        ...d,
        KeywordMatch: km,
        KeywordExtracted: ke,
        ExtractedTime: times,
        ExtractedAge: ages,
        ExtractedGender: genders,
        ExtractedAction: actions,
        ExtractedDistrict: district,
        ExtractedDate: d.ExtractedDate || d.Date,
      };
    });
    articles.set(data);
  });
</script>

<main>
  <section class="filters">
    <DistrictFilter />
    <KeywordFilter />
    <GenderFilter />
    <TimeClusterFilter />
  </section>

  <section class="timeline-wrapper">
    <Timeline />
  </section>
</main>
