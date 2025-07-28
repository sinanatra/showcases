import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin
import urllib.robotparser
import csv
import time
import os
import datetime

base_url = "https://www.berlin.de"
years = list(range(2014, 2026))
file_path = 'data/berlin_police_results.csv'

existing_urls = set()
existing_rows = []
if os.path.exists(file_path):
    with open(file_path, 'r', encoding='utf-8', newline='') as f:
        reader = csv.DictReader(f)
        for row in reader:
            existing_urls.add(row["URL"])
            existing_rows.append(row)

rp = urllib.robotparser.RobotFileParser()
rp.set_url(urljoin(base_url, "robots.txt"))
rp.read()

session = requests.Session()
session.headers.update({"User-Agent": "Mozilla/5.0"})

new_rows = []

for year in years:
    year_url = f"https://www.berlin.de/polizei/polizeimeldungen/archiv/{year}/"
    if not rp.can_fetch("*", year_url):
        print(f"⛔ Scraping not allowed by robots.txt for {year_url}.")
        continue

    page = 1
    stop_scraping = False

    while not stop_scraping:
        page_url = year_url if page == 1 else f"{year_url}?page_at_1_0={page}#headline_1_0"
        print(f"🔎 Fetching: {page_url}")
        try:
            res = session.get(page_url, timeout=30)
            if res.status_code != 200:
                print("⛔ Stopped. No more pages.")
                break
        except Exception as e:
            print(f"⚠️ Error fetching page {page}: {e}")
            break

        soup = BeautifulSoup(res.text, "html.parser")
        items = soup.select("ul.list--tablelist > li")
        if not items:
            print("📭 No more list items found.")
            break

        for item in items:
            date_div = item.find("div", class_="date")
            text_div = item.find("div", class_="text")
            if not date_div or not text_div:
                continue

            url_rel = text_div.find("a")["href"]
            article_url = urljoin(base_url, url_rel)
            if article_url in existing_urls:
                stop_scraping = True
                print("🛑 Reached already-saved article, stopping.")
                break

            title = text_div.find("a").get_text(strip=True)
            date_str = date_div.get_text(strip=True).split(" ")[0]
            try:
                article_date = datetime.datetime.strptime(date_str, "%d.%m.%Y").date()
            except ValueError:
                continue

            location = ""
            loc_span = text_div.find("span", class_="category")
            if loc_span and "Ereignisort:" in loc_span.text:
                location = loc_span.text.replace("Ereignisort:", "").strip()

            try:
                art_res = session.get(article_url, timeout=30)
                if art_res.status_code != 200:
                    raise Exception("Bad status")
                art_soup = BeautifulSoup(art_res.text, "html.parser")
                content = art_soup.find("div", class_="textile")
                text = content.get_text(separator="\n", strip=True) if content else ""
            except Exception as e:
                print(f"⚠️ Failed to fetch article: {article_url} – {e}")
                continue

            print(f"📍 {location} – {date_str} – {title}")
            new_rows.append({
                "Title": title,
                "Date": date_str,
                "Location": location,
                "Text": text,
                "URL": article_url
            })

        page += 1
        time.sleep(2)

all_rows = existing_rows + new_rows
if len(new_rows) > 0:
    with open(file_path, 'w', encoding='utf-8', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=["Title", "Date", "Location", "Text", "URL"])
        writer.writeheader()
        writer.writerows(all_rows)

print(f"\nScraping complete. {len(new_rows)} new articles saved.")