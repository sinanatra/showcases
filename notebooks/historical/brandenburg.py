import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin
import urllib.robotparser
import csv
import time
import os
import datetime

base_url = "https://polizei.brandenburg.de"
url_template = f"{base_url}/suche/typ/null/kategorie/Kriminalit%C3%A4t/{{page}}/1?reset=1"
file_path = 'data/brandenburg_police_results.csv'
max_date = datetime.date(2019, 1, 1)

start_page = 4279 #459                    
max_page = 5000                
max_empty = 10        
sleep_between = 0.3           


existing_urls = set()
existing_data = []

if os.path.exists(file_path):
    with open(file_path, 'r', newline='', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            existing_data.append(row)
            existing_urls.add(row["URL"])

rp = urllib.robotparser.RobotFileParser()
rp.set_url(urljoin(base_url, "robots.txt"))
rp.read()
if not rp.can_fetch("*", url_template.format(page=1)):
    print("⛔ Scraping disallowed by robots.txt")
    raise SystemExit(1)

session = requests.Session()
session.headers.update({"User-Agent": "Mozilla/5.0"})

new_rows = []
page = start_page
stop_scraping = False
consecutive_empty = 0

while not stop_scraping and page - start_page < max_page:
    page_url = url_template.format(page=page)
    print("🔎 Fetching:", page_url)
    try:
        response = session.get(page_url, timeout=30)
    except requests.exceptions.RequestException as e:
        print(f"⚠️ Request error on page {page}: {e}")
        
        consecutive_empty += 1
        if consecutive_empty >= max_empty:
            print(f"🛑 Hit {max_empty} empty/error pages in a row. Stopping.")
            break
        page += 1
        time.sleep(sleep_between)
        continue

    if response.status_code == 500:
        print(f"⚠️ Page {page} returned 500. Skipping.")
        consecutive_empty += 1
        if consecutive_empty >= max_empty:
            print(f"🛑 Hit {max_empty} empty/error pages in a row. Stopping.")
            break
        page += 1
        time.sleep(sleep_between)
        continue
    elif response.status_code != 200:
        print(f"⛔ Unexpected status {response.status_code} on page {page}. Treating as empty.")
        consecutive_empty += 1
        if consecutive_empty >= max_empty:
            print(f"🛑 Hit {max_empty} empty/error pages in a row. Stopping.")
            break
        page += 1
        time.sleep(sleep_between)
        continue

    soup = BeautifulSoup(response.text, 'html.parser')

    
    ul = soup.find("ul", class_=lambda x: x and "pbb-searchlist" in x)
    items = ul.find_all("li") if ul else soup.select("ul.pbb-searchlist li")

    if not items:
        print(f"⚠️ No results on page {page}. Skipping ahead.")
        consecutive_empty += 1
        if consecutive_empty >= max_empty:
            print(f"🛑 Hit {max_empty} empty/error pages in a row. Stopping.")
            break
        page += 1
        time.sleep(sleep_between)
        continue

    
    consecutive_empty = 0

    for li in items:
        h4 = li.find("h4")
        a = h4.find("a") if h4 else None
        if not a:
            continue

        strong = a.find("strong")
        title = strong.get_text(strip=True) if strong else a.get_text(strip=True)
        article_url = urljoin(base_url, a.get("href"))

        if article_url in existing_urls:
            print(f"⏭️ Already saved: {article_url}")
            continue  

        
        date_str = ""
        p = li.find("p")
        if p:
            span = p.find("span")
            if span:
                span_text = span.get_text(" ", strip=True)
                if "Artikel vom" in span_text:
                    parts = span_text.split("Artikel vom")[-1].strip().split()
                    if parts:
                        date_str = parts[0]

        article_date = None
        if date_str:
            try:
                article_date = datetime.datetime.strptime(date_str, '%d.%m.%Y').date()
            except ValueError:
                article_date = None

        if article_date and article_date <= max_date:
            print(f"🛑 Reached max date ({article_date.strftime('%d.%m.%Y')}) on page {page}. Stopping.")
            stop_scraping = True
            break

        
        try:
            art_response = session.get(article_url, timeout=30)
        except requests.exceptions.RequestException as e:
            print(f"⚠️ Article fetch failed: {e}")
            continue

        if art_response.status_code != 200:
            text = ""
            location = ""
        else:
            art_soup = BeautifulSoup(art_response.text, 'html.parser')
            content = art_soup.find("div", class_="pbb-article-text")
            text = content.get_text(separator="\n", strip=True) if content else ""

            ort_tag = art_soup.find("p", class_="pbb-ort")
            landkreis_tag = art_soup.find("p", class_="pbb-landkreis")
            parts_loc = []
            if ort_tag:
                parts_loc.append(ort_tag.get_text(strip=True))
            if landkreis_tag:
                parts_loc.append(landkreis_tag.get_text(strip=True))
            location = ", ".join(p for p in parts_loc if p)

        new_rows.append({
            "Title": title,
            "Date": date_str,
            "Location": location,
            "Text": text,
            "URL": article_url
        })

    if stop_scraping:
        break

    page += 1
    time.sleep(sleep_between)

combined = existing_data + new_rows

if new_rows:
    with open(file_path, 'w', newline='', encoding='utf-8') as f:
        fieldnames = ["Title", "Date", "Location", "Text", "URL"]
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for r in combined:
            writer.writerow({k: r.get(k, "") for k in fieldnames})

print(f"\nScraping complete. {len(new_rows)} new articles saved. Last attempted page {page}.")
