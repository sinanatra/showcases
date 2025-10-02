import pandas as pd
import glob
import os
import re
import difflib
from urllib.parse import urlsplit, urlunsplit
from datetime import datetime

input_dir = "data"
output_dir = "output"
os.makedirs(output_dir, exist_ok=True)

master_file = os.path.join(output_dir, "all_merged.csv")
if os.path.exists(master_file):
    df_all = pd.read_csv(master_file)
else:
    df_all = pd.DataFrame()

def normalize_url(u):
    if not isinstance(u, str) or not u:
        return ""
    try:
        s, n, p, q, _ = urlsplit(u.strip())
        return urlunsplit((s or "https", n.lower(), (p or "/").rstrip("/") or "/", q, ""))
    except Exception:
        return str(u).strip().lower()

def parse_date_loose(v):
    if pd.isna(v):
        return None
    s = str(v).strip()
    for fmt in ("%d.%m.%Y", "%Y-%m-%d"):
        try:
            return datetime.strptime(s[:10], fmt)
        except Exception:
            pass
    try:
        return datetime.fromisoformat(s[:10])
    except Exception:
        return None

def source_rank(name):
    s = (name or "").lower()
    if "brandenburg" in s:
        return 0
    if "berlin" in s:
        return 0
    if "results" in s:
        return 0
    if "rss" in s:
        return 1
    return 2

csv_files = glob.glob(os.path.join(input_dir, "*.csv"))
if not csv_files:
    raise FileNotFoundError(f"No CSV files found in {input_dir}")

dfs = []
for file in csv_files:
    df_temp = pd.read_csv(file)
    df_temp["SourceFile"] = os.path.basename(file)
    dfs.append(df_temp)

df = pd.concat(dfs, ignore_index=True)
df["URL_norm"] = df["URL"].fillna("").map(normalize_url)
df = df.sort_values(by=["URL_norm", "Date"], ascending=[True, False]).drop_duplicates(subset=["URL_norm"], keep="first")

if not df_all.empty:
    df_all["URL_norm"] = df_all["URL"].fillna("").map(normalize_url)

if not df_all.empty and "URL_norm" in df_all.columns and "URL_norm" in df.columns:
    df_new = df[~df["URL_norm"].isin(df_all["URL_norm"])].copy()
else:
    df_new = df.copy()

if df_new.empty:
    print("No new rows to parse.")
    raise SystemExit(0)

df_text = (df_new["Title"].fillna("") + " " + df_new["Text"].fillna("")).str.lower()

keywords = [
    "volksverhetzung", "hitlergruß", "hakenkreuz", "nazi", "rechtsextremistisch",
    "rechtsextremisch", "fremdenfeindlich", "islamophobie", "islamfeindlichkeit",
    "nationalsozialismus", "nationalsozialistisch", "nationalsozialistische",
    "rassismus", "rassistisch", "antisemitismus", "antisemitisch", "homophobie",
    "transphobie", "queerfeindlichkeit", "queerphobie", "sieg heil",
    "verfassungswidrig", "mit politischem hintergrund"
]

action_terms = [
    "graffiti", "angriff", "schlagen", "treten", "schubsen", "brandanschlag",
    "beleidigung", "versammlung", "online posts", "raubüberfall", "diebstahl",
    "körperverletzung", "tötungsversuch"
]

time_regex = re.compile(r"\b([0-2]?\d[:\.]?[0-5]?\d)\s*uhr")
date_regex = re.compile(r"\b(\d{1,2}[\./]\d{1,2}[\./]\d{2,4})\b")
age_regex = re.compile(r"\b(\d{1,3})(?:[- ]?jährig(?:e[rn]?)?|\sjahre alt)\b")
gender_regex = re.compile(r"\b(mann|frau|jugendlicher|jugendliche|mädchen|junge)\b")

diff_threshold = 0.85

for col in [
    "RightWingRelated", "KeywordMatch", "ExtractedDate", "ExtractedTime",
    "ExtractedAge", "ExtractedGender", "ExtractedAction", "KeywordExtracted"
]:
    df_new.loc[:, col] = None

