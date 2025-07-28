import feedparser
import csv
import os
from urllib.parse import urljoin
import datetime

feed_urls = [
    "https://www.berlin.de/polizei/polizeimeldungen/index.php/rss",  # Berlin
   
    "https://polizei.brandenburg.de/pressemeldungen/rss/region/57581" #Überregional
    "https://polizei.brandenburg.de/pressemeldungen/rss/region/421520" #Berlin
    "https://polizei.brandenburg.de/pressemeldungen/rss/region/35139" #Oberhavel
    "https://polizei.brandenburg.de/pressemeldungen/rss/region/35138" #Ostprignitz-Ruppin
    "https://polizei.brandenburg.de/pressemeldungen/rss/region/35137" #Prignitz
    "https://polizei.brandenburg.de/pressemeldungen/rss/region/56953" #Barnim
    "https://polizei.brandenburg.de/pressemeldungen/rss/region/18" #Frankfurt (Oder)
    "https://polizei.brandenburg.de/pressemeldungen/rss/region/56955" #Märkisch-Oderland
    "https://polizei.brandenburg.de/pressemeldungen/rss/region/56954" #Oder-Spree
    "https://polizei.brandenburg.de/pressemeldungen/rss/region/56952" #Uckermark
    "https://polizei.brandenburg.de/pressemeldungen/rss/region/30151" #Cottbus
    "https://polizei.brandenburg.de/pressemeldungen/rss/region/35140" #Dahme-Spreewald
    "https://polizei.brandenburg.de/pressemeldungen/rss/region/29985" #Elbe-Elster
    "https://polizei.brandenburg.de/pressemeldungen/rss/region/35141" #Oberspreewald-Lausitz
    "https://polizei.brandenburg.de/pressemeldungen/rss/region/56956" #Spree-Neiße
    "https://polizei.brandenburg.de/pressemeldungen/rss/region/57155" #Brandenburg an der Havel
    "https://polizei.brandenburg.de/pressemeldungen/rss/region/56957" #Havelland
    "https://polizei.brandenburg.de/pressemeldungen/rss/region/29912" #Potsdam
    "https://polizei.brandenburg.de/pressemeldungen/rss/region/29984" #Potsdam-Mittelmark
    "https://polizei.brandenburg.de/pressemeldungen/rss/region/56958" #Teltow-Fläming
]



file_path = 'data/police_rss.csv'
min_date = datetime.date(2016, 1, 1)  

existing_urls = set()
existing_data = []

if os.path.exists(file_path):
    with open(file_path, 'r', newline='', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            existing_data.append(row)
            existing_urls.add(row["URL"])

new_rows = []

for feed_url in feed_urls:
    print("🔎 Fetching:", feed_url)
    feed = feedparser.parse(feed_url)
    for entry in feed.entries:
        url = entry.get("link")
        if url in existing_urls:
            print(f"⏭️ Already saved: {url}")
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

        if ": " in title:
            parts = title.split(": ", 1)
            if "," in parts[0]:
                location = parts[0].strip()
                title = parts[1].strip()

        new_rows.append({
            "Title": title,
            "Date": date_str,
            "Location": location,
            "Text": summary,
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
