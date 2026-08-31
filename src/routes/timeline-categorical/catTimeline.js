import { keywordsGroup } from "../../lib/constants/keywords.js";
import { CHAR_W, LINE_H, SEGMENT_SNIP_MAX, MAX_SEGMENTS_PER_ITEM } from "./config.js";

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
  const terms = cat.query
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  const kws = Array.isArray(a.KeywordMatch) ? a.KeywordMatch : [];
  const matchedViaKeywordGroup = kws.some((k) =>
    terms.includes(/** @type {any} */ (keywordsGroup)[String(k).toLowerCase()]),
  );
  if (matchedViaKeywordGroup) return true;

  const hay = `${a.Title || ""} ${a.Text || ""}`.toLowerCase();
  return terms.some((term) =>
    term
      .split("+")
      .map((s) => s.trim())
      .every((t) => hay.includes(t)),
  );
}

/** @param {((it: any) => number)|null} [widthFn] */
export function placeItems(preItems, xScale, labelFn, textAlign = "middle", lineH = LINE_H, widthFn = null) {
  const GAP = 6;

  const withX = preItems.map((it) => ({ ...it, x: xScale(it.date), label: labelFn(it) }));
  const sorted = [...withX].sort((a, b) => a.x - b.x);

  const rowEndX = new Map();

  return sorted.map((it) => {
    const tw = widthFn ? widthFn(it) : Math.ceil(it.label.length * CHAR_W);
    const hw = tw / 2;
    const xStart = textAlign === "start" ? it.x - GAP
                 : textAlign === "end"   ? it.x - tw - GAP
                 : it.x - hw - GAP;
    const xEnd   = textAlign === "start" ? it.x + tw + GAP
                 : textAlign === "end"   ? it.x + GAP
                 : it.x + hw + GAP;
    let row = 0;
    while ((rowEndX.get(row) ?? -Infinity) > xStart) row++;
    rowEndX.set(row, xEnd);
    return { ...it, y: (row + 0.2) * lineH };
  });
}

function stripBoilerplate(raw) {
  return raw
    .replace(/\nPolizei Berlin\nPressearbeit[\s\S]*/i, "")
    .replace(/^Nr\.\s*\d+\s*[\n\r]+/i, "")
    // "•" is reserved as the DE/EN separator in the "both" language display —
    // strip any that appear in the source Meldung text so it can't collide.
    .replace(/•/g, "")
    .trim();
}

/** Extracts the sentence around this category's matched keyword, or "" if none is found. */
function sentenceForCategory(item, cat) {
  const raw = item.text || item.title || "";
  if (!raw) return "";


  /** @type {[string[], boolean][]} */ const sources = [];
  if (cat.type === "canonical") {
    const kws = Array.isArray(item.raw?.KeywordMatch) ? item.raw.KeywordMatch : [];
    const matchedKws = kws
      .filter((k) => /** @type {any} */ (keywordsGroup)[String(k).toLowerCase()] === cat.query)
      .map((k) => String(k));
    if (matchedKws.length) sources.push([matchedKws, false]);
    if (Array.isArray(/** @type {any} */ (cat).terms) && /** @type {any} */ (cat).terms.length) {
      sources.push([/** @type {any} */ (cat).terms, true]);
    }
    if (!sources.length) sources.push([[cat.query], false]);
  } else {
    const literalTerms = cat.query
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .flatMap((t) => t.split("+").map((s) => s.trim()));

    const kws = Array.isArray(item.raw?.KeywordMatch) ? item.raw.KeywordMatch : [];
    const lowerLiteralTerms = literalTerms.map((t) => t.toLowerCase());
    const matchedKws = kws
      .filter((k) => lowerLiteralTerms.includes(/** @type {any} */ (keywordsGroup)[String(k).toLowerCase()]))
      .map((k) => String(k));

    if (matchedKws.length) sources.push([matchedKws, false]);
    sources.push([literalTerms, true]);
  }

  const clean = stripBoilerplate(raw);
  const lower = clean.toLowerCase();
  let pos = -1;

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

  sourceLoop: for (const [terms, directTerms] of sources) {
    if (directTerms) {
      // Config terms are explicit — search directly, no stemming or length filter
      for (const term of terms) {
        const idx = lower.indexOf(term.toLowerCase());
        if (idx !== -1) { pos = idx; break sourceLoop; }
      }
    } else {
      for (const term of terms) {
        for (const stem of stems(term)) {
          if (stem.length < Math.max(5, Math.ceil(term.length / 2))) continue;
          const idx = lower.indexOf(stem);
          if (idx !== -1) { pos = idx; break sourceLoop; }
        }
      }
    }
  }
  if (pos === -1) return null;

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

  const key = `${sentStart}-${sentEnd}`;

  const sentence = clean.slice(sentStart, sentEnd).trim().replace(/\s+/g, " ");
  if (sentence.length <= SEGMENT_SNIP_MAX) return { text: sentence, key };

  const relPos = pos - sentStart;
  const half = Math.floor(SEGMENT_SNIP_MAX / 2);
  let s = Math.max(0, relPos - half);
  let e = Math.min(sentence.length, relPos + half);
  // Snap to word boundaries
  while (s > 0 && sentence[s] !== " ") s--;
  while (e < sentence.length && sentence[e] !== " ") e++;
  const text = (s > 0 ? "…" : "") + sentence.slice(s, e).trim() + (e < sentence.length ? "…" : "");
  return { text, key };
}


export function groupBranchesBySentence(item, branchCats) {
  const groups = [];
  const byKey = new Map();
  for (const cat of branchCats) {
    const result = sentenceForCategory(item, cat);
    const key = result ? result.key : undefined;
    if (key && byKey.has(key)) {
      byKey.get(key).push(cat.id);
    } else {
      const group = [cat.id];
      groups.push(group);
      if (key) byKey.set(key, group);
    }
  }
  return groups;
}


export function snippetSegments(item, categories) {
  const raw = item.text || item.title || "";
  if (!raw) return [];

  const catIds = item.catIds?.length ? item.catIds : [item.catId];
  const canonicalCats = catIds
    .map((id) => categories.find((c) => c.id === id))
    .filter(Boolean);
  const highlightCat = item.highlightId
    ? categories.find((c) => c.id === item.highlightId)
    : null;
  const cats = highlightCat ? [...canonicalCats, highlightCat] : canonicalCats;
  if (!cats.length) {
    const text = raw.slice(0, SEGMENT_SNIP_MAX) + (raw.length > SEGMENT_SNIP_MAX ? "…" : "");
    return [{ color: item.color, text, on: true }];
  }

  const seenKeys = new Set();
  const segments = [];

  const canonicalBudget = highlightCat ? MAX_SEGMENTS_PER_ITEM - 1 : MAX_SEGMENTS_PER_ITEM;
  for (const cat of canonicalCats) {
    if (segments.length >= canonicalBudget) break;
    const result = sentenceForCategory(item, cat);
    if (!result) continue;
    if (seenKeys.has(result.key)) continue;
    seenKeys.add(result.key);
    segments.push({ color: cat.color, text: result.text, on: cat.on });
  }

  if (highlightCat) {
    const result = sentenceForCategory(item, highlightCat);
    if (result) {
      segments.push({ color: highlightCat.color, text: result.text, on: highlightCat.on });
    }
  }
  if (!segments.length) {
    const clean = stripBoilerplate(raw);
    const text = item.title || clean.slice(0, SEGMENT_SNIP_MAX) + (clean.length > SEGMENT_SNIP_MAX ? "…" : "");
    segments.push({ color: item.color, text, on: cats.some((c) => c.on) });
  }
  return segments;
}
