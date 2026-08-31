// Precomputes English translations for every German snippet the
// timeline-categorical route can ever show, and saves them to
// static/translations.json — a one-time, offline job, not something the
// live app depends on or calls at runtime.
//
// Uses the DeepL API (free tier: 500k chars/month, no card required —
// https://www.deepl.com/pro-api). Switched from Google Translate's
// unofficial endpoint after it started outright IP-blocking this machine
// ("your computer or network may be sending automated queries") — an
// authenticated, documented API doesn't have that failure mode.
//
// Needs DEEPL_API_KEY set. Put it in a .env file (see .env.example) and run:
//   node --env-file=.env scripts/precompute-translations.mjs
// or just:
//   npm run translate:precompute
//
// Safe to interrupt and re-run — it skips strings already in the output
// file and saves progress after every batch.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Papa from "papaparse";

import { DEFAULT_CATEGORIES } from "../src/routes/timeline-categorical/config.js";
import { matchesCategory, snippetSegments } from "../src/routes/timeline-categorical/catTimeline.js";
import { parseDateLoose } from "../src/lib/utils/parseDate.js";
import { augmentKeywordMatch } from "../src/lib/constants/keywords.js";
import { parseList } from "../src/lib/utils/parseList.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CSV_PATH = path.join(__dirname, "../static/all_merged.csv");
const OUT_PATH = path.join(__dirname, "../static/translations.json");
const BATCH_SIZE = 50; // DeepL's per-request text limit

const API_KEY = process.env.DEEPL_API_KEY;
if (!API_KEY) {
  console.error(
    "Missing DEEPL_API_KEY.\n" +
      "  1. Copy .env.example to .env\n" +
      "  2. Fill in your key from https://www.deepl.com/pro-api\n" +
      "  3. Run: node --env-file=.env scripts/precompute-translations.mjs",
  );
  process.exit(1);
}
// Free-tier keys end in ":fx" and must hit the api-free host, not api.deepl.com.
const API_HOST = API_KEY.endsWith(":fx") ? "api-free.deepl.com" : "api.deepl.com";

async function translateBatch(texts) {
  const res = await fetch(`https://${API_HOST}/v2/translate`, {
    method: "POST",
    headers: {
      Authorization: `DeepL-Auth-Key ${API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text: texts, source_lang: "DE", target_lang: "EN" }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`DeepL ${res.status}: ${body.slice(0, 200)}`);
  }
  const data = await res.json();
  return data.translations.map((t) => t.text);
}

function passesBilanz(a) {
  return !/bilanz/i.test(a.Title || "");
}

function loadArticles() {
  const csvText = fs.readFileSync(CSV_PATH, "utf-8");
  const { data } = Papa.parse(csvText, { header: true, skipEmptyLines: true });
  return data.map((d) => ({
    ...d,
    KeywordMatch: augmentKeywordMatch(parseList(d.KeywordMatch), `${d.Title || ""} ${d.Text || ""}`),
    ExtractedDate: d.ExtractedDate || d.Date,
    Text: d.Text || "",
    Title: d.Title || "",
  }));
}

// Mirrors computeItems() in +page.svelte, minus the region filter — the
// precomputed file should cover every article regardless of which region
// toggle is currently on, since that's a runtime UI choice.
function collectSnippets(articles, categories) {
  const branchCats = categories.filter((c) => c.type === "canonical");
  const highlightCats = categories.filter((c) => c.type !== "canonical");
  const MIN_DATE = new Date("2020-01-01");

  const unique = new Set(categories.map((c) => c.label));
  let matchedCount = 0;

  for (const a of articles) {
    if (!passesBilanz(a)) continue;
    const d = parseDateLoose(a.ExtractedDate);
    if (!d || d < MIN_DATE) continue;

    const matchedBranches = branchCats.filter((cat) => matchesCategory(a, cat));
    if (!matchedBranches.length) continue;
    const matchedHighlight = highlightCats.find((cat) => cat.on && matchesCategory(a, cat));

    for (const cat of matchedBranches) {
      const built = {
        date: d,
        title: (a.Title || "").trim(),
        text: (a.Text || "").trim(),
        raw: a,
        catId: cat.id,
        catIds: [cat.id],
        color: matchedHighlight ? matchedHighlight.color : cat.color,
        highlightId: matchedHighlight?.id ?? null,
      };
      for (const seg of snippetSegments(built, categories)) unique.add(seg.text);
    }
    matchedCount++;
  }

  return { unique, matchedCount };
}

async function main() {
  const articles = loadArticles();
  const categories = DEFAULT_CATEGORIES.map((c) => ({ ...c }));
  const { unique, matchedCount } = collectSnippets(articles, categories);
  console.log(`${matchedCount} matched articles, ${unique.size} unique strings.`);

  let existing = {};
  if (fs.existsSync(OUT_PATH)) {
    try {
      existing = JSON.parse(fs.readFileSync(OUT_PATH, "utf-8"));
    } catch {}
  }

  const toTranslate = [...unique].filter((t) => !(t in existing));
  console.log(`${unique.size - toTranslate.length} already cached, ${toTranslate.length} to translate.`);
  if (!toTranslate.length) {
    console.log("Nothing new — done.");
    return;
  }

  let done = 0;
  for (let i = 0; i < toTranslate.length; i += BATCH_SIZE) {
    const batch = toTranslate.slice(i, i + BATCH_SIZE);
    try {
      const results = await translateBatch(batch);
      batch.forEach((text, j) => {
        if (results[j] && results[j] !== text) existing[text] = results[j];
      });
    } catch (e) {
      console.log(`  batch at ${i} failed: ${e.message}`);
    }
    done += batch.length;
    fs.writeFileSync(OUT_PATH, JSON.stringify(existing));
    console.log(`  ${done}/${toTranslate.length} (${Object.keys(existing).length} saved so far)`);
  }
  console.log(`Done. ${Object.keys(existing).length} total translations in ${OUT_PATH}`);
}

main();
