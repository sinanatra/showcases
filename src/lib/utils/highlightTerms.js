export function highlightTerms(text, terms) {
  if (!text || !Array.isArray(terms) || !terms.length) return text;
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(
    terms
      .filter(Boolean)
      .sort((a, b) => b.length - a.length)
      .map(esc)
      .join("|"),
    "gi"
  );
  return text.replace(re, (match) => `<span class="highlight">${match}</span>`);
}