def find_keywords(text, terms, threshold):
    tokens = set(re.findall(r"\w+", text))
    hits = []
    for term in terms:
        low = term.lower()
        if re.search(rf"\b{re.escape(low)}\b", text):
            hits.append(term)
        else:
            for tok in tokens:
                if abs(len(tok) - len(low)) <= 3 and difflib.SequenceMatcher(None, tok, low).ratio() >= threshold:
                    hits.append(term)
                    break
    return hits

def find_keywords_with_matches(text, terms, threshold):
    tokens = set(re.findall(r"\w+", text))
    hits = []
    for term in terms:
        low = term.lower()
        for m in re.finditer(rf"\b{re.escape(low)}\b", text):
            hits.append(m.group(0))
        for tok in tokens:
            if abs(len(tok) - len(low)) <= 3 and difflib.SequenceMatcher(None, tok, low).ratio() >= threshold:
                for m in re.finditer(rf"\b{re.escape(tok)}\b", text):
                    hits.append(m.group(0))
    return list(set(hits))

for idx, text in df_text.items():
    print(f"Processing row {idx+1} of {len(df_new)}")
    kws = find_keywords(text, keywords, diff_threshold)
    related = bool(kws)
    df_new.at[idx, "RightWingRelated"] = related
    df_new.at[idx, "KeywordMatch"] = kws
    df_new.at[idx, "KeywordExtracted"] = find_keywords_with_matches(text, keywords, diff_threshold)
    if related:
        date_match = date_regex.search(str(df_new.at[idx, "Date"]).lower())
        df_new.at[idx, "ExtractedDate"] = date_match.group(1) if date_match else df_new.at[idx, "Date"]
        time_match = time_regex.findall(text)
        df_new.at[idx, "ExtractedTime"] = time_match
        df_new.at[idx, "ExtractedAge"] = age_regex.findall(text)
        df_new.at[idx, "ExtractedGender"] = gender_regex.findall(text)
        df_new.at[idx, "ExtractedAction"] = find_keywords(text, action_terms, diff_threshold)

parsed = df_new[df_new["RightWingRelated"] == True].copy()
parsed = parsed.sort_values(by=["URL_norm", "Date"], ascending=[True, False]).drop_duplicates(subset=["URL_norm"], keep="first")

out_path = os.path.join(output_dir, "merged_parsed_documents.csv")
parsed.to_csv(out_path, index=False)
print(f"Saved parsed data to: {out_path}")

if "Topic" in parsed.columns:
    parsed = parsed.drop(columns=["Topic"])

frames = []
if not df_all.empty:
    frames.append(df_all)
frames.append(parsed)

df_combined = pd.concat(frames, ignore_index=True)
if "URL" not in df_combined.columns:
    df_combined["URL"] = ""

df_combined["URL_norm"] = df_combined["URL"].fillna("").map(normalize_url)
df_combined["RightWingRelated"] = df_combined.get("RightWingRelated", False).fillna(False).astype(bool)
df_combined["TextLen"] = df_combined.get("Text", "").fillna("").astype(str).str.len()
df_combined["HasExtractedDate"] = df_combined.get("ExtractedDate", "").fillna("") != ""
df_combined["ParsedDate"] = df_combined.apply(lambda r: parse_date_loose(r.get("ExtractedDate") or r.get("Date")), axis=1)
df_combined["SrcRank"] = df_combined.get("SourceFile", "").map(source_rank)

df_combined["Score"] = (
    df_combined["RightWingRelated"].astype(int) * 4
    + df_combined["HasExtractedDate"].astype(int) * 2
    + (df_combined["TextLen"] > 0).astype(int) * 1
)

df_combined = df_combined.sort_values(
    by=["URL_norm", "Score", "ParsedDate", "TextLen", "SrcRank"],
    ascending=[True, False, False, False, True]
)

df_combined = df_combined.drop_duplicates(subset=["URL_norm"], keep="first")
df_combined = df_combined.drop(columns=["URL_norm", "TextLen", "HasExtractedDate", "ParsedDate", "SrcRank", "Score"], errors="ignore")

df_combined.to_csv(master_file, index=False)
print(f"Updated master file: {master_file} (Total rows: {len(df_combined)})")
