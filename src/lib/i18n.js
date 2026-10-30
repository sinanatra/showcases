import { writable, derived } from "svelte/store";
import { browser } from "$app/environment";

const storage = "site.lang";
const fallback = "en";
export const availableLangs = ["en", "de"];

function detectInitialLang() {
  if (!browser) return fallback;
  const saved = localStorage.getItem(storage);
  if (saved && availableLangs.includes(saved)) return saved;
  if (navigator.language?.toLowerCase().startsWith("de")) return "de";
  return fallback;
}

export const lang = writable(detectInitialLang());

if (browser) {
  lang.subscribe((l) => {
    try {
      localStorage.setItem(storage, l);
    } catch {}
    document.documentElement.setAttribute("lang", l);
  });
}

const dict = {
  en: {
    subtitle: "Recoding political violence",
    sub: "This website automatically monitors police reports from Berlin and Brandenburg and updates the dataset daily.",

    last: "Latest Incidents",
    timeline: "All Incidents",

    de: "DE",
    en: "EN",

    controls_onlyLatest: "only the latest.",
    controls_filter: "Filter by:",

    summary_l1_mid: "police reports currently visible from",
    summary_l1_to: "to",

    summary_l2_prefix: "Drawn from the most recent",
    summary_l2_incidents: "incidents,",
    summary_l2_within: "within a dataset of",
    summary_l2_cases: "cases.",
    summary_l2_span_open: "(spanning from",
    summary_l2_to: "to",
    summary_l2_span_close: ")",

    "filters.region": "State:",
    "filters.district": "County/District:",
    "filters.keyword": "Keyword:",
    "filters.year": "Year:",
    "filters.search": "Search:",
    "filters.toggle": "Filters",
    "filters.searchPlaceholder": "type to filter…",
    "filters.all": "All",

    "reports.title": "",
    "reports.intro": "{n} reports on politically motivated crime, published by the police in Berlin and Brandenburg since {year}. Each sheet in this pile is one report, sorted by date.",
    "reports.how": " Scroll down to explore.",

    "cat.region": "Region",
  },

  de: {
    subtitle: "Recoding political violence",
    sub: "Diese Website überwacht Polizeimeldungen aus Berlin und Brandenburg automatisch und aktualisiert die Daten täglich.",

    last: "Neueste",
    timeline: "Zeitleiste",

    de: "DE",
    en: "EN",

    controls_onlyLatest: "nur die neueste.",

    controls_filter: "Filtern nach:",

    summary_l1_mid: "Polizeimeldungen aktuell sichtbar von",
    summary_l1_to: "bis",

    summary_l2_prefix: "Aus den jüngsten",
    summary_l2_incidents: "Vorfällen,",
    summary_l2_within: "innerhalb eines Datensatzes von",
    summary_l2_cases: "Fällen.",
    summary_l2_span_open: "(Zeitraum von",
    summary_l2_to: "bis",
    summary_l2_span_close: ")",

    "filters.region": "Bundesland:",
    "filters.district": "Landkreis/Bezirk:",
    "filters.keyword": "Schlagwort:",
    "filters.year": "Jahr:",
    "filters.search": "Suche:",
    "filters.toggle": "Filter",
    "filters.searchPlaceholder": "zum Filtern tippen…",
    "filters.all": "Alle",

    "reports.title": "",
    "reports.intro": "{n} Meldungen zu politisch motivierter Kriminalität, veröffentlicht von der Polizei in Berlin und Brandenburg seit {year}. Jedes Blatt in diesem Stapel ist eine Meldung, sortiert nach Datum.",
    "reports.how": " Scrollen Sie nach unten, um zu erkunden.",

    "cat.region": "Region",

  },
};

export const t = derived(
  lang,
  ($lang) => (key) => dict[$lang]?.[key] ?? dict[fallback]?.[key] ?? key
);

export const tn = derived(lang, ($lang) => (base, count) => {
  const form = Math.abs(count) === 1 ? "one" : "other";
  return (
    dict[$lang]?.[`${base}_${form}`] ??
    dict[fallback]?.[`${base}_${form}`] ??
    base
  );
});

export function setLang(code) {
  if (availableLangs.includes(code)) lang.set(code);
}
