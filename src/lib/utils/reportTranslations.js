import { splitSentences } from "./sentences.js";

/** @type {Promise<Record<string,string>>|null} */
let loading = null;

/**
 * German -> English for every title and sentence in the dataset, precomputed by
 * pipeline/translate.mjs into static/translations/<year>.json.
 * @returns {Promise<Record<string,string>>}
 */
export function loadReportTranslations() {
  loading ??= (async () => {
    const years = await (await fetch("/translations/index.json")).json();
    const parts = await Promise.all(
      years.map((/** @type {string} */ y) =>
        fetch(`/translations/${y}.json`).then((r) => (r.ok ? r.json() : {}), () => ({})),
      ),
    );
    loaded = Object.assign({}, ...parts);
    return loaded;
  })().catch(() => ({}));
  return loading;
}

/** @type {Record<string,string>|null} */
let loaded = null;
const englishCache = new WeakMap();

/** Headline + text of a report in English, lower-cased, for searching. "" until the translations are loaded. */
export function englishText(/** @type {any} */ a) {
  if (!loaded || !a) return "";
  let text = englishCache.get(a);
  if (text === undefined) {
    text = `${loaded[(a.Title || "").trim()] ?? ""} ${translateText(a.Text || "", loaded)}`.toLowerCase();
    englishCache.set(a, text);
  }
  return text;
}

/** A whole report text in English; sentences not translated yet stay German. */
export function translateText(/** @type {string} */ text, /** @type {Record<string,string>} */ map) {
  return splitSentences(text)
    .map((s) => map[s] ?? s)
    .join(" ");
}

