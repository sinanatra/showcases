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

export function augmentKeywordMatch(keywordMatch, text) {
  const kws = Array.isArray(keywordMatch) ? [...keywordMatch] : [];
  const hay = String(text || "").toLowerCase();

  const hasIslamophobiaTerm =
    /\b(islamfeind|muslimfeind|islamophob)\w*\b/.test(hay) ||
    kws.some(
      (k) =>
        (keywordsGroup[String(k || "").toLowerCase()] || "") ===
        "islamfeindlichkeit"
    );

  const hasHeadscarfMarker = /\bkopftuch\w*\b/.test(hay);
  const hasHateContext =
    /\b(rassist|fremdenfeind|volksverhetz|beleidig|hass)\w*\b/.test(hay) ||
    kws.some((k) =>
      /\b(rassist|fremdenfeind|volksverhetz)\w*\b/.test(
        String(k || "").toLowerCase()
      )
    );

  if (
    (hasIslamophobiaTerm || (hasHeadscarfMarker && hasHateContext)) &&
    !kws.includes("islamfeindlichkeit")
  ) {
    kws.push("islamfeindlichkeit");
  }

  return Array.from(new Set(kws)).filter(Boolean);
}
