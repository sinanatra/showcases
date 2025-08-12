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
    subtitle: "Recoding Right-Wing Extremism",
    description:
      "Showcases is a data-driven investigation that visualizes police reports on politically motivated crime, highlighting the growing normalization of xenophobic, transphobic and homophobic violence, as well as right-wing extremism in Germany.",
    sub: "This website automatically monitors police reports from Berlin and Brandenburg and updates the dataset daily.",

    enter: "Enter",
    last: "Latest Incidents",
    timeline: "Overview",
    methodology: "Methodology",
    de: "DE",
    en: "EN",

    controls_showingLast: "Showing the last",
    controls_report_one: "police report",
    controls_report_other: "police reports",
    controls_mentioning: "mentioning:",
    controls_any: "any",
    controls_containing: ", containing",
    controls_textPlaceholder: "text…",
    controls_or: ", or",
    controls_onlyLatest: "only the latest.",
  },
  de: {
    showcases: "Showcases",
    subtitle: "Recoding Right-Wing Extremism",
    description:
      "Showcases ist eine datengetriebene Recherche, die Polizeimeldungen zu politisch motivierter Kriminalität visualisiert und die zunehmende Normalisierung von fremdenfeindlicher, trans- und homofeindlicher Gewalt sowie von Rechtsextremismus in Deutschland sichtbar macht. ",
    sub: "Diese Website überwacht Polizeimeldungen aus Berlin und Brandenburg automatisch und aktualisiert die Daten täglich.",

    enter: "Weiter",
    last: "Neueste",
    timeline: "Zeitleiste",
    methodology: "Methodik",
    de: "DE",
    en: "EN",

    controls_showingLast: "Zeige die letzten",
    controls_report_one: "Polizeimeldung",
    controls_report_other: "Polizeimeldungen",
    controls_mentioning: "mit Erwähnung:",
    controls_any: "beliebig",
    controls_containing: ", mit",
    controls_textPlaceholder: "Text…",
    controls_or: ", oder",
    controls_onlyLatest: "nur die neuesten.",
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
