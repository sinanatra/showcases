# Polizei Data Scraper

Scripts to scrape and analyze police reports from Berlin, Brandenburg, and RSS feeds.

## Usage

1. Navigate to the `notebooks` folder:  
   ```bash
   cd notebooks
   ```

2. Scrape data:  
   ```bash
   python historical/brandenburg.py && python historical/berlin.py
   ```

3. Scrape RSS feeds:  
   ```bash
   python rss/rss.py
   ```

4. Analyze data:  
   ```bash
   python analysis.py
   ```