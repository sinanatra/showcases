import { keywordsGroup } from "../../lib/constants/categories.js";
import { settings, charW, lineH } from "./settings.svelte.js";
import { stripBoilerplate, isSentBoundary, splitSentences } from "../../lib/utils/sentences.js";
import { detectRegion } from "../../lib/utils/detectRegion.js";

export { stripBoilerplate, splitSentences };

const hayCache = new WeakMap();
function haystack(a) {
  let hay = hayCache.get(a);
  if (hay === undefined) {
    hay = `${a.Title || ""} ${a.Text || ""}`.toLowerCase();
    hayCache.set(a, hay);
  }
  return hay;
}
const termCache = new Map();
function queryTerms(query) {
  let terms = termCache.get(query);
  if (!terms) {
    terms = String(query || "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
      .map((term) => ({ term, parts: term.split("+").map((s) => s.trim()) }));
    termCache.set(query, terms);
  }
  return terms;
}

export function segmentText(seg, translations, langMode) {
  const translated = translateSegment(seg, translations);
  const showEn = langMode !== "de" && !!translated;
  const showDe = langMode !== "en" || !translated;
  const de = showDe ? seg.text : "";
  const en = showEn ? translated : "";
  const both = !!de && !!en;
  const stacked = both && settings.LANG_STACKED;
  const deW = Math.ceil(de.length * charW());
  const enW = Math.ceil(en.length * charW());
  const gap = 0;
  const tw = stacked ? Math.max(deW, enW) : deW + gap + enW;
  return { de, en, stacked, deW, enW, gap, tw };
}

export function matchesCategory(a, cat) {
  if (cat.keyword) {
    const kws = Array.isArray(a.KeywordMatch) ? a.KeywordMatch : [];
    return kws.some(
      (k) =>
        (keywordsGroup)[String(k).toLowerCase()] ===
        cat.keyword,
    );
  }
  if (cat.region) return detectRegion(a) === cat.region;
  const terms = queryTerms(cat.query);

  const kws = Array.isArray(a.KeywordMatch) ? a.KeywordMatch : [];
  const matchedViaKeywordGroup = kws.some((k) =>
    terms.some(({ term }) => term === (keywordsGroup)[String(k).toLowerCase()]),
  );
  if (matchedViaKeywordGroup) return true;

  const hay = haystack(a);
  return terms.some(({ parts }) => parts.every((t) => hay.includes(t)));
}

export function placeItems(preItems, xScale, labelFn, textAlign = "middle", rowH = lineH(), widthFn = null, startRows = null) {
  const GAP = 6;

  const withX = preItems.map((it) => ({ ...it, x: xScale(it.date), label: labelFn(it) }));

  const groups = new Map();
  for (const it of withX) {
    const cid = it.catId;
    if (!groups.has(cid)) groups.set(cid, []);
    groups.get(cid).push(it);
  }
  for (const items of groups.values()) {
    items.sort((a, b) => a.x - b.x);
    items.forEach((it, i) => {
      it.wave = i;
    });
  }
  const withWave = [...withX].sort((a, b) => a.wave - b.wave || a.x - b.x);

  const rowSpans = new Map();
  const clearance = Math.max(0, Math.round(settings.BRANCH_CLEARANCE) || 0);
  const isFree = (row, a, b, catId) => {
    for (let r = Math.max(0, row - clearance); r <= row + clearance; r++) {
      const spans = rowSpans.get(r);
      if (!spans) continue;
      for (const [s0, s1, owner] of spans) {
        if (s0 < b && s1 > a && (r === row || owner !== catId)) return false;
      }
    }
    return true;
  };
  const catFloor = new Map();

  return withWave.map((it) => {
    const tw = widthFn ? widthFn(it) : Math.ceil(it.label.length * charW());
    const hw = tw / 2;
    const xStart = textAlign === "start" ? it.x - GAP
                 : textAlign === "end"   ? it.x - tw - GAP
                 : it.x - hw - GAP;
    const xEnd   = textAlign === "start" ? it.x + tw + GAP
                 : textAlign === "end"   ? it.x + GAP
                 : it.x + hw + GAP;
    let row = catFloor.get(it.catId) ?? startRows?.get(it.catId) ?? 0;
    while (!isFree(row, xStart, xEnd, it.catId)) row++;
    if (!rowSpans.has(row)) rowSpans.set(row, []);
    rowSpans.get(row).push([xStart, xEnd, it.catId]);
    catFloor.set(it.catId, row);
    return { ...it, y: (row + 0.2) * rowH };
  });
}

export function translateSegment(seg, translations) {
  const exact = translations?.[seg.text];
  if (exact) return exact;
  const en = translations?.[seg.full ?? seg.text];
  if (!en) return "";
  if (!seg.full || seg.full === seg.text || en.length <= settings.SEGMENT_SNIP_MAX) return en;
  let e = settings.SEGMENT_SNIP_MAX;
  while (e < en.length && en[e] !== " ") e++;
  return en.slice(0, e).trim() + (e < en.length ? "…" : "");
}

function sentenceForCategory(item, cat) {
  const raw = item.text || item.title || "";
  if (!raw) return "";

  const sources = [];
  if (cat.keyword) {
    const kws = Array.isArray(item.raw?.KeywordMatch) ? item.raw.KeywordMatch : [];
    const matchedKws = kws
      .filter((k) => (keywordsGroup)[String(k).toLowerCase()] === cat.keyword)
      .map((k) => String(k));
    const order = (k) => {
      const i = (cat.terms ?? []).findIndex((t) => t.toLowerCase() === k.toLowerCase());
      return i === -1 ? Infinity : i;
    };
    const found = matchedKws
      .filter((k) => k.toLowerCase() !== cat.keyword)
      .sort((x, y) => order(x) - order(y));
    if (found.length) sources.push([found, true]);
    if (Array.isArray(cat.terms) && cat.terms.length) sources.push([cat.terms, true]);
    const extracted = Array.isArray(item.raw?.KeywordExtracted) ? item.raw.KeywordExtracted.map(String) : [];
    if (extracted.length) sources.push([extracted, true]);
    if (found.length) sources.push([found, false]);
  } else {
    const literalTerms = cat.query
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .flatMap((t) => t.split("+").map((s) => s.trim()));

    const kws = Array.isArray(item.raw?.KeywordMatch) ? item.raw.KeywordMatch : [];
    const lowerLiteralTerms = literalTerms.map((t) => t.toLowerCase());
    const matchedKws = kws
      .filter((k) => lowerLiteralTerms.includes((keywordsGroup)[String(k).toLowerCase()]))
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

  function sentenceAt(at) {
    let start = at;
    while (start > 0 && !isSentBoundary(clean, start - 1)) start--;
    while (start < at && /\s/.test(clean[start])) start++;
    let end = at;
    while (end < clean.length && !isSentBoundary(clean, end)) end++;
    if (end < clean.length) end++;
    return { start, end, text: clean.slice(start, end).trim().replace(/\s+/g, " ") };
  }
  const isProse = (t) => t.length >= 40 && /[.!?…]["“”']?$/.test(t);

  let fallback = -1;
  sourceLoop: for (const [terms, directTerms] of sources) {
    for (const term of terms) {
      const needles = directTerms
        ? [term.toLowerCase()]
        : stems(term).filter((stem) => stem.length >= Math.max(5, Math.ceil(term.length / 2)));
      for (const needle of needles) {
        if (!needle) continue;
        for (let idx = lower.indexOf(needle), n = 0; idx !== -1 && n < 20; idx = lower.indexOf(needle, idx + 1), n++) {
          if (isProse(sentenceAt(idx).text)) { pos = idx; break sourceLoop; }
          if (fallback === -1) fallback = idx;
        }
      }
    }
  }
  if (pos === -1) pos = fallback;
  if (pos === -1) return null;

  const { start: sentStart, end: sentEnd } = sentenceAt(pos);

  const key = `${sentStart}-${sentEnd}`;

  const sentence = clean.slice(sentStart, sentEnd).trim().replace(/\s+/g, " ");
  if (sentence.length <= settings.SEGMENT_SNIP_MAX) return { text: sentence, key, full: sentence };

  const relPos = pos - sentStart;
  const half = Math.floor(settings.SEGMENT_SNIP_MAX / 2);
  let s = Math.max(0, relPos - half);
  let e = Math.min(sentence.length, relPos + half);
  while (s > 0 && sentence[s] !== " ") s--;
  while (e < sentence.length && sentence[e] !== " ") e++;
  const text = (s > 0 ? "…" : "") + sentence.slice(s, e).trim() + (e < sentence.length ? "…" : "");
  return { text, key, full: sentence };
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
  const cats = canonicalCats;
  if (!cats.length) {
    const text = raw.slice(0, settings.SEGMENT_SNIP_MAX) + (raw.length > settings.SEGMENT_SNIP_MAX ? "…" : "");
    return [{ color: item.color, colorEnd: item.colorEnd, text, on: true }];
  }

  const seenKeys = new Set();
  const segments = [];

  for (const cat of canonicalCats) {
    if (segments.length >= settings.MAX_SEGMENTS_PER_ITEM) break;
    const result = sentenceForCategory(item, cat);
    if (!result) continue;
    if (seenKeys.has(result.key)) continue;
    seenKeys.add(result.key);
    const paint = highlightCat ?? cat;
    segments.push({ color: paint.color, colorEnd: paint.colorEnd, text: result.text, full: result.full, on: cat.on });
  }
  if (!segments.length) {
    const first = item.text ? splitSentences(item.text)[0] : "";
    const full = first || item.title || "";
    let text = full;
    if (text.length > settings.SEGMENT_SNIP_MAX) {
      let e = settings.SEGMENT_SNIP_MAX;
      while (e < text.length && text[e] !== " ") e++;
      text = text.slice(0, e).trim() + "…";
    }
    const paint = highlightCat ?? item;
    segments.push({ color: paint.color, colorEnd: paint.colorEnd, text, full, on: cats.some((c) => c.on) });
  }
  return segments;
}
