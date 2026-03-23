import { readable, writable, derived } from "svelte/store";
import { lang } from "$lib/i18n";
import { browser } from "$app/environment";
import { parseDateLoose } from "$lib/utils/parseDate";
import { detectRegion } from "$lib/utils/detectRegion";
import {
  keywordsGroup,
  canonicalKeywords,
  KEYWORD_LABELS,
  getKeywordVariants,
  augmentKeywordMatch,
} from "$lib/constants/keywords";
import { genderMap, GENDER_LABELS } from "$lib/constants/genders";
import { TIME_LABELS, timeCluster } from "$lib/constants/times";
import { normalizeDistrict } from "$lib/constants/districts";

export {
  parseDateLoose,
  detectRegion,
  keywordsGroup,
  canonicalKeywords,
  getKeywordVariants,
  augmentKeywordMatch,
  genderMap,
  GENDER_LABELS,
  TIME_LABELS,
};

export const articles = writable([]);

const filterDefaults = {
  district: "",
  keyword: "",
  gender: "",
  timeCluster: "",
  text: "",
  showOnlyLatest: false,
  region: "",
  yearMin: null,
  yearMax: null,
  dateMin: null,
  dateMax: null,
};

export function createFilterState(overrides = {}) {
  return { ...filterDefaults, ...overrides };
}

export const filters = writable(createFilterState());

export const yearsExtent = derived(articles, ($articles) => {
  let min = Infinity,
    max = -Infinity;
  for (const a of Array.isArray($articles) ? $articles : []) {
    const d = parseDateLoose(a.ExtractedDate || a.Date);
    if (!d || isNaN(+d)) continue;
    const y = d.getFullYear();
    if (y < min) min = y;
    if (y > max) max = y;
  }
  if (!isFinite(min) || !isFinite(max)) {
    const y = new Date().getFullYear();
    return { min: y, max: y };
  }
  return { min, max };
});

export const datesExtent = derived(articles, ($articles) => {
  let min = null;
  let max = null;
  for (const a of Array.isArray($articles) ? $articles : []) {
    const d = parseDateLoose(a.ExtractedDate || a.Date);
    if (!d || isNaN(+d)) continue;
    if (!min || d < min) min = d;
    if (!max || d > max) max = d;
  }
  return { min, max };
});

export const effectiveYearRange = derived(
  [filters, yearsExtent],
  ([$filters, $extent]) => ({
    min: $filters.yearMin ?? $extent.min,
    max: $filters.yearMax ?? $extent.max,
  })
);

export function filterArticles(list, { district, keyword }, exclude) {
  const variants = keyword ? getKeywordVariants(keyword) : [];
  return (Array.isArray(list) ? list : []).filter((a) => {
    if (exclude !== "district" && district && a.ExtractedDistrict !== district)
      return false;
    if (
      exclude !== "keyword" &&
      keyword &&
      !(
        Array.isArray(a.KeywordMatch) &&
        a.KeywordMatch.some((k) =>
          variants
            .map(String)
            .map((s) => s.toLowerCase())
            .includes(String(k).toLowerCase())
        )
      )
    )
      return false;
    return true;
  });
}

function splitOutsideQuotes(str, sepRegex) {
  const parts = [];
  let buf = "";
  let inQuotes = false;
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (!inQuotes && sepRegex.test(ch)) {
      if (buf.trim()) parts.push(buf.trim());
      buf = "";
    } else {
      buf += ch;
    }
  }
  if (buf.trim()) parts.push(buf.trim());
  return parts;
}

export function buildTextPredicate(query) {
  const raw = String(query || "").trim();
  if (!raw) return () => true;

  const orGroups = splitOutsideQuotes(raw, /,/)
    .map((g) => g.trim())
    .filter(Boolean)
    .map((g) =>
      splitOutsideQuotes(g, /\+/)
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean)
    )
    .filter((group) => group.length > 0);

  if (orGroups.length === 0) return () => true;

  return (item) => {
    const hay = String(item?.Text || "").toLowerCase();
    return orGroups.some((andTerms) => andTerms.every((t) => hay.includes(t)));
  };
}

export const availableDistricts = derived(
  [articles, filters],
  ([$articles, $filters]) => {
    const base = applyFilters($articles, { ...$filters, district: "" });
    const set = new Set();
    for (const a of base) {
      const r = detectRegion(a);
      const d = normalizeDistrict(a.ExtractedDistrict, r);
      if (d) set.add(d);
    }
    return Array.from(set).sort();
  }
);

export const availableGenders = derived(
  [articles, filters],
  ([$articles, $filters]) => {
    const base = applyFilters($articles, { ...$filters, gender: "" });
    const clusters = base
      .flatMap((a) =>
        Array.isArray(a.ExtractedGender) ? a.ExtractedGender : []
      )
      .map((g) => genderMap[String(g).toLowerCase()] || "Other");
    return Array.from(new Set(clusters)).filter(Boolean).sort();
  }
);

export const availableTimeClusters = derived(
  [articles, filters],
  ([$articles, $filters]) => {
    const base = applyFilters($articles, { ...$filters, timeCluster: "" });
    const set = new Set();
    base.forEach((a) =>
      (Array.isArray(a.ExtractedTime) ? a.ExtractedTime : []).forEach((t) => {
        const h = Number(String(t).split(":")[0]);
        set.add(timeCluster(h));
      })
    );
    return Array.from(set).sort();
  }
);

