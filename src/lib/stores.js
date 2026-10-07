// Shared state of the site: the dataset, the active filters, and what they leave.
import { readable, writable, derived } from "svelte/store";
import { lang } from "$lib/i18n";
import { browser } from "$app/environment";
import { parseDateLoose } from "$lib/utils/parseDate";
import { detectRegion } from "$lib/utils/detectRegion";
import {
  keywordsGroup,
  KEYWORD_LABELS,
  getKeywordVariants,
  augmentKeywordMatch,
} from "$lib/constants/categories";
import { genderMap, GENDER_LABELS } from "$lib/constants/genders";
import { TIME_LABELS } from "$lib/constants/times";
import { normalizeDistrict } from "$lib/constants/districts";
import { englishText } from "$lib/utils/reportTranslations";

// Re-exported so pages can take everything dataset-related from one place.
export {
  parseDateLoose,
  keywordsGroup,
  getKeywordVariants,
  augmentKeywordMatch,
  genderMap,
  GENDER_LABELS,
  TIME_LABELS,
};

/** Every report of the dataset (static/all_merged.csv), filled by loadArticles(). */
export const articles = writable([]);

// ── filters ───────────────────────────────────────────────────
const filterDefaults = {
  region: "",       // "Berlin" | "Brandenburg"
  district: "",
  keyword: "",      // a category id from categories.json
  text: "",         // free text; "a,b" = either, "a+b" = both
  textLang: "",     // "en" = `text` is English and is matched against the translations
  showOnlyLatest: false,
};

export function createFilterState(overrides = {}) {
  return { ...filterDefaults, ...overrides };
}

export const filters = writable(createFilterState());

const byNewest = (a, b) => {
  const da = parseDateLoose(a.ExtractedDate || a.Date);
  const db = parseDateLoose(b.ExtractedDate || b.Date);
  if (da && db) return db - da;
  if (db) return 1;
  if (da) return -1;
  return 0;
};

/** The n newest reports of a list. */
const newest = (list, n) => [...(Array.isArray(list) ? list : [])].sort(byNewest).slice(0, n);

function splitOutsideQuotes(str, sepRegex) {
  const parts = [];
  let buf = "";
  let inQuotes = false;
  for (const ch of str) {
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (!inQuotes && sepRegex.test(ch)) {
      if (buf.trim()) parts.push(buf.trim());
      buf = "";
    } else {
      buf += ch;
    }
  }
  if (buf.trim()) parts.push(buf.trim());
  return parts;
}

/** "a,b" matches either, "a+b" needs both; quotes keep a comma or plus literal. */
function buildTextPredicate(query, textLang = "") {
  const orGroups = splitOutsideQuotes(String(query || "").trim(), /,/)
    .map((group) => splitOutsideQuotes(group, /\+/).map((term) => term.toLowerCase()))
    .filter((group) => group.length > 0);
  if (!orGroups.length) return () => true;

  return (item) => {
    const hay = textLang === "en" ? englishText(item) : String(item?.Text || "").toLowerCase();
    return orGroups.some((andTerms) => andTerms.every((term) => hay.includes(term)));
  };
}

export function applyFilters(list, f) {
  const { region, district, keyword, text, textLang, showOnlyLatest } = { ...filterDefaults, ...f };
  let out = Array.isArray(list) ? list : [];

  if (region) out = out.filter((a) => detectRegion(a) === region);

  if (district) {
    out = out.filter((a) => normalizeDistrict(a.ExtractedDistrict, detectRegion(a)) === district);
  }

  if (keyword) {
    const variants = getKeywordVariants(keyword).map((s) => String(s).toLowerCase());
    out = out.filter(
      (a) =>
        Array.isArray(a.KeywordMatch) &&
        a.KeywordMatch.some((k) => variants.includes(String(k).toLowerCase()))
    );
  }

  if (text) out = out.filter(buildTextPredicate(text, textLang));

  return showOnlyLatest ? newest(out, 1) : out;
}

/** Everything the filters leave (used by the timeline). */
export const filtered = derived([articles, filters], ([$articles, $filters]) =>
  applyFilters($articles, $filters)
);

// ── the "latest" views ────────────────────────────────────────
export const isMobile = readable(false, (set) => {
  if (!browser) return;
  set(/Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent));
});

/** How many reports the drawing shows at once. */
const recentCount = derived(isMobile, ($isMobile) => ($isMobile ? 50 : 450));

export const recent = derived([articles, recentCount], ([$articles, n]) => newest($articles, n));

// Filter first, then take the newest: a small category (or a rare search term)
// whose reports are all older than the newest few hundred would otherwise show nothing.
export const filteredData = derived(
  [articles, filters, recentCount],
  ([$articles, $filters, n]) => newest(applyFilters($articles, $filters), n)
);

/** Set while the drawing is being recorded to video. */
export const record = writable(false);

// ── options for the filter dropdowns ──────────────────────────
export const availableRegions = derived(articles, ($articles) =>
  Array.from(new Set(($articles ?? []).map(detectRegion).filter(Boolean))).sort()
);

export const availableDistricts = derived([articles, filters], ([$articles, $filters]) => {
  const set = new Set();
  for (const a of applyFilters($articles, { ...$filters, district: "" })) {
    const d = normalizeDistrict(a.ExtractedDistrict, detectRegion(a));
    if (d) set.add(d);
  }
  return Array.from(set).sort();
});

export const availableKeywordsLabeled = derived(
  [articles, filters, lang],
  ([$articles, $filters, $lang]) => {
    const present = new Set(
      applyFilters($articles, { ...$filters, keyword: "" })
        .flatMap((a) => (Array.isArray(a.KeywordMatch) ? a.KeywordMatch : []))
        .map((k) => keywordsGroup[String(k).toLowerCase()] || String(k))
        .filter(Boolean)
    );
    return [...present]
      .sort((a, b) => a.localeCompare(b, "de"))
      .map((canon) => ({ value: canon, label: KEYWORD_LABELS[canon]?.[$lang] ?? canon }));
  }
);
