// Everything here is derived from /categories.json — edit categories there.
import data from "../../../categories.json" with { type: "json" };

// "categories" define the dataset (their terms are searched in every scraped
// report); "commentary" entries are searched only within the dataset.
const datasetCategories = data.categories;

/** where along a timeline box its gradient reaches colorEnd, in percent */
export const GRADIENT_END_AT = data.gradientEndAt ?? 50;

// Shape the timeline / map views work with.
export const CATEGORIES = [
  ...datasetCategories.map((c) => ({
    ...c,
    keyword: c.id,
    type: c.highlight ? "text" : "canonical",
  })),
  ...data.commentary.map((c) => ({ ...c, type: "text", query: (c.terms ?? []).join(",") })),
];

// Every value KeywordMatch can hold (a matched term or the category id) -> category id.
export const keywordsGroup = Object.fromEntries(
  datasetCategories.flatMap((c) =>
    [...c.terms, c.id].map((k) => [k.toLowerCase(), c.id]),
  ),
);

export const canonicalKeywords = datasetCategories.map((c) => c.id);

export const KEYWORD_LABELS = Object.fromEntries(
  datasetCategories.map((c) => [c.id, { en: c.label, de: c.labelDe ?? c.label }]),
);

export function getKeywordVariants(canon) {
  if (!canon) return [];
  const variants = Object.entries(keywordsGroup)
    .filter(([, mapped]) => mapped === canon)
    .map(([variant]) => variant);
  return Array.from(new Set([...variants, canon]));
}

const escapeRe = (/** @type {string} */ s) =>
  s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const NOT_IN_WORD_BEFORE = "(?<![\\p{L}\\p{N}_])";

function stemRegex(/** @type {string[]} */ stems) {
  if (!stems?.length) return null;
  return new RegExp(
    `${NOT_IN_WORD_BEFORE}(?:${stems.map((s) => escapeRe(s.toLowerCase())).join("|")})`,
    "u",
  );
}

// Same matching pipeline/filter.py does, so a term added to categories.json
// shows up on reports already in the dataset before the pipeline has re-run
// (and on older data files that still carry outdated KeywordMatch values).
const AUGMENT_RULES = datasetCategories.map((c) => ({
  canon: c.id,
  terms: stemRegex(c.terms),
}));

function groupIncludes(
  /** @type {string[]} */ kws,
  /** @type {string} */ canon,
) {
  return kws.some(
    (k) =>
      (keywordsGroup[
        /** @type {keyof typeof keywordsGroup} */ (
          String(k || "").toLowerCase()
        )
      ] || "") === canon,
  );
}

export function augmentKeywordMatch(
  /** @type {string[]} */ keywordMatch,
  /** @type {string} */ text,
) {
  const kws = Array.isArray(keywordMatch) ? [...keywordMatch] : [];
  const hay = String(text || "").toLowerCase();

  for (const rule of AUGMENT_RULES) {
    if (groupIncludes(kws, rule.canon)) continue;

    if (rule.terms?.test(hay)) kws.push(rule.canon);
  }

  return Array.from(new Set(kws)).filter(Boolean);
}
