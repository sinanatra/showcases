// Step 3 of the pipeline. Precomputes English for the dataset (static/all_merged.csv): every
// report's title and every sentence of its text, saved to
// static/translations/<year>.json as { "German": "English" }.
//
// Sentences are cut exactly the way timeline snippets are (splitSentences), so
// whatever sentence a category picks — including categories added later — is
// already translated. Nothing is translated at runtime.
//
// Incremental: only strings not yet in static/translations/ are sent, newest
// reports first, and progress is saved as it goes — safe to interrupt and re-run.
//
// Two providers:
//   deepl   DeepL API (free tier: 500k chars/month). Needs DEEPL_API_KEY.
//           Plenty for the daily trickle of new reports; stops cleanly when the
//           quota is used up and carries on next run.
//             npm run translate
//   ollama  A local model through Ollama — free and unlimited, used for the
//           one-off backfill of the whole dataset (takes a few hours).
//             npm run translate:local
//           Model: OLLAMA_MODEL (default gemma4:e4b).
//
// Default provider: deepl when DEEPL_API_KEY is set, otherwise ollama.
//
// --days=N  only translate reports dated within the last N days. The GitHub
//           Action uses this so DeepL's quota goes to new entries, not the backlog.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Papa from "papaparse";

import { splitSentences } from "../src/lib/utils/sentences.js";
import { parseList } from "../src/lib/utils/parseList.js";
import { parseDateLoose } from "../src/lib/utils/parseDate.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CSV_PATH = path.join(__dirname, "../static/all_merged.csv");
const OUT_DIR = path.join(__dirname, "../static/translations");

const arg = (name) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];
const providerArg = arg("provider");
const DAYS = Number(arg("days")) || 0;
const API_KEY = process.env.DEEPL_API_KEY;
const PROVIDER = providerArg || (API_KEY ? "deepl" : "ollama");
const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "gemma4:e4b";

class QuotaExceeded extends Error {}

// ── DeepL ─────────────────────────────────────────────────────
const DEEPL_BATCH = 50; // DeepL's per-request text limit
// Free-tier keys end in ":fx" and must hit the api-free host, not api.deepl.com.
const API_HOST = API_KEY?.endsWith(":fx") ? "api-free.deepl.com" : "api.deepl.com";

