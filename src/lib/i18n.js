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
      "This project automatically monitors police reports from Berlin and Brandenburg, highlighting and visualizing every new act of right-wing, xenophobic, or hate-motivated violence.",
    enter: "Enter",
    de: "DE",
    en: "EN",

    // Controls
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
      "Dieses Projekt überwacht automatisch Polizeimeldungen aus Berlin und Brandenburg, hebt jede neue rechtsextreme, fremdenfeindliche oder hassmotivierte Tat hervor und visualisiert sie.",
    enter: "Weiter",
    de: "DE",
    en: "EN",

    // Controls
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