export const availableKeywords = derived(
  [articles, filters],
  ([$articles, $filters]) => {
    const base = applyFilters($articles, { ...$filters, keyword: "" });
    return Array.from(
      new Set(
        base
          .flatMap((a) => (Array.isArray(a.KeywordMatch) ? a.KeywordMatch : []))
          .map((k) => keywordsGroup[String(k).toLowerCase()] || String(k))
      )
    )
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, "de"));
  }
);

export const isMobile = readable(false, (set) => {
  if (!browser) return;
  set(/Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent));
});

export const recentCount = derived(isMobile, ($isMobile) =>
  $isMobile ? 50 : 350
);

export const recent = derived([articles, recentCount], ([$articles, n]) => {
  const list = Array.isArray($articles) ? $articles : [];
  const sorted = [...list].sort((a, b) => {
    const da = parseDateLoose(a.ExtractedDate || a.Date);
    const db = parseDateLoose(b.ExtractedDate || b.Date);
    if (da && db) return db - da;
    if (db) return 1;
    if (da) return -1;
    return 0;
  });
  return sorted.slice(0, n);
});

export const filtered = derived([articles, filters], ([$articles, $filters]) =>
  applyFilters($articles, $filters)
);

export const filteredTopN = derived([recent, filters], ([$recent, $filters]) =>
  applyFilters($recent, $filters)
);

export const filteredData = derived([recent, filters], ([$recent, $filters]) =>
  applyFilters($recent, $filters)
);

export const record = writable(false);

export const availableGendersLabeled = derived(
  [availableGenders, lang],
  ([$availableGenders, $lang]) =>
    $availableGenders.map((v) => ({
      value: v,
      label: GENDER_LABELS[$lang]?.[v] ?? v,
    }))
);

export const availableTimeClustersLabeled = derived(
  [availableTimeClusters, lang],
  ([$availableTimeClusters, $lang]) =>
    $availableTimeClusters.map((v) => ({
      value: v,
      label: TIME_LABELS[$lang]?.[v] ?? v,
    }))
);

export const availableKeywordsLabeled = derived(
  [availableKeywords, lang],
  ([$availableKeywords, $lang]) =>
    $availableKeywords.map((canon) => ({
      value: canon,
      label: KEYWORD_LABELS[canon]?.[$lang] ?? canon,
    }))
);

function applyFilters(list, f) {
  const {
    district = "",
    keyword = "",
    gender = "",
    timeCluster: timeClusterFilter = "",
    text = "",
    showOnlyLatest = false,
    region = "",
    yearMin = null,
    yearMax = null,
    dateMin = null,
    dateMax = null,
  } = f || {};

  let out = Array.isArray(list) ? list : [];

  if (region) out = out.filter((a) => detectRegion(a) === region);

  if (district) {
    out = out.filter(
      (a) =>
        normalizeDistrict(a.ExtractedDistrict, detectRegion(a)) === district
    );
  }

  if (keyword) {
    const variants = getKeywordVariants(keyword).map((s) =>
      String(s).toLowerCase()
    );
    out = out.filter(
      (a) =>
        Array.isArray(a.KeywordMatch) &&
        a.KeywordMatch.some((k) => variants.includes(String(k).toLowerCase()))
    );
  }

  if (text) {
    const test = buildTextPredicate(text);
    out = out.filter((a) => test(a));
  }

  if (gender) {
    out = out.filter((a) => {
      const gs = Array.isArray(a.ExtractedGender) ? a.ExtractedGender : [];
      const mapped = gs.map(
        (g) => genderMap[String(g).toLowerCase()] || "Other"
      );
      return mapped.includes(gender);
    });
  }

  if (timeClusterFilter) {
    out = out.filter((a) => {
      const times = Array.isArray(a.ExtractedTime) ? a.ExtractedTime : [];
      return times.some((t) => {
        const h = Number(String(t).split(":")[0]);
        return timeCluster(h) === timeClusterFilter;
      });
    });
  }

  const parsedDateMin = dateMin ? parseDateLoose(dateMin) : null;
  const parsedDateMax = dateMax ? parseDateLoose(dateMax) : null;
  const hasYearMin = yearMin != null && Number.isFinite(Number(yearMin));
  const hasYearMax = yearMax != null && Number.isFinite(Number(yearMax));

  const startDate =
    parsedDateMin && !isNaN(+parsedDateMin)
      ? parsedDateMin
      : hasYearMin
      ? new Date(Number(yearMin), 0, 1)
      : null;
  const endDate =
    parsedDateMax && !isNaN(+parsedDateMax)
      ? parsedDateMax
      : hasYearMax
      ? new Date(Number(yearMax), 11, 31, 23, 59, 59, 999)
      : null;

  if (startDate || endDate) {
    out = out.filter((a) => {
      const d = parseDateLoose(a.ExtractedDate || a.Date);
      if (!d) return false;
      if (startDate && d < startDate) return false;
      if (endDate && d > endDate) return false;
      return true;
    });
  }

  if (showOnlyLatest) {
    const sorted = [...out].sort((a, b) => {
      const da = parseDateLoose(a.ExtractedDate || a.Date);
      const db = parseDateLoose(b.ExtractedDate || b.Date);
      if (da && db) return db - da;
      if (db) return 1;
      if (da) return -1;
      return 0;
    });
    return sorted.length ? [sorted[0]] : [];
  }

  return out;
}

export const availableRegions = derived(articles, ($articles) => {
  const set = new Set(
    (Array.isArray($articles) ? $articles : [])
      .map(detectRegion)
      .filter(Boolean)
  );
  return Array.from(set).sort();
});
