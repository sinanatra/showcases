const cache = new Map();

async function translate(text, sl, tl) {
  if (!text?.trim()) return text;
  const key = `${sl}>${tl}:${text}`;
  if (cache.has(key)) return cache.get(key);

  const url =
    "https://translate.googleapis.com/translate_a/single" +
    `?client=gtx&sl=${sl}&tl=${tl}&dt=t&q=${encodeURIComponent(text)}`;

  try {
    const res = await fetch(url);
    if (!res.ok) return text;
    const data = await res.json();
    const translated = data[0]?.map((chunk) => chunk[0]).join("") ?? text;
    cache.set(key, translated);
    return translated;
  } catch {
    return text;
  }
}

// Source always explicitly `de` — auto-detection fails on short snippets.
export const translateDE_EN = (text) => translate(text, "de", "en");
export const translateEN_DE = (text) => translate(text, "en", "de");
