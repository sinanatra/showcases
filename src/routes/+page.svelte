<script>
  import {
    GENDER_LABELS,
    TIME_LABELS,
    genderMap,
    articles,
    parseDateLoose,
    keywordsGroup,
  } from "$lib/stores";
  import Scrollytelling from "$lib/components/Scrollytelling.svelte";
  import { onMount } from "svelte";
  import * as d3 from "d3";
  import { lang } from "$lib/i18n";
  export let data;

  onMount(async () => {
    if (Array.isArray($articles) && $articles.length) return;
    const raw = await d3.csv("/all_merged.csv");
    articles.set(
      raw.map((d) => ({
        ...d,
        ExtractedGender: (d.ExtractedGender || "")
          .replace(/[\[\]'"]/g, "")
          .split(/[,;]/)
          .map((s) => s.trim())
          .filter(Boolean),
        ExtractedTime: (d.ExtractedTime || "")
          .replace(/[\[\]'"]/g, "")
          .split(/[,;]/)
          .map((s) => s.trim())
          .filter(Boolean),
        KeywordMatch: (d.KeywordMatch || "")
          .replace(/[\[\]'"]/g, "")
          .split(/[,;]/)
          .map((s) => s.trim())
          .filter(Boolean),
        Text: d.Text || "",
        URL: d.URL || "",
        Title: d.Title || "",
      }))
    );
  });

  $: locale = $lang === "de" ? "de-DE" : "en-GB";
  const fmtDate = (d) =>
    new Intl.DateTimeFormat(locale, {
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(d);
  const fmtNum = (n) => new Intl.NumberFormat(locale).format(n);

  function detectRegion(a) {
    const s = String(a?.SourceFile || "").toLowerCase();
    const u = String(a?.URL || "").toLowerCase();
    if (s.includes("berlin") || u.includes("berlin.de")) return "Berlin";
    if (s.includes("brandenburg") || u.includes("brandenburg.de"))
      return "Brandenburg";
    return "";
  }

  function timeCluster(h) {
    if (h >= 6 && h < 12) return "Morning";
    if (h >= 12 && h < 18) return "Afternoon";
    if (h >= 18 && h < 24) return "Evening";
    return "Night";
  }

  const canonicalKeyword = (k) =>
    keywordsGroup[String(k || "").toLowerCase()] || String(k || "");

  $: list = Array.isArray($articles) ? $articles : [];
  $: withDates = list
    .map((a) => ({ a, d: parseDateLoose(a?.ExtractedDate || a?.Date) }))
    .filter((x) => x.d && !isNaN(+x.d));

  $: firstDate = withDates.length
    ? new Date(Math.min(...withDates.map((x) => +x.d)))
    : null;
  $: lastDate = withDates.length
    ? new Date(Math.max(...withDates.map((x) => +x.d)))
    : null;

  $: berlinCount = withDates.filter(
    (x) => detectRegion(x.a) === "Berlin"
  ).length;
  $: brandenburgCount = withDates.filter(
    (x) => detectRegion(x.a) === "Brandenburg"
  ).length;

  $: timeCounts = (() => {
    const m = new Map();
    for (const { a } of withDates) {
      const ts = Array.isArray(a.ExtractedTime)
        ? a.ExtractedTime
        : a.ExtractedTime
          ? [a.ExtractedTime]
          : [];
      const h = ts.length ? Number(String(ts[0]).split(":")[0]) : NaN;
      const bucket = timeCluster(isFinite(h) ? h : 0);
      m.set(bucket, (m.get(bucket) || 0) + 1);
    }
    return m;
  })();

  $: genderCounts = (() => {
    const m = new Map();
    for (const { a } of withDates) {
      const gs = Array.isArray(a.ExtractedGender)
        ? a.ExtractedGender
        : a.ExtractedGender
          ? [a.ExtractedGender]
          : [];
      for (const g of gs) {
        const normalized = genderMap[String(g).toLowerCase()] || "Other";
        m.set(normalized, (m.get(normalized) || 0) + 1);
      }
    }
    return m;
  })();

  $: yearCounts = (() => {
    const m = new Map();
    for (const { d } of withDates) {
      const y = d.getFullYear();
      m.set(y, (m.get(y) || 0) + 1);
    }
    return m;
  })();

  $: keywordCounts = (() => {
    const m = new Map();
    for (const { a } of withDates) {
      const ks = Array.isArray(a.KeywordMatch) ? a.KeywordMatch : [];
      for (const k of ks) {
        const canon = canonicalKeyword(k);
        if (!canon) continue;
        m.set(canon, (m.get(canon) || 0) + 1);
      }
    }
    return m;
  })();

  function topOf(map, fallback = "—") {
    let bestK = fallback,
      bestV = 0;
    for (const [k, v] of map.entries())
      if (v > bestV) {
        bestV = v;
        bestK = k;
      }
    return { key: bestK, value: bestV };
  }

  $: topTime = topOf(timeCounts);
  $: topGender = topOf(genderCounts);
  $: topYear = topOf(yearCounts, "—");
  $: topKeyword = topOf(keywordCounts);

  $: topTimeLabel = TIME_LABELS[$lang]?.[topTime.key] ?? topTime.key;
  $: topGenderLabel = GENDER_LABELS[$lang]?.[topGender.key] ?? topGender.key;

  $: scrollyData = withDates.length
    ? {
        firstDate: fmtDate(firstDate),
        lastDate: fmtDate(lastDate),
        totalAll: fmtNum(withDates.length),
        berlinCount: fmtNum(berlinCount),
        brandenburgCount: fmtNum(brandenburgCount),
        topTimeLabel,
        topTimeCount: fmtNum(topTime.value),
        topGenderLabel,
        topGenderCount: fmtNum(topGender.value),
        topYear: topYear.key,
        topYearCount: fmtNum(topYear.value),
        topKeyword: topKeyword.key,
        topKeywordCount: fmtNum(topKeyword.value),
      }
    : {
        firstDate: "—",
        lastDate: "—",
        totalAll: 0,
        berlinCount: 0,
        brandenburgCount: 0,
        topTimeLabel: "—",
        topTimeCount: 0,
        topGenderLabel: "—",
        topGenderCount: 0,
        topYear: "—",
        topYearCount: 0,
        topKeyword: "—",
        topKeywordCount: 0,
      };
</script>

<Scrollytelling src="/scenes.json" data={scrollyData} storiesData={data} />
