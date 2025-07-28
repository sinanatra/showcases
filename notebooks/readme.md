# Polizei Data Scraper

Scripts to scrape and analyze police reports from Berlin and Brandenburg police websites, as well as RSS feeds. The data is saved in CSV format for further processing.

## Usage

1. Mind Captchas, load the website manually before running the script.  
   The project is organized into two main folders:  
   - `notebooks/historical/` for historical data scraping.  
   - `notebooks/rss/` for RSS feed scraping.

2. **Scrape Berlin Reports**  
   Run:  
   ```bash
   python notebooks/historical/berlin.py
   ```
   Output: `notebooks/historical/data/berlin_police_results.csv`

3. **Scrape Brandenburg Reports**  
   Run:  
   ```bash
   python notebooks/historical/brandenburg.py
   ```
   Output: `notebooks/historical/data/brandenburg_police_results.csv`

4. **Scrape RSS Feeds**  
   Run:  
   ```bash
   python notebooks/rss/rss.py
   ```
   Output: `notebooks/rss/data/police_rss.csv`

5. **Analyze Data**  
   Combine and analyze data with:  
   
   ```analysis.py```

   Output: Combined data in `output/`.