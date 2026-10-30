import { getKeywordVariants, keywordsGroup, KEYWORD_LABELS } from "$lib/constants/categories";
import { splitSentences } from "$lib/utils/sentences";
import { escapeRe } from "$lib/utils/textUtils";

const escapeHtml = (s) =>
  String(s || "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

const WORD_START = "(?<![\\p{L}\\p{N}_])";
const WORD_REST = "[\\p{L}\\p{N}-]*";

// matched keywords are stems, so the whole word they start is highlighted
function keywordRegex(keywordMatch, english) {
  const stems = (keywordMatch || []).flatMap((kw) => {
    const canon = keywordsGroup[String(kw).toLowerCase()] || kw;
    return getKeywordVariants(canon, english);
  });
  if (!stems.length) return null;
  const alt = [...new Set(stems)].sort((a, b) => b.length - a.length).map(escapeRe).join("|");
  return new RegExp(`${WORD_START}(?:${alt})${WORD_REST}`, "giu");
}

// the whole word around a search term, wherever in the word it was found
function queryRegex(query) {
  const terms = query.split(/[,+]/).map((term) => term.trim()).filter(Boolean);
  const alt = terms.map((term) => escapeRe(escapeHtml(term))).join("|");
  return new RegExp(`${WORD_REST}(?:${alt})${WORD_REST}`, "giu");
}

function highlight(text, re) {
  const safe = escapeHtml(text);
  return re ? safe.replace(re, (m) => `<mark>${m}</mark>`) : safe;
}

// The translations are stored per sentence of the whole text, and sentences can
// run across a line break, so translate first and then put the paragraphs back.
function englishParagraphs(text, map) {
  const paragraphs = [[]];
  let pos = 0;
  for (const sentence of splitSentences(text)) {
    paragraphs.at(-1).push(map[sentence] ?? sentence);
    const lastWord = sentence.split(" ").pop();
    const end = text.indexOf(lastWord, pos);
    if (end < 0) continue;
    pos = end + lastWord.length;
    if (/^\s*\n/.test(text.slice(pos))) paragraphs.push([]);
  }
  return paragraphs.filter((p) => p.length).map((p) => p.join(" "));
}

const NUMBER = /^(Nr|No)\.\s*\d+$/;

// the report number sits in bold right above its text, as on berlin.de
const joinNumbers = (paragraphs) =>
  paragraphs.flatMap((p, i) => {
    if (NUMBER.test(paragraphs[i - 1])) return [];
    return NUMBER.test(p) && paragraphs[i + 1] ? `<strong>${p}</strong><br />${paragraphs[i + 1]}` : p;
  });

const categoriesOf = (d, lang) =>
  [...new Set((d.KeywordMatch || []).map((k) => keywordsGroup[String(k).toLowerCase()] || k))]
    .map((canon) => KEYWORD_LABELS[canon]?.[lang] ?? canon);

// the words found in the text, one form of each: hakenkreuz, hakenkreuze -> Hakenkreuz
function tagsOf(d) {
  const words = [...(d.KeywordExtracted || [])].sort((a, b) => a.length - b.length);
  const kept = words.filter((w, i) => !words.slice(0, i).some((shorter) => w.startsWith(shorter)));
  return kept.map((w) => w[0].toUpperCase() + w.slice(1));
}

// map = German -> English translations, or null for the German original.
// A search replaces the keyword highlights.
export function toSheet(d, query = "", map = null) {
  const re = query ? queryRegex(query) : keywordRegex(d.KeywordMatch, !!map);
  const title = map ? (map[d.Title.trim()] ?? d.Title) : d.Title;
  const paragraphs = map
    ? englishParagraphs(d.Text, map)
    : d.Text.split(/\n+/).filter((p) => p.trim());
  const place = String(d.Location || "").split(",").map((part) => part.trim()).filter(Boolean);
  return {
    en: !!map,
    berlin: d.URL.includes("berlin.de"),
    date: d.Date || d.ExtractedDate,
    location: d.Location,
    county: place.length > 1 ? place.at(-1) : "",
    town: (place.length > 1 ? place.slice(0, -1) : place).join(", "),
    categories: categoriesOf(d, map ? "en" : "de"),
    tags: map ? [] : tagsOf(d), // these are German words
    title: highlight(title, re),
    paragraphs: joinNumbers(paragraphs.map((p) => highlight(p, re))),
  };
}