async function deeplBatch(texts) {
  const res = await fetch(`https://${API_HOST}/v2/translate`, {
    method: "POST",
    headers: {
      Authorization: `DeepL-Auth-Key ${API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text: texts, source_lang: "DE", target_lang: "EN" }),
  });
  if (res.status === 456) throw new QuotaExceeded("DeepL quota used up");
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`DeepL ${res.status}: ${body.slice(0, 200)}`);
  }
  const data = await res.json();
  return data.translations.map((t) => t.text);
}

async function translateDeepl(texts) {
  const out = [];
  for (let i = 0; i < texts.length; i += DEEPL_BATCH) {
    out.push(...(await deeplBatch(texts.slice(i, i + DEEPL_BATCH))));
  }
  return out;
}

// ── Ollama ────────────────────────────────────────────────────
const OLLAMA_BATCH = 12; // sentences of one report sent together, so the model has context
const OLLAMA_SYSTEM =
  "You translate German police press reports into English. You receive a JSON array of German sentences from one report. " +
  "Return a JSON array with exactly the same number of items, item i being the faithful English translation of sentence i. " +
  "Keep names, street names, numbers and times unchanged. Do not merge, split, add or omit sentences.";

async function ollamaChat(texts) {
  const res = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: "POST",
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      stream: false,
      think: false,
      options: { temperature: 0, num_ctx: 8192 },
      format: { type: "array", items: { type: "string" }, minItems: texts.length, maxItems: texts.length },
      messages: [
        { role: "system", content: OLLAMA_SYSTEM },
        { role: "user", content: JSON.stringify(texts) },
      ],
    }),
  });
  if (!res.ok) throw new Error(`Ollama ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`);
  const parsed = JSON.parse((await res.json()).message?.content ?? "null");
  if (!Array.isArray(parsed) || parsed.length !== texts.length) throw new Error("misaligned answer");
  return parsed.map((t) => String(t ?? "").trim());
}

async function translateOllama(texts) {
  const out = [];
  for (let i = 0; i < texts.length; i += OLLAMA_BATCH) {
    const batch = texts.slice(i, i + OLLAMA_BATCH);
    try {
      out.push(...(await ollamaChat(batch)));
    } catch {
      // The model lost count — redo this batch one sentence at a time.
      for (const text of batch) {
        out.push(await ollamaChat([text]).then((r) => r[0], () => ""));
      }
    }
  }
  return out;
}

const translate = PROVIDER === "deepl" ? translateDeepl : translateOllama;

// ── dataset ───────────────────────────────────────────────────
const hasWords = (s) => /\p{L}{2}/u.test(s);

/** One entry per report, newest first: the strings the site can show for it. */
function loadReports() {
  const csvText = fs.readFileSync(CSV_PATH, "utf-8");
  const { data } = Papa.parse(csvText, { header: true, skipEmptyLines: true });
  return data
    .map((d) => {
      const date = parseDateLoose(d.ExtractedDate || d.Date);
      const title = (d.Title || "").trim();
      // The matched words too, so the main timeline can highlight them in English.
      const words = parseList(d.KeywordExtracted).map((w) => String(w).toLowerCase());
      const units = [...new Set([title, ...splitSentences(d.Text || ""), ...words])].filter(hasWords);
      return { year: date && !isNaN(+date) ? String(date.getFullYear()) : "undated", time: date ? +date : 0, units };
    })
    .sort((a, b) => b.time - a.time);
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf-8"));
  } catch {
    return {};
  }
}

async function main() {
  if (PROVIDER === "deepl" && !API_KEY) {
    console.error(
      "Missing DEEPL_API_KEY.\n" +
        "  1. Copy .env.example to .env\n" +
        "  2. Fill in your key from https://www.deepl.com/pro-api\n" +
        "  3. Run: npm run translate\n" +
        "Or translate with a local model instead: npm run translate:local",
    );
    process.exit(1);
  }

  const reports = loadReports();
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const known = {};
  for (const file of fs.readdirSync(OUT_DIR)) {
    if (/^(\d{4}|undated)\.json$/.test(file)) Object.assign(known, readJson(path.join(OUT_DIR, file)));
  }

  // Year files are rebuilt from the current dataset, in report order, so they
  // only ever hold strings the site can show and unchanged years stay identical.
  const years = [...new Set(reports.map((r) => r.year))].sort().reverse();
  function save(onlyYear) {
    for (const year of onlyYear ? [onlyYear] : years) {
      const out = {};
      for (const r of reports) {
        if (r.year !== year) continue;
        for (const u of r.units) if (known[u]) out[u] = known[u];
      }
      fs.writeFileSync(path.join(OUT_DIR, `${year}.json`), JSON.stringify(out, null, 1) + "\n");
    }
    fs.writeFileSync(path.join(OUT_DIR, "index.json"), JSON.stringify(years) + "\n");
  }
  save();

  const total = new Set(reports.flatMap((r) => r.units));
  const missingCount = () => [...total].filter((u) => !known[u]).length;
  const since = DAYS ? Date.now() - DAYS * 864e5 : -Infinity;
  const todo = reports.filter((r) => r.time >= since && r.units.some((u) => !known[u]));
  console.log(
    `${reports.length} reports, ${total.size} strings, ${missingCount()} to translate ` +
      `— doing ${todo.length} reports${DAYS ? ` from the last ${DAYS} days` : ""} (${PROVIDER}${PROVIDER === "ollama" ? " " + OLLAMA_MODEL : ""}).`,
  );

  let done = 0;
  for (const r of todo) {
    const missing = r.units.filter((u) => !known[u]);
    if (!missing.length) continue; // translated meanwhile via another report
    try {
      const results = await translate(missing);
      missing.forEach((text, i) => {
        if (results[i]) known[text] = results[i];
      });
    } catch (e) {
      if (e instanceof QuotaExceeded) {
        console.log(`Stopping: ${e.message}. The rest is picked up on the next run.`);
        break;
      }
      console.log(`  report failed, skipping for now: ${e.message}`);
    }
    save(r.year);
    done++;
    if (done % 20 === 0 || done === todo.length) console.log(`  ${done}/${todo.length} reports (${missingCount()} strings left)`);
  }
  save();
  console.log(`Done. ${missingCount()} strings still untranslated.`);
}

main();
