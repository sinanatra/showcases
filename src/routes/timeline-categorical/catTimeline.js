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
  const GAP = 6;

  // Pre-compute screen x and label for every item
  const withX = preItems.map((it) => ({ ...it, x: xScale(it.date), label: labelFn(it) }));

  // Assign desiredRow per category in left-to-right screen order
  const groups = new Map();
  for (const it of withX) {
    if (!groups.has(it.catId)) groups.set(it.catId, []);
    groups.get(it.catId).push(it);
  }
  const withRow = [];
  for (const items of groups.values()) {
    items.sort((a, b) => a.x - b.x);
    items.forEach((it, i) => withRow.push({ ...it, desiredRow: i }));
  }

  // Wave sort: desiredRow=0 first (one item per category), then 1, etc.
  withRow.sort((a, b) => a.desiredRow - b.desiredRow || a.x - b.x);

  const rowEndX = new Map();   // global collision map (inter-category avoidance)
  const catFloor = new Map();  // per-category: row never decreases within a category

  return withRow.map((it) => {
    const hw = Math.ceil(it.label.length * CHAR_W) / 2;
    const xStart = it.x - hw - GAP;
    const xEnd = it.x + hw + GAP;
    let row = Math.max(it.desiredRow, catFloor.get(it.catId) ?? 0);
    while ((rowEndX.get(row) ?? -Infinity) > xStart) row++;
    rowEndX.set(row, xEnd);
    catFloor.set(it.catId, Math.max(catFloor.get(it.catId) ?? 0, row));
    return { ...it, y: row * LINE_H };
  });
}

export function snippetFor(item, categories) {
  const cat = categories.find((c) => c.id === item.catId);
  const raw = item.text || item.title || "";
  if (!raw) return "";
  if (!cat) return raw.slice(0, SNIP_MAX) + (raw.length > SNIP_MAX ? "…" : "");

  let terms;
  let directTerms = false; // when true: search terms as-is, no stemming or length filter
  if (cat.type === "canonical") {
    // Prefer explicit text terms from config (actual keywords present in scraped text)
    if (Array.isArray(/** @type {any} */ (cat).terms) && /** @type {any} */ (cat).terms.length) {
      terms = /** @type {any} */ (cat).terms;
      directTerms = true;
    } else {
      const kws = Array.isArray(item.raw?.KeywordMatch) ? item.raw.KeywordMatch : [];
      terms = kws
        .filter((k) => /** @type {any} */ (keywordsGroup)[String(k).toLowerCase()] === cat.query)
        .map((k) => String(k));
      if (!terms.length) terms = [cat.query];
    }
  } else {
    terms = cat.query
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .flatMap((t) => t.split("+").map((s) => s.trim()));
    directTerms = true;
  }

  // Strip boilerplate: footer and leading "Nr. XXXX" metadata line
  let clean = raw
    .replace(/\nPolizei Berlin\nPressearbeit[\s\S]*/i, "")
    .replace(/^Nr\.\s*\d+\s*[\n\r]+/i, "")
    .trim();

  const lower = clean.toLowerCase();
  let pos = -1;

  // Compound PMK suffixes first, then standard German inflection/derivation suffixes.
  // Iterative: islamfeindlichkeit → islam, fremdenfeindlichkeit → fremden → fremd, etc.
  const SUFFIXES = ["feindlichkeit", "feindlich", "keit", "heit", "schaft", "ismus", "ierung", "ung", "lich", "isch", "en", "em", "er", "es", "e", "n", "s"];
  function stems(term) {
    const MIN = 5;
    const t = term.toLowerCase();
    const out = new Set([t]);
    let cur = t;
    let found = true;
    while (found) {
      found = false;
      for (const s of SUFFIXES) {
        if (cur.endsWith(s) && cur.length - s.length >= MIN) {
          cur = cur.slice(0, cur.length - s.length);
          out.add(cur);
          found = true;
          break;
        }
      }
    }
    return [...out];
  }

  if (directTerms) {
    // Config terms are explicit — search directly, no stemming or length filter
    outer: for (const term of terms) {
      const idx = lower.indexOf(term.toLowerCase());
      if (idx !== -1) { pos = idx; break outer; }
    }
  } else {
    outer: for (const term of terms) {
      for (const stem of stems(term)) {
        // Only accept stems that are at least half the original term length,
        // to avoid false matches from aggressive stripping (e.g. "islam" from "islamfeindlichkeit")
        if (stem.length < Math.max(5, Math.ceil(term.length / 2))) continue;
        const idx = lower.indexOf(stem);
        if (idx !== -1) { pos = idx; break outer; }
      }
    }
  }
  if (pos === -1) return item.title || clean.slice(0, SNIP_MAX) + (clean.length > SNIP_MAX ? "…" : "");

  // Sentence boundary: \n always splits; "." only splits if followed by space+uppercase letter
  // (avoids false breaks on "Nr.", "ca.", "Str.", etc.)
  function isSentBoundary(text, i) {
    const ch = text[i];
    if (ch === "!" || ch === "?" || ch === "\n") return true;
    if (ch !== ".") return false;
    return /^\s+[A-ZÄÖÜ]/.test(text.slice(i + 1)) || text.slice(i + 1).trimStart() === "";
  }

  // Scan backward for sentence start
  let sentStart = pos;
  while (sentStart > 0 && !isSentBoundary(clean, sentStart - 1)) sentStart--;
  while (sentStart < pos && /\s/.test(clean[sentStart])) sentStart++;

  // Scan forward for sentence end
  let sentEnd = pos;
  while (sentEnd < clean.length && !isSentBoundary(clean, sentEnd)) sentEnd++;
  if (sentEnd < clean.length) sentEnd++;

  // Normalise internal whitespace in the extracted sentence
  const sentence = clean.slice(sentStart, sentEnd).trim().replace(/\s+/g, " ");
  if (sentence.length <= SNIP_MAX) return sentence;

  // Too long: window centered on keyword, clipped at word boundaries
  const relPos = pos - sentStart;
  const half = Math.floor(SNIP_MAX / 2);
  let s = Math.max(0, relPos - half);
  let e = Math.min(sentence.length, relPos + half);
  // Snap to word boundaries
  while (s > 0 && sentence[s] !== " ") s--;
  while (e < sentence.length && sentence[e] !== " ") e++;
  return (s > 0 ? "…" : "") + sentence.slice(s, e).trim() + (e < sentence.length ? "…" : "");
}
