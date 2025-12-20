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
  import * as d3 from "d3";
  import { lang } from "$lib/i18n";
  let { data } = $props();

  let articlesLoaded = $state(false);

  $effect(() => {
    if (articlesLoaded) return;
    if (Array.isArray($articles) && $articles.length) {
      articlesLoaded = true;
      return;
    }
    
    (async () => {
      try {
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
        articlesLoaded = true;
      } catch (err) {
        console.error("Failed to load data:", err);
      }
    })();
  });

  let locale = $derived($lang === "de" ? "de-DE" : "en-GB");
  let fmtDate = $derived.by(() => 
    (d) => new Intl.DateTimeFormat(locale, {
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(d)
  );
  let fmtNum = $derived.by(() => 
    (n) => new Intl.NumberFormat(locale).format(n)
  );

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

  let list = $derived(Array.isArray($articles) ? $articles : []);
  let withDates = $derived(list
    .map((a) => ({ a, d: parseDateLoose(a?.ExtractedDate || a?.Date) }))
    .filter((x) => x.d && !isNaN(+x.d)));

  let firstDate = $derived(withDates.length
    ? new Date(Math.min(...withDates.map((x) => +x.d)))
    : null);
  let lastDate = $derived(withDates.length
    ? new Date(Math.max(...withDates.map((x) => +x.d)))
    : null);

  let berlinCount = $derived(withDates.filter(
    (x) => detectRegion(x.a) === "Berlin"
  ).length);
  let brandenburgCount = $derived(withDates.filter(
    (x) => detectRegion(x.a) === "Brandenburg"
  ).length);

  let timeCounts = $derived((() => {
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
  })());

  let genderCounts = $derived((() => {
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
  })());

  let yearCounts = $derived((() => {
    const m = new Map();
    for (const { d } of withDates) {
      const y = d.getFullYear();
      m.set(y, (m.get(y) || 0) + 1);
    }
    return m;
  })());

  let keywordCounts = $derived((() => {
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
  })());

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

  let topTime = $derived(topOf(timeCounts));
  let topGender = $derived(topOf(genderCounts));
  let topYear = $derived(topOf(yearCounts, "—"));
  let topKeyword = $derived(topOf(keywordCounts));

  let topTimeLabel = $derived(TIME_LABELS[$lang]?.[topTime.key] ?? topTime.key);
  let topGenderLabel = $derived(GENDER_LABELS[$lang]?.[topGender.key] ?? topGender.key);

  let scrollyData = $derived(withDates.length
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
      });
</script>

<Scrollytelling src="/scenes.json" data={scrollyData} storiesData={data} />
