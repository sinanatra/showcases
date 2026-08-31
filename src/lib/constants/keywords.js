export const keywordsGroup = {
  // Current analysis.py `keywords` stems (what KeywordMatch actually contains
  // after a rescore) plus the older full-word variants, kept for data scored
  // before the stem-based matching switch.
  antisem: "antisemitismus",
  antisemit: "antisemitismus",
  "anti-semit": "antisemitismus",
  "anti semit": "antisemitismus",
  antisemitisch: "antisemitismus",
  antisemitismus: "antisemitismus",
  judenfeind: "antisemitismus",

  islamophobie: "islamfeindlichkeit",
  islamfeindlichkeit: "islamfeindlichkeit",
  islamfeindlich: "islamfeindlichkeit",
  islamfeind: "islamfeindlichkeit",
  islamophobia: "islamfeindlichkeit",
  islamophob: "islamfeindlichkeit",
  islamophobe: "islamfeindlichkeit",
  islamophoben: "islamfeindlichkeit",
  muslimfeindlich: "islamfeindlichkeit",
  muslimfeindlichkeit: "islamfeindlichkeit",
  muslimfeind: "islamfeindlichkeit",
  antimuslimisch: "islamfeindlichkeit",
  antimuslim: "islamfeindlichkeit",
  "anti-muslimisch": "islamfeindlichkeit",
  "anti muslimisch": "islamfeindlichkeit",
  "anti muslim": "islamfeindlichkeit",
  antiislamisch: "islamfeindlichkeit",
  antiislam: "islamfeindlichkeit",
  "anti-islamisch": "islamfeindlichkeit",
  "anti islamisch": "islamfeindlichkeit",
  "anti-islam": "islamfeindlichkeit",
  "anti islam": "islamfeindlichkeit",

  rassistisch: "fremdenfeindlichkeit",
  rassismus: "fremdenfeindlichkeit",
  rassis: "fremdenfeindlichkeit",
  fremdenfeindlich: "fremdenfeindlichkeit",
  fremdenfeindlichkeit: "fremdenfeindlichkeit",
  fremdenfeind: "fremdenfeindlichkeit",
  hautfarbe: "fremdenfeindlichkeit",

  rechtsextremisch: "rechtsextremismus",
  rechtsextremistisch: "rechtsextremismus",
  rechtsextrem: "rechtsextremismus",
  rechtsextremismus: "rechtsextremismus",
  hakenkreuz: "rechtsextremismus",
  hitlergruß: "rechtsextremismus",
  "sieg heil": "rechtsextremismus",
  "heil hitler": "rechtsextremismus",
  nazi: "rechtsextremismus",
  nationalsozialismus: "rechtsextremismus",
  nationalsozialistisch: "rechtsextremismus",
  nationalsozialistische: "rechtsextremismus",
  nationalsozial: "rechtsextremismus",

  verfassungswidrig: "rechtsextremismus",
  "mit politischem hintergrund": "rechtsextremismus",

  homophob: "queerfeindlichkeit",
  homophobie: "queerfeindlichkeit",
  queerfeindlichkeit: "queerfeindlichkeit",
  queerfeindlich: "queerfeindlichkeit",
  queerfeind: "queerfeindlichkeit",
  queerphobie: "queerfeindlichkeit",
  queerphobia: "queerfeindlichkeit",
  queerphob: "queerfeindlichkeit",
  transphobie: "queerfeindlichkeit",
  transphob: "queerfeindlichkeit",
  transfeind: "queerfeindlichkeit",

  volksverhetzung: "volksverhetzung",
  volksverhetz: "volksverhetzung",

  frauenfeindlich: "frauenfeindlichkeit",
  frauenfeindlichkeit: "frauenfeindlichkeit",
  frauenfeind: "frauenfeindlichkeit",
  sexistisch: "frauenfeindlichkeit",
  sexismus: "frauenfeindlichkeit",
  sexist: "frauenfeindlichkeit",
  misogyn: "frauenfeindlichkeit",
  misogynie: "frauenfeindlichkeit",
  frauenhass: "frauenfeindlichkeit",
  antifeminismus: "frauenfeindlichkeit",
  antifeministisch: "frauenfeindlichkeit",
  antifem: "frauenfeindlichkeit",
  "anti-fem": "frauenfeindlichkeit",

  behindertenfeindlich: "behindertenfeindlichkeit",
  behindertenfeindlichkeit: "behindertenfeindlichkeit",
  behindertenfeind: "behindertenfeindlichkeit",
  "körperliche behind": "behindertenfeindlichkeit",
  "geistige behind": "behindertenfeindlichkeit",
  "physische behind": "behindertenfeindlichkeit",
  "psychische behind": "behindertenfeindlichkeit",
  "körperliche beein": "behindertenfeindlichkeit",
  "geistige beein": "behindertenfeindlichkeit",
  "physische beein": "behindertenfeindlichkeit",
  "psychische beein": "behindertenfeindlichkeit",
};

export const canonicalKeywords = [
  "antisemitismus",
  "islamfeindlichkeit",
  "fremdenfeindlichkeit",
  "rechtsextremismus",
  "volksverhetzung",
  "queerfeindlichkeit",
  "frauenfeindlichkeit",
  "behindertenfeindlichkeit",
];

export const KEYWORD_LABELS = {
  antisemitismus: { en: "Antisemitism", de: "Antisemitismus" },
  islamfeindlichkeit: { en: "Anti-Muslim bigotry", de: "Islamfeindlichkeit" },
  fremdenfeindlichkeit: { en: "Xenophobia/Racism", de: "Fremdenfeindlichkeit" },
  rechtsextremismus: { en: "Right-wing extremism", de: "Rechtsextremismus" },
  volksverhetzung: { en: "Incitement of the people", de: "Volksverhetzung" },
  queerfeindlichkeit: { en: "Anti-queer (LGBTQ*)", de: "Queerfeindlichkeit" },
  frauenfeindlichkeit: { en: "Misogyny", de: "Frauenfeindlichkeit" },
  behindertenfeindlichkeit: { en: "Ableism", de: "Behindertenfeindlichkeit" },
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
    // "fremdenfeind" and "beleidig" are too generic to use here: the former
    // is literally the Xenophobia category's own tag (using it as evidence
    // for a *different, more specific* category is circular), and the
    // latter ("insulted") appears in nearly every hate-crime report — either
    // one alone would auto-promote almost any headscarf mention to
    // Islamophobia even with zero actual religious framing.
    hateContext: /\b(rassist|volksverhetz|hass)\w*\b/,
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
