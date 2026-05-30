const LS_KEY = "translate_cache_v1";
const MAX_LS_ENTRIES = 2000;

// In-memory cache (always populated from localStorage on first use)
const cache = new Map();
// In-flight promises — prevents duplicate concurrent fetches for the same string
const inflight = new Map();
let lsLoaded = false;

function loadFromLS() {
  if (lsLoaded || typeof localStorage === "undefined") return;
  lsLoaded = true;
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const obj = JSON.parse(raw);
      for (const [k, v] of Object.entries(obj)) cache.set(k, v);
    }
  } catch {}
}

let persistTimer = null;
function persistToLS() {
  if (typeof localStorage === "undefined") return;
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    persistTimer = null;
    try {
      const entries = [...cache.entries()].slice(-MAX_LS_ENTRIES);
      localStorage.setItem(LS_KEY, JSON.stringify(Object.fromEntries(entries)));
    } catch {}
  }, 1500);
}

async function translate(text, sl, tl) {
  if (!text?.trim()) return text;
  loadFromLS();
  const key = `${sl}>${tl}:${text}`;
  if (cache.has(key)) return cache.get(key);
  if (inflight.has(key)) return inflight.get(key);

  const url =
    "https://translate.googleapis.com/translate_a/single" +
    `?client=gtx&sl=${sl}&tl=${tl}&dt=t&q=${encodeURIComponent(text)}`;

  const promise = fetch(url)
    .then(async (res) => {
      if (!res.ok) return text;
      const data = await res.json();
      const translated = data[0]?.map((chunk) => chunk[0]).join("") ?? text;
      cache.set(key, translated);
      persistToLS();
      return translated;
    })
    .catch(() => text)
    .finally(() => inflight.delete(key));

  inflight.set(key, promise);
  return promise;
}

// Source always explicitly `de` — auto-detection fails on short snippets.
export const translateDE_EN = (text) => translate(text, "de", "en");
export const translateEN_DE = (text) => translate(text, "en", "de");
