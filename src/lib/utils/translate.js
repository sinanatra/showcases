const LS_KEY = "translate_cache_v1";
const MAX_LS_ENTRIES = 8000;
// Raises MyMemory's anonymous daily quota from 5,000 to 50,000 words.
const CONTACT_EMAIL = "gn.nanni@gmail.com";

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

// MyMemory's anonymous tier throttles hard — firing requests in parallel
// batches (as the caller used to) got every single one back as 429. Route
// every request through one global queue spaced out over time, with
// exponential-backoff retries on 429, so a page with hundreds of unique
// snippets trickles them out instead of bursting.
const MIN_INTERVAL_MS = 350;
let queueTail = Promise.resolve();
let lastDispatch = 0;

function scheduled(fn) {
  const run = async () => {
    const wait = Math.max(0, lastDispatch + MIN_INTERVAL_MS - Date.now());
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastDispatch = Date.now();
    return fn();
  };
  const result = queueTail.then(run, run);
  queueTail = result.then(
    () => {},
    () => {},
  );
  return result;
}

// Once MyMemory reports the daily anonymous quota is used up, every further
// call gets the same warning back as a 429 — retrying wastes seconds per
// item for the rest of the session. Trip a breaker and fail fast instead.
let quotaExhausted = false;

async function fetchWithRetry(url, attempt = 0) {
  const res = await fetch(url);
  let body = null;
  try {
    body = await res.clone().json();
  } catch {}
  const msg = body?.responseData?.translatedText || "";
  if (/AVAILABLE FREE TRANSLATIONS FOR TODAY/i.test(msg)) {
    quotaExhausted = true;
    return body;
  }
  if (res.status === 429 && attempt < 3) {
    const delay = 800 * 2 ** attempt;
    await new Promise((r) => setTimeout(r, delay));
    return fetchWithRetry(url, attempt + 1);
  }
  return res.ok ? body : null;
}

async function translate(text, sl, tl) {
  if (!text?.trim() || quotaExhausted) return text;
  loadFromLS();
  const key = `${sl}>${tl}:${text}`;
  if (cache.has(key)) return cache.get(key);
  if (inflight.has(key)) return inflight.get(key);

  // translate.googleapis.com doesn't send CORS headers for browser fetches
  // (blocked outright, not a sandbox artifact — confirmed in real browsers
  // too), so it silently never translated anything. MyMemory's API does
  // send Access-Control-Allow-Origin: * and works directly from the client.
  // A contact email raises MyMemory's daily quota from 5,000 to 50,000 words.
  const url =
    "https://api.mymemory.translated.net/get" +
    `?langpair=${sl}|${tl}&q=${encodeURIComponent(text)}&de=${encodeURIComponent(CONTACT_EMAIL)}`;

  const promise = scheduled(() => fetchWithRetry(url))
    .then((body) => {
      const translated = body?.responseData?.translatedText;
      // Quota-exceeded / error responses can come back as status 200 with a
      // warning string in translatedText — don't cache those as if real.
      if (!translated || body.responseStatus !== 200 || /MYMEMORY WARNING/i.test(translated)) {
        return text;
      }
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
