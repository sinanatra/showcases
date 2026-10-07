"""Step 2 of the pipeline: filter ALL scraped reports down to the site's dataset.

Reads every raw CSV in pipeline/data and keeps the reports that match a term of
any category in categories.json -> static/all_merged.csv.

Every run re-scores the full scrape, so editing categories.json is enough: the
next run picks up reports scraped long ago that did not match back then.
"""
import csv
import difflib
import glob
import json
import os
import re
from datetime import datetime
from urllib.parse import urlsplit, urlunsplit

csv.field_size_limit(10**9)

here = os.path.dirname(os.path.abspath(__file__))
categories_file = os.path.join(here, "..", "categories.json")
input_dirs = [os.path.join(here, "data")]
master_file = os.path.join(here, "..", "static", "all_merged.csv")

columns = [
    "Title", "Date", "Location", "Text", "URL", "SourceFile",
    "RightWingRelated", "KeywordMatch", "ExtractedDate", "ExtractedTime",
    "ExtractedAge", "ExtractedGender", "ExtractedAction", "KeywordExtracted",
]

with open(categories_file, encoding="utf-8") as f:
    categories = json.load(f)["categories"]

keywords = []
for c in categories:
    for stem in c["terms"]:
        if stem.lower() not in keywords:
            keywords.append(stem.lower())

action_terms = [
    "graffiti", "angriff", "schlagen", "treten", "schubsen", "brandanschlag",
    "beleidigung", "versammlung", "online posts", "raubüberfall", "diebstahl",
    "körperverletzung", "tötungsversuch"
]

time_regex = re.compile(r"\b([0-2]?\d[:\.]?[0-5]?\d)\s*uhr")
date_regex = re.compile(r"\b(\d{1,2}[\./]\d{1,2}[\./]\d{2,4})\b")
age_regex = re.compile(r"\b(\d{1,3})(?:[- ]?jährig(?:e[rn]?)?|\sjahre alt)\b")
gender_regex = re.compile(r"\b(mann|frau|jugendlicher|jugendliche|mädchen|junge)\b")
token_regex = re.compile(r"\w+")

diff_threshold = 0.85


def stem_regex(stems):
    return re.compile(r"\b(?:" + "|".join(re.escape(s.lower()) for s in stems) + r")")


def normalize_url(u):
    if not isinstance(u, str) or not u:
        return ""
    try:
        s, n, p, q, _ = urlsplit(u.strip())
        return urlunsplit((s or "https", n.lower(), (p or "/").rstrip("/") or "/", q, ""))
    except Exception:
        return str(u).strip().lower()


def parse_date_loose(v):
    s = str(v or "").strip()
    for fmt in ("%d.%m.%Y", "%Y-%m-%d"):
        try:
            return datetime.strptime(s[:10], fmt)
        except Exception:
            pass
    return None


class Matcher:
    """Stem match (term + any word ending) or a close misspelling of the term."""

    def __init__(self, terms, threshold):
        self.terms = terms
        self.threshold = threshold
        self.any = stem_regex(terms) if terms else None
        self.patterns = [(t, re.compile(rf"\b{re.escape(t)}\w*")) for t in terms]
        self.fuzzy = {}

    def _fuzzy_terms(self, tok):
        if tok not in self.fuzzy:
            hits = []
            for term in self.terms:
                if abs(len(tok) - len(term)) > 3:
                    continue
                sm = difflib.SequenceMatcher(None, tok, term)
                if (
                    sm.real_quick_ratio() >= self.threshold
                    and sm.quick_ratio() >= self.threshold
                    and sm.ratio() >= self.threshold
                ):
                    hits.append(term)
            self.fuzzy[tok] = hits
        return self.fuzzy[tok]

    def find(self, text, tokens):
        """Returns (terms that matched, the exact strings found in the text)."""
        hit_terms, found = set(), set()
        if self.any and self.any.search(text):
            for term, pattern in self.patterns:
                matches = pattern.findall(text)
                if matches:
                    hit_terms.add(term)
                    found.update(matches)
        for tok in tokens:
            fuzzy_terms = self._fuzzy_terms(tok)
            if fuzzy_terms:
                hit_terms.update(fuzzy_terms)
                found.add(tok)
        return [t for t in self.terms if t in hit_terms], sorted(found)


def read_rows(path):
    with open(path, newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


raw_files = sorted(f for d in input_dirs for f in glob.glob(os.path.join(d, "*.csv")))
if not raw_files:
    raise FileNotFoundError(f"No CSV files found in {input_dirs}")

# Raw scrape first; the published dataset is only a fallback for reports whose
# raw row no longer exists (older RSS runs did not keep unmatched reports).
sources = [(os.path.basename(f), read_rows(f)) for f in raw_files]
raw_count = sum(len(rows) for _, rows in sources)
if os.path.exists(master_file):
    sources.append((None, read_rows(master_file)))

reports = {}
for source_name, rows in sources:
    for row in rows:
        url = row.get("URL") or ""
        key = normalize_url(url) or f"{row.get('Title')}|{row.get('Date')}"
        current = reports.get(key)
        if current and (current["Text"] or not row.get("Text")):
            continue
        reports[key] = {
            "Title": row.get("Title") or "",
            "Date": row.get("Date") or "",
            "Location": row.get("Location") or "",
            "Text": row.get("Text") or "",
            "URL": url,
            "SourceFile": source_name or row.get("SourceFile") or "",
        }

print(f"Scoring {len(reports)} reports ({raw_count} raw rows from {len(raw_files)} files)")

keyword_matcher = Matcher(keywords, diff_threshold)
action_matcher = Matcher(action_terms, diff_threshold)

parsed = []
for key, r in reports.items():
    text = f"{r['Title']} {r['Text']}".lower()
    tokens = set(token_regex.findall(text))

    kws, extracted = keyword_matcher.find(text, tokens)
    if not kws:
        continue

    date_match = date_regex.search(r["Date"].lower())
    r.update({
        "RightWingRelated": True,
        "KeywordMatch": kws,
        "ExtractedDate": date_match.group(1) if date_match else r["Date"],
        "ExtractedTime": time_regex.findall(text),
        "ExtractedAge": age_regex.findall(text),
        "ExtractedGender": gender_regex.findall(text),
        "ExtractedAction": action_matcher.find(text, tokens)[0],
        "KeywordExtracted": extracted,
    })
    parsed.append((parse_date_loose(r["ExtractedDate"]) or datetime.min, key, r))

# Stable order (newest first) so unchanged reports produce an identical file.
parsed.sort(key=lambda p: p[1])
parsed.sort(key=lambda p: p[0], reverse=True)

# The same report is sometimes published under several URLs (Brandenburg posts
# one text per region): keep one copy per text.
seen_texts = set()
unique = []
for item in parsed:
    text = re.sub(r"\s+", " ", item[2]["Text"]).strip().lower()
    if len(text) > 50:
        if text in seen_texts:
            continue
        seen_texts.add(text)
    unique.append(item)
print(f"Dropped {len(parsed) - len(unique)} reports that repeat another report's text")
parsed = unique

with open(master_file, "w", newline="", encoding="utf-8") as f:
    writer = csv.DictWriter(f, fieldnames=columns, lineterminator="\n")
    writer.writeheader()
    for _, _, r in parsed:
        writer.writerow(r)

for c in categories:
    terms = {t.lower() for t in c["terms"]}
    n = sum(1 for _, _, r in parsed if terms.intersection(r["KeywordMatch"]))
    print(f"  {c['id']}: {n}")
print(f"Wrote {os.path.normpath(master_file)} ({len(parsed)} reports)")
