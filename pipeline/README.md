# Pipeline

Scrape everything → save it raw → filter by `categories.json` → translate what is new.

```
categories.json            what counts as an incident (categories) + curated views (commentary)
pipeline/
  scrape_rss.py            1. daily: Berlin + Brandenburg RSS feeds  → data/police_rss_<month>.csv
  scrape_berlin.py            archive backfill                       → data/berlin_police_results.csv
  scrape_brandenburg.py       archive backfill                       → data/brandenburg_police_results.csv
  data/                       every scraped report, unfiltered
  filter.py                2. all of data/ × categories.json         → static/all_merged.csv
  translate.mjs            3. new reports in the dataset → English   → static/translations/<year>.json
```

## Daily (GitHub Action `rss.yml`, or by hand)

```bash
npm run pipeline        # scrape_rss.py + filter.py
npm run translate       # DeepL (needs DEEPL_API_KEY in .env)
```

## Changing categories

Edit `categories.json`, then `npm run filter`. The filter re-scores every scraped
report each time (about 10 seconds), so reports that did not match before are picked up.

- `categories`: terms are word stems searched in all scraped reports; a match puts the report in the dataset.
- `commentary`: terms are searched only within the dataset (highlights on the categorical timeline).

## Archive backfill

```bash
pip install -r pipeline/requirements.txt
python3 pipeline/scrape_berlin.py        # stops once it reaches reports it already has
python3 pipeline/scrape_brandenburg.py   # same; blocked by a CAPTCHA unless cleared in a browser first
FULL_SCAN=1 python3 pipeline/scrape_berlin.py   # walk the whole archive to catch missed reports
```

## Translating the backlog (free, local)

```bash
npm run translate:local   # Ollama, default model gemma4:e4b; resumable
```

The Action only translates reports from the last 30 days, so DeepL's free quota is not spent on the backlog.
