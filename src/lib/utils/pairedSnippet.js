import { splitSentences } from "./sentences.js";
import { findWord } from "./textUtils.js";

const norm = (t) => String(t ?? "").replace(/\s+/g, " ").trim();

// Whole words within `half` either side of `c`, "…" where the text goes on.
function around(text, c, half) {
  half = Math.max(0, Math.min(half, c, text.length - c));
  let a = Math.round(c - half),
    b = Math.round(c + half);
  while (a > 0 && a < b && text[a - 1] !== " ") a++;
  while (b < text.length && b > a && text[b] !== " ") b--;
  const body = text.slice(a, b).trim();
  return body ? (a > 0 ? "…" : "") + body + (b < text.length ? "…" : "") : "";
}

/**
 * German and English snippets cut from the same stretch of a report, each
 * centred on the found word, so both always say the same thing.
 * @param {string} text  the whole report, German
 * @param {{ full?: string, text?: string, at?: number, word?: string }} seg
 * @param {Record<string, string>} translatedMap  German sentence (or word) → English
 * @returns {{ max: number, de: (n: number) => string, en: (n: number) => string } | null}
 */
export function pairedSnippet(text, seg, translatedMap) {
  const raw = splitSentences(text || "");
  if (!raw.length) return null;
  let D = "",
    E = "";
  const dS = [],
    dL = [],
    eS = [],
    eL = [];
  for (const sentence of raw) {
    const d = norm(sentence),
      e = norm(translatedMap[sentence] ?? translatedMap[d] ?? "");
    if (D) D += " ";
    dS.push(D.length);
    dL.push(d.length);
    D += d;
    if (E && e) E += " ";
    eS.push(E.length);
    eL.push(e.length);
    E += e;
  }
  const full = norm(seg.full ?? seg.text);
  let k = raw.findIndex((x) => norm(x) === full);
  if (k < 0)
    k = raw.findIndex((x) =>
      norm(x).includes(full.replace(/^…|…$/g, "").slice(0, 40)),
    );
  if (k < 0) return null;
  const centre = dS[k] + (seg.at ?? 0.5) * dL[k];
  const toEn = (pos) => {
    let i = 0;
    while (i + 1 < dS.length && dS[i + 1] <= pos) i++;
    return (
      eS[i] +
      Math.min(1, Math.max(0, (pos - dS[i]) / Math.max(1, dL[i]))) * eL[i]
    );
  };
  // the translation may split sentences differently: look either side too
  let enCentre = toEn(centre);
  const word = seg.word ? norm(translatedMap[seg.word.toLowerCase()] ?? "") : "";
  for (const j of word ? [k, k - 1, k + 1] : []) {
    if (!eL[j]) continue;
    const got = findWord(E.slice(eS[j], eS[j] + eL[j]), word);
    if (got) {
      enCentre = eS[j] + (got.at + got.end) / 2;
      break;
    }
  }
  return {
    max: D.length,
    de: (n) => around(D, centre, n / 2),
    en: (n) =>
      E
        ? around(E, enCentre, (toEn(centre + n / 2) - toEn(centre - n / 2)) / 2)
        : "",
  };
}
