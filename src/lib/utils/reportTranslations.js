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
    // translations.json: older snippet-only translations, used until the backlog is translated.
    const legacy = await fetch("/translations.json").then((r) => (r.ok ? r.json() : {}), () => ({}));
    return Object.assign({}, legacy, ...parts);
  })().catch(() => ({}));
  return loading;
}

/** A whole report text in English; sentences not translated yet stay German. */
export function translateText(/** @type {string} */ text, /** @type {Record<string,string>} */ map) {
  return splitSentences(text)
    .map((s) => map[s] ?? s)
    .join(" ");
}

/** English of the sentence that contains `term` (or of the first sentence), "" if not translated. */
export function translateSentenceWith(
  /** @type {string} */ text,
  /** @type {string} */ term,
  /** @type {Record<string,string>} */ map,
) {
  const sentences = splitSentences(text);
  const needle = String(term || "").toLowerCase();
  const sentence = (needle && sentences.find((s) => s.toLowerCase().includes(needle))) || sentences[0];
  return (sentence && map[sentence]) || "";
}
