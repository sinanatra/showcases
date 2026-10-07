
<img width="3296" height="1593" alt="image" src="https://github.com/user-attachments/assets/b14b53f2-b0cb-45b5-a0f9-be40f66f243f" />

Showcases transforms official police reports into multimedia installations that trace the normalization of right-wing violence in Berlin and Brandenburg, Germany. From everyday hate crimes to nationalist symbols on public walls, the project confronts what society often overlooks. 

Showcases is a data-driven investigation that visualizes police reports of politically motivated crimes to draw attention to a mounting normalization of xenophobic, trans- and homophobic violence and right-extremism in Germany. It roots in disturbing records of incidents such as: swastikas (Hakenkreuz) appearing on walls of mosques, synagogues and schools; people tearing off the Hidschāb from a 14-year-old and spitting in her hair; cashiers confronted with drunk customers that perform the Hitler salute. These are not isolated events, but daily occurrences that suggest an erosion of democratic norms and a resurgence of far-right ideology in society.

The project draws connection to the German political landscape, where with the growing support for the right-extremist party Alternative für Deutschland (AfD) since 2013, politically motivated crimes linked to far-right ideology have increased significantly ([Bundeskriminalamt, 2025](https://www.bka.de/DE/AktuelleInformationen/StatistikenLagebilder/PolizeilicheKriminalstatistik/pks_node.html)). This is taking place in a country whose history, marked by authoritarianism and violence, serves as a stark reminder of the intertwining of nationalist parties in the parliament and violence by like-minded extremists. And yet, in much of the public and political discourse, these tendencies seem to be neglected, while populists use their media coverage for pushing toxic narratives and anti-islamic, anti-woke, anti-semitic and anti-democratic agendas.

## How it works

Scrape everything → save it raw → filter by `categories.json` → translate what is new → the site reads the result.

```
categories.json          categories (define the dataset) + commentary (views on top of it)
pipeline/
  scrape_rss.py          1. daily: Berlin + Brandenburg RSS feeds → data/police_rss_<month>.csv
  scrape_berlin.py          archive backfill                      → data/berlin_police_results.csv
  scrape_brandenburg.py     archive backfill                      → data/brandenburg_police_results.csv
  data/                     every scraped report, unfiltered
  filter.py              2. all of data/ × categories.json        → static/all_merged.csv
  translate.mjs          3. new reports in the dataset → English  → static/translations/<year>.json
src/                     the SvelteKit site (reads static/all_merged.csv and static/translations/)
```

The GitHub Action `rss.yml` runs steps 1–3 every day and commits the result; `deploy.yml` builds and publishes the site.

### Categories

Everything is defined in [`categories.json`](categories.json):

- `categories`: each has an id (e.g. `kennzeichen`) and `terms` (`hakenkreuz`, `hitlergruß`, …). Terms are word stems searched in **all** scraped reports; a match puts the report in the dataset.
- `commentary`: same shape, but terms are searched only **within** the dataset (highlights on the categorical timeline). They never pull a report in.

After editing it, run `npm run filter`. The filter re-scores every scraped report each time (about 10 seconds), so reports that did not match before are picked up.

### Commands

```bash
npm install
npm run dev               # the site

pip install -r pipeline/requirements.txt
npm run pipeline          # scrape RSS feeds + filter
npm run filter            # filter only (after editing categories.json)
npm run translate         # translate with DeepL (needs DEEPL_API_KEY in .env)
npm run translate:local   # translate the backlog with a local Ollama model (resumable)
```

Archive scrapers, full re-scans and translation details: [`pipeline/README.md`](pipeline/README.md).
