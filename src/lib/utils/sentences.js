export function stripBoilerplate(raw) {
  return raw
    .replace(/\nPolizei Berlin\nPressearbeit[\s\S]*/i, "")
    .replace(/^Nr\.\s*\d+\s*[\n\r]+/i, "")
    // "•" is reserved as the DE/EN separator in the "both" language display —
    // strip any that appear in the source Meldung text so it can't collide.
    .replace(/•/g, "")
    .trim();
}

const MONTH_NEXT = /^\s+(Januar|Februar|März|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember)\b/;

// Sentence boundary:
// - a line break, unless the next line starts in lower case or this one ends
//   in "," / ";" (a sentence the source wrapped, or a list that continues it);
// - "." only if followed by space + uppercase letter (avoids false breaks on
//   "Nr.", "ca.", "Str.", etc.) and not a date like "24. September".
export function isSentBoundary(text, i) {
  const ch = text[i];
  if (ch === "!" || ch === "?") return true;
  if (ch === "\n") {
    const next = /^\s*(\S)/.exec(text.slice(i + 1, i + 40));
    if (next && /[a-zäöüß]/.test(next[1])) return false;
    // a line ending in "," or ";" carries on in the next one
    return !/[,;]\s*$/.test(text.slice(Math.max(0, i - 3), i));
  }
  if (ch !== ".") return false;
  const rest = text.slice(i + 1, i + 20);
  if (/\d/.test(text[i - 1] ?? "") && MONTH_NEXT.test(rest)) return false;
  return /^\s+[A-ZÄÖÜ]/.test(rest) || text.slice(i + 1).trimStart() === "";
}

/**
 * Every sentence of a report, cut exactly the way snippets are — these are the
 * units pipeline/translate.mjs translates, so any snippet a
 * category can pick already has its English in static/translations/.
 */
export function splitSentences(raw) {
  const clean = stripBoilerplate(String(raw || ""));
  const out = [];
  let start = 0;
  for (let i = 0; i <= clean.length; i++) {
    if (i < clean.length && !isSentBoundary(clean, i)) continue;
    const sentence = clean.slice(start, i + 1).trim().replace(/\s+/g, " ");
    if (sentence) out.push(sentence);
    start = i + 1;
  }
  return out;
}
