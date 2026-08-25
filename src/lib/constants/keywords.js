export const keywordsGroup = {
  antisem: "antisemitismus",
  antisemitisch: "antisemitismus",
  antisemitismus: "antisemitismus",

  islamophobie: "islamfeindlichkeit",
  islamfeindlichkeit: "islamfeindlichkeit",
  islamfeindlich: "islamfeindlichkeit",
  islamophobia: "islamfeindlichkeit",
  islamophob: "islamfeindlichkeit",
  islamophobe: "islamfeindlichkeit",
  islamophoben: "islamfeindlichkeit",
  muslimfeindlich: "islamfeindlichkeit",
  muslimfeindlichkeit: "islamfeindlichkeit",
  antimuslimisch: "islamfeindlichkeit",
  "anti-muslimisch": "islamfeindlichkeit",
  "anti muslimisch": "islamfeindlichkeit",
  antiislamisch: "islamfeindlichkeit",
  "anti-islamisch": "islamfeindlichkeit",
  "anti islamisch": "islamfeindlichkeit",

  rassistisch: "fremdenfeindlichkeit",
  rassismus: "fremdenfeindlichkeit",
  fremdenfeindlich: "fremdenfeindlichkeit",
  fremdenfeindlichkeit: "fremdenfeindlichkeit",

  rechtsextremisch: "rechtsextremismus",
  rechtsextremistisch: "rechtsextremismus",
  rechtsextremismus: "rechtsextremismus",
  hakenkreuz: "rechtsextremismus",
  hitlergruß: "rechtsextremismus",
  "sieg heil": "rechtsextremismus",
  nazi: "rechtsextremismus",
  nationalsozialismus: "rechtsextremismus",
  nationalsozialistisch: "rechtsextremismus",
  nationalsozialistische: "rechtsextremismus",

  verfassungswidrig: "rechtsextremismus",
  "mit politischem hintergrund": "rechtsextremismus",

  homophob: "queerfeindlichkeit",
  homophobie: "queerfeindlichkeit",
  queerfeindlichkeit: "queerfeindlichkeit",
  queerfeindlich: "queerfeindlichkeit",
  queerphobie: "queerfeindlichkeit",
  queerphobia: "queerfeindlichkeit",
  transphobie: "queerfeindlichkeit",
  transphob: "queerfeindlichkeit",

  volksverhetzung: "volksverhetzung",

  frauenfeindlich: "frauenfeindlichkeit",
  frauenfeindlichkeit: "frauenfeindlichkeit",
  sexistisch: "frauenfeindlichkeit",
  sexismus: "frauenfeindlichkeit",
  misogyn: "frauenfeindlichkeit",
  misogynie: "frauenfeindlichkeit",
};

export const canonicalKeywords = [
  "antisemitismus",
  "islamfeindlichkeit",
  "fremdenfeindlichkeit",
  "rechtsextremismus",
  "volksverhetzung",
  "queerfeindlichkeit",
  "frauenfeindlichkeit",
];

export const KEYWORD_LABELS = {
  antisemitismus: { en: "Antisemitism", de: "Antisemitismus" },
  islamfeindlichkeit: { en: "Anti-Muslim bigotry", de: "Islamfeindlichkeit" },
  fremdenfeindlichkeit: { en: "Xenophobia/Racism", de: "Fremdenfeindlichkeit" },
  rechtsextremismus: { en: "Right-wing extremism", de: "Rechtsextremismus" },
  volksverhetzung: { en: "Incitement of the people", de: "Volksverhetzung" },
  queerfeindlichkeit: { en: "Anti-queer (LGBTQ*)", de: "Queerfeindlichkeit" },
  frauenfeindlichkeit: { en: "Misogyny", de: "Frauenfeindlichkeit" },
};

export function getKeywordVariants(canon) {
  if (!canon) return [];
  const variants = Object.entries(keywordsGroup)
    .filter(([, mapped]) => mapped === canon)
    .map(([variant]) => variant);
  return Array.from(new Set([...variants, canon]));
}

// A term is "context-only" when it implies a canonical category solely in
// combination with a hateful framing, not on its own (e.g. "kopftuch" alone
// is neutral; "kopftuch" + "rassistisch" reads as islamophobic).
const AUGMENT_RULES = [
  {
    canon: "islamfeindlichkeit",
    terms: /\b(islamfeind|muslimfeind|islamophob)\w*\b/,
    contextOnlyTerms: /\bkopftuch\w*\b/,
    hateContext: /\b(rassist|fremdenfeind|volksverhetz|beleidig|hass)\w*\b/,
  },
];

function groupIncludes(/** @type {string[]} */ kws, /** @type {string} */ canon) {
  return kws.some(
    (k) => (keywordsGroup[/** @type {keyof typeof keywordsGroup} */ (String(k || "").toLowerCase())] || "") === canon
  );
}

export function augmentKeywordMatch(/** @type {string[]} */ keywordMatch, /** @type {string} */ text) {
  const kws = Array.isArray(keywordMatch) ? [...keywordMatch] : [];
  const hay = String(text || "").toLowerCase();

  for (const rule of AUGMENT_RULES) {
    if (kws.includes(rule.canon)) continue;

    const hasTerm = rule.terms.test(hay) || groupIncludes(kws, rule.canon);
    const hasContextOnlyTerm = rule.contextOnlyTerms?.test(hay) ?? false;
    const hasHateContext =
      rule.hateContext.test(hay) ||
      kws.some((k) => rule.hateContext.test(String(k || "").toLowerCase()));

    if (hasTerm || (hasContextOnlyTerm && hasHateContext)) {
      kws.push(rule.canon);
    }
  }

  return Array.from(new Set(kws)).filter(Boolean);
}
