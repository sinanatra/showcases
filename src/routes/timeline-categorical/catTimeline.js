import { keywordsGroup } from "$lib/constants/keywords";
import { CHAR_W, LINE_H, SNIP_MAX } from "./config.js";

// ── text wrapping ─────────────────────────────────────────────
export function wrapText(text, maxChars) {
  const words = text.split(" ");
  const lines = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? line + " " + word : word;
    if (candidate.length > maxChars && line) {
      lines.push(line);
      line = word;
    } else line = candidate;
  }
  if (line) lines.push(line);
  return lines;
}

// word-boundary characters that end a token
const WORD_END = /[\s,;:.!?()[\]"'…–—/\\]/;

export function matchInText(text, terms) {
  const lower = text.toLowerCase();
  for (const term of terms) {
    const idx = lower.indexOf(term.toLowerCase());
    if (idx === -1) continue;
    // extend to full word (catches "-isch", "-en", "-e" suffixes, German umlauts, etc.)
    let end = idx + term.length;
    while (end < text.length && !WORD_END.test(text[end])) end++;
    return { idx, pre: text.slice(0, idx), kw: text.slice(idx, end), post: text.slice(end) };
  }
  return null;
}

export function matchesCategory(a, cat) {
  if (cat.type === "canonical") {
    const kws = Array.isArray(a.KeywordMatch) ? a.KeywordMatch : [];
    return kws.some(
      (k) =>
        /** @type {any} */ (keywordsGroup)[String(k).toLowerCase()] ===
        cat.query,
    );
  }
  const hay = `${a.Title || ""} ${a.Text || ""}`.toLowerCase();
  return cat.query
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
    .some((term) =>
      term
        .split("+")
        .map((s) => s.trim())
        .every((t) => hay.includes(t)),
    );
}

export function placeItems(preItems, xScale, labelFn) {
  const sorted = [...preItems].sort((a, b) =>
    a.desiredRow !== b.desiredRow
      ? a.desiredRow - b.desiredRow
      : +a.date - +b.date,
  );
  const GAP = 6;
  const rowEndX = new Map();
  return sorted.map((it) => {
    const label = labelFn(it);
    const x = xScale(it.date);
    const hw = Math.ceil(label.length * CHAR_W) / 2;
    const xStart = x - hw - GAP;
    const xEnd = x + hw + GAP;
    let row = it.desiredRow ?? 0;
    while ((rowEndX.get(row) ?? -Infinity) > xStart) row++;
    rowEndX.set(row, xEnd);
    return { ...it, x, y: row * LINE_H, label };
  });
}

export function snippetFor(item, categories) {
  const cat = categories.find((c) => c.id === item.catId);
  const raw = item.text || item.title || "";
  if (!raw) return "";
  if (!cat) return raw.slice(0, SNIP_MAX) + (raw.length > SNIP_MAX ? "…" : "");

  let terms;
  if (cat.type === "canonical") {
    const kws = Array.isArray(item.raw?.KeywordMatch) ? item.raw.KeywordMatch : [];
    terms = kws
      .filter((k) => /** @type {any} */ (keywordsGroup)[String(k).toLowerCase()] === cat.query)
      .map((k) => String(k));
    if (!terms.length) terms = [cat.query];
  } else {
    terms = cat.query
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .flatMap((t) => t.split("+").map((s) => s.trim()));
  }

  const lower = raw.toLowerCase();
  let pos = -1;

  // German suffix stripping: noun forms → stem shared with adjective/inflected forms
  const SUFFIXES = ["keit", "heit", "schaft", "ismus", "ierung", "ung", "lich", "isch", "en", "em", "er", "es", "e", "n", "s"];
  function stems(term) {
    const t = term.toLowerCase();
    const out = [t];
    for (const s of SUFFIXES) {
      if (t.endsWith(s) && t.length - s.length >= 6) out.push(t.slice(0, t.length - s.length));
    }
    return out;
  }

  outer: for (const term of terms) {
    for (const stem of stems(term)) {
      const idx = lower.indexOf(stem);
      if (idx !== -1) { pos = idx; break outer; }
    }
  }
  if (pos === -1) return item.title || raw.slice(0, SNIP_MAX) + (raw.length > SNIP_MAX ? "…" : "");

  // Find the sentence containing pos (bounded by . ! ? or newline)
  let sentStart = pos;
  while (sentStart > 0 && !/[.!?\n]/.test(raw[sentStart - 1])) sentStart--;
  while (sentStart < pos && raw[sentStart] === " ") sentStart++;

  let sentEnd = pos;
  while (sentEnd < raw.length && !/[.!?\n]/.test(raw[sentEnd])) sentEnd++;
  if (sentEnd < raw.length) sentEnd++; // include punctuation

  const sentence = raw.slice(sentStart, sentEnd).trim();
  if (sentence.length <= SNIP_MAX) return sentence;
  // Sentence too long: fall back to window centered on keyword
  const half = Math.floor(SNIP_MAX / 2);
  const s = Math.max(sentStart, pos - half);
  const e = Math.min(sentEnd, pos + half);
  return (s > sentStart ? "…" : "") + raw.slice(s, e).trim() + (e < sentEnd ? "…" : "");
}
