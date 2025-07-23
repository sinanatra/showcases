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
    exit()

session = requests.Session()
session.headers.update({"User-Agent": "Mozilla/5.0"})

new_rows = []
page = 1
stop_scraping = False

while not stop_scraping:
    page_url = url_template.format(page=page)
    print("🔎 Fetching:", page_url)
    try:
        response = session.get(page_url, timeout=30)
    except requests.exceptions.RequestException as e:
        print(f"⚠️ Request error: {e}")
        break

    if response.status_code == 500:
        print(f"⚠️ Page {page} returned 500. Skipping.")
        page += 1
        time.sleep(5)
        continue
    elif response.status_code != 200:
        print(f"⛔ Unexpected status: {response.status_code}")
        break

    soup = BeautifulSoup(response.text, 'html.parser')
    ul = soup.find("ul", class_=lambda x: x and "pbb-searchlist" in x)
    if not ul:
        print("⛔ No search results container found.")
        break

    items = ul.find_all("li")
    if not items:
        print("⛔ No results found on page.")
        break

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
            break

        p = li.find("p")
        date_str = ""
        if p:
            span = p.find("span")
            if span:
                span_text = span.get_text(separator=" ", strip=True)
                if "Artikel vom" in span_text:
                    date_str = span_text.split("Artikel vom")[-1].strip().split()[0]

        article_date = None
        if date_str:
            try:
                article_date = datetime.datetime.strptime(date_str, '%d.%m.%Y').date()
            except ValueError:
                pass

        if article_date and article_date <= max_date:
            print(f"🛑 Reached max date ({article_date.strftime('%d.%m.%Y')}). Stopping.")
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
            location = ""
            if ort_tag:
                location = ort_tag.get_text(strip=True)
            if landkreis_tag:
                location += ", " + landkreis_tag.get_text(strip=True) if location else landkreis_tag.get_text(strip=True)

        new_rows.append({
            "Title": title,
            "Date": date_str,
            "Location": location,
            "Text": text,
            "URL": article_url
        })

    page += 1
    time.sleep(3)

combined = existing_data + new_rows

if len(new_rows) > 0:
    with open(file_path, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow(["Title", "Date", "Location", "Text", "URL"])
        for r in combined:
            writer.writerow([r["Title"], r["Date"], r["Location"], r["Text"], r["URL"]])

print(f"\nScraping complete. {len(new_rows)} new articles saved.")