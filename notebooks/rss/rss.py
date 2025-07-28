import requests
import feedparser
from bs4 import BeautifulSoup
import csv
import os
import datetime
from urllib.parse import urljoin

berlin_base_url = "https://www.berlin.de"
brandenburg_base_url = "https://polizei.brandenburg.de"

feed_urls = [
    # Berlin
    "https://www.berlin.de/polizei/polizeimeldungen/index.php/rss",
    # Brandenburg (all districts)
    "https://polizei.brandenburg.de/pressemeldungen/rss/region/57581",
    "https://polizei.brandenburg.de/pressemeldungen/rss/region/421520",
    "https://polizei.brandenburg.de/pressemeldungen/rss/region/35139",
    "https://polizei.brandenburg.de/pressemeldungen/rss/region/35138",
    "https://polizei.brandenburg.de/pressemeldungen/rss/region/35137",
    "https://polizei.brandenburg.de/pressemeldungen/rss/region/56953",
    "https://polizei.brandenburg.de/pressemeldungen/rss/region/18",
    "https://polizei.brandenburg.de/pressemeldungen/rss/region/56955",
    "https://polizei.brandenburg.de/pressemeldungen/rss/region/56954",
    "https://polizei.brandenburg.de/pressemeldungen/rss/region/56952",
    "https://polizei.brandenburg.de/pressemeldungen/rss/region/30151",
    "https://polizei.brandenburg.de/pressemeldungen/rss/region/35140",
    "https://polizei.brandenburg.de/pressemeldungen/rss/region/29985",
    "https://polizei.brandenburg.de/pressemeldungen/rss/region/35141",
    "https://polizei.brandenburg.de/pressemeldungen/rss/region/56956",
    "https://polizei.brandenburg.de/pressemeldungen/rss/region/57155",
    "https://polizei.brandenburg.de/pressemeldungen/rss/region/56957",
    "https://polizei.brandenburg.de/pressemeldungen/rss/region/29912",
    "https://polizei.brandenburg.de/pressemeldungen/rss/region/29984",
    "https://polizei.brandenburg.de/pressemeldungen/rss/region/56958",
]

file_path = 'data/police_rss_fullscrape.csv'
min_date = datetime.date(2016, 1, 1)  

existing_urls = set()
existing_data = []
if os.path.exists(file_path):
    with open(file_path, 'r', newline='', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            existing_data.append(row)
            existing_urls.add(row["URL"])

session = requests.Session()
session.headers.update({"User-Agent": "Mozilla/5.0"})

def scrape_berlin_article(url):
    try:
        res = requests.get(url, timeout=30)
        if res.status_code != 200:
            return "", ""
        soup = BeautifulSoup(res.text, "html.parser")
        content = soup.find("div", class_="textile")
        text = content.get_text(separator="\n", strip=True) if content else ""
        location_tag = soup.find("p", class_="polizeimeldung", title="Ereignisort")
        location = location_tag.get_text(strip=True) if location_tag else ""
        return text, location
    except Exception as e:
        print(f"Berlin article fetch failed: {e}")
        return "", ""

def scrape_brandenburg_article(url):
    try:
        res = session.get(url, timeout=30)
        if res.status_code != 200:
            return "", ""
        soup = BeautifulSoup(res.text, 'html.parser')
        content = soup.find("div", class_="pbb-article-text")
        text = content.get_text(separator="\n", strip=True) if content else ""
        ort_tag = soup.find("p", class_="pbb-ort")
        landkreis_tag = soup.find("p", class_="pbb-landkreis")
        location = ""
        if ort_tag:
            location = ort_tag.get_text(strip=True)
        if landkreis_tag:
            location += ", " + landkreis_tag.get_text(strip=True) if location else landkreis_tag.get_text(strip=True)
        return text, location
    except Exception as e:
        print(f"Brandenburg article fetch failed: {e}")
        return "", ""

new_rows = []

for feed_url in feed_urls:
    print("Fetching RSS:", feed_url)
    feed = feedparser.parse(feed_url)
    is_berlin = 'berlin.de' in feed_url
    is_brandenburg = 'brandenburg.de' in feed_url
    base_url = berlin_base_url if is_berlin else brandenburg_base_url

    for entry in feed.entries:
        url = entry.get("link")
        if not url.startswith("http"):
            url = urljoin(base_url, url)
        if url in existing_urls:
            print(f"Already saved: {url}")
            continue

        pub_date = entry.get("published_parsed")
        if pub_date:
            article_date = datetime.date(pub_date.tm_year, pub_date.tm_mon, pub_date.tm_mday)
            if article_date < min_date:
                continue
            date_str = article_date.strftime("%d.%m.%Y")
        else:
            date_str = ""

        title = entry.get("title", "")
        summary = entry.get("summary", "")

        location = ""
        t_title = title
        if ": " in title:
            parts = title.split(": ", 1)
            if "," in parts[0]:
                location = parts[0].strip()
                t_title = parts[1].strip()

        article_text, article_location = ("", "")
        if is_berlin:
            article_text, article_location = scrape_berlin_article(url)
        elif is_brandenburg:
            article_text, article_location = scrape_brandenburg_article(url)

        final_text = article_text if article_text else summary
        final_location = article_location if article_location else location

        new_rows.append({
            "Title": t_title,
            "Date": date_str,
            "Location": final_location,
            "Text": final_text,
            "URL": url
        })
        existing_urls.add(url)

print(f"\nFetched {len(new_rows)} new articles.")

combined = existing_data + new_rows
if len(new_rows) > 0:
    with open(file_path, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=["Title", "Date", "Location", "Text", "URL"])
        writer.writeheader()
        for r in combined:
            writer.writerow(r)

print(f"{len(new_rows)} new articles saved.")
