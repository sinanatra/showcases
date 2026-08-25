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
    showcases: "Showcases",
    subtitle: "Recoding political violence",
    description:
      "Showcases is a data-driven investigation that visualizes police reports on politically motivated crime, highlighting the growing normalization of racist and queerphobic violence, as well as right-wing extremism in Berlin and Brandenburg.",
    sub: "This website automatically monitors police reports from Berlin and Brandenburg and updates the dataset daily.",

    last: "Latest Incidents",
    timeline: "All Incidents",

    de: "DE",
    en: "EN",

    controls_showingLast: "Showing the last",
    controls_onlyLatest: "only the latest.",
    controls_filter: "Filter by:",
    controls_textPlaceholder: "Text…",
    controls_any: "any",

    summary_l1_mid: "police reports currently visible from",
    summary_l1_to: "to",

    summary_l2_prefix: "Drawn from the most recent",
    summary_l2_incidents: "incidents,",
    summary_l2_within: "within a dataset of",
    summary_l2_cases: "cases.",
    summary_l2_span_open: "(spanning from",
    summary_l2_to: "to",
    summary_l2_span_close: ")",
    summary_l2_see: "See the",
    summary_l2_link: "timeline",
    summary_l2_for: "for earlier records.",

    "filters.title": "Filters",
    "filters.region": "State:",
    "filters.district": "County/District:",
    "filters.keyword": "Keyword:",
    "filters.gender": "Gender:",
    "filters.timeOfDay": "Time of Day:",
    "filters.dateRange": "Date range:",
    "filters.dateStart": "Start date",
    "filters.dateEnd": "End date",
    "filters.yearRange": "Period:",
    "filters.yearStart": "Start year",
    "filters.yearEnd": "End year",
    "filters.reset": "Reset",
    "filters.search": "Search:",
    "filters.searchPlaceholder": "type to filter…",
    "filters.all": "All",

    "cat.categories": "Categories",
    "cat.region": "Region",
    "cat.berlinOnly": "Berlin only",
    "cat.brandenburgOnly": "Brandenburg only",
    "cat.berlinBrandenburg": "Berlin + Brandenburg",
    "cat.display": "Display",
    "cat.displayTitle": "title",
    "cat.displaySnippet": "snippet",
    "cat.order": "Order",
    "cat.orderNewest": "new → old",
    "cat.orderOldest": "old → new",
    "cat.addCategory": "+ Add category",
    "cat.name": "Name",
    "cat.queryPlaceholder": 'Query: "term1,term2" (,=OR +=AND)',
    "cat.queryHint": "Query (,=OR  +=AND)",
    "cat.freeText": "Free text",
    "cat.canonicalKeyword": "Canonical keyword",
    "cat.descriptionOptional": "Description (optional)",
    "cat.add": "Add",
    "cat.save": "Save",
    "cat.cancel": "Cancel",
    "cat.loading": "Loading…",
  },

  de: {
    showcases: "Showcases",
    subtitle: "Recoding political violence",
    description:
      "Showcases ist eine datengetriebene Recherche, die Polizeimeldungen zu politisch motivierter Kriminalität visualisiert und die zunehmende Normalisierung von fremdenfeindlicher, trans- und homofeindlicher Gewalt sowie von Rechtsextremismus in Deutschland sichtbar macht.",
    sub: "Diese Website überwacht Polizeimeldungen aus Berlin und Brandenburg automatisch und aktualisiert die Daten täglich.",

    last: "Neueste",
    timeline: "Zeitleiste",

    de: "DE",
    en: "EN",

    controls_onlyLatest: "nur die neueste.",
    tooltip_open_link: "Drücke <kbd>Leertaste</kbd>, um den Link zu öffnen",

    controls_any: "beliebig",
    controls_filter: "Filtern nach:",

    controls_results: "Ergebnisse",
    controls_of: "von",
    controls_of_all: " (von gesamt ",
    controls_filters_on: "Filter aktiv",
    controls_clear: "Zurücksetzen",
    controls_timespan: "Zeitraum",
    controls_timespan_unknown: "—",

    summary_l1_mid: "Polizeimeldungen aktuell sichtbar von",
    summary_l1_to: "bis",

    summary_l2_prefix: "Aus den jüngsten",
    summary_l2_incidents: "Vorfällen,",
    summary_l2_within: "innerhalb eines Datensatzes von",
    summary_l2_cases: "Fällen.",
    summary_l2_span_open: "(Zeitraum von",
    summary_l2_to: "bis",
    summary_l2_span_close: ")",
    summary_l2_see: "Zur",
    summary_l2_link: "Zeitleiste",
    summary_l2_for: "für frühere Einträge.",

    "filters.title": "Filter",
    "filters.region": "Bundesland:",
    "filters.district": "Landkreis/Bezirk:",
    "filters.keyword": "Schlagwort:",
    "filters.gender": "Geschlecht:",
    "filters.timeOfDay": "Tageszeit:",
    "filters.dateRange": "Datumsbereich:",
    "filters.dateStart": "Startdatum",
    "filters.dateEnd": "Enddatum",
    "filters.yearRange": "Zeitraum:",
    "filters.yearStart": "Startjahr",
    "filters.yearEnd": "Endjahr",
    "filters.reset": "Zurücksetzen",
    "filters.search": "Suche:",
    "filters.searchPlaceholder": "zum Filtern tippen…",
    "filters.all": "Alle",

    "cat.categories": "Kategorien",
    "cat.region": "Region",
    "cat.berlinOnly": "Nur Berlin",
    "cat.brandenburgOnly": "Nur Brandenburg",
    "cat.berlinBrandenburg": "Berlin + Brandenburg",
    "cat.display": "Anzeige",
    "cat.displayTitle": "Titel",
    "cat.displaySnippet": "Ausschnitt",
    "cat.order": "Reihenfolge",
    "cat.orderNewest": "neu → alt",
    "cat.orderOldest": "alt → neu",
    "cat.addCategory": "+ Kategorie hinzufügen",
    "cat.name": "Name",
    "cat.queryPlaceholder": 'Abfrage: "Begriff1,Begriff2" (,=ODER +=UND)',
    "cat.queryHint": "Abfrage (,=ODER  +=UND)",
    "cat.freeText": "Freitext",
    "cat.canonicalKeyword": "Kanonisches Schlagwort",
    "cat.descriptionOptional": "Beschreibung (optional)",
    "cat.add": "Hinzufügen",
    "cat.save": "Speichern",
    "cat.cancel": "Abbrechen",
    "cat.loading": "Laden…",

    "stats.of": "angezeigt von",
    "stats.topKeywords": "Top-Schlagworte",
    "stats.topDistricts": "Top-Bezirke",
    "stats.timeOfDay": "Tageszeit",
    "stats.genders": "Geschlechter",

    "time.morning": "Morgen",
    "time.afternoon": "Nachmittag",
    "time.evening": "Abend",
    "time.night": "Nacht",
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
