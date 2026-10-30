import { escapeRe } from "$lib/utils/textUtils.js";

export function highlightTerms(text, terms) {
  if (!text || !Array.isArray(terms) || !terms.length) return text;
  const re = new RegExp(
    terms
      .filter(Boolean)
      .sort((a, b) => b.length - a.length)
      .map(escapeRe)
      .join("|"),
    "gi"
  );
  return text.replace(re, (match) => `<span class="highlight">${match}</span>`);
}
