import pandas as pd
import glob
import os
import re
import difflib

input_dir = "data"
output_dir = "output"
os.makedirs(output_dir, exist_ok=True)

master_file = os.path.join(output_dir, "all_merged.csv")
if os.path.exists(master_file):
    df_all = pd.read_csv(master_file)
else:
    df_all = pd.DataFrame()

csv_files = glob.glob(os.path.join(input_dir, "*.csv"))
if not csv_files:
    raise FileNotFoundError(f"No CSV files found in {input_dir}")

dfs = []
for file in csv_files:
    df_temp = pd.read_csv(file)
    df_temp["SourceFile"] = os.path.basename(file)
    dfs.append(df_temp)

df = pd.concat(dfs, ignore_index=True)

if not df_all.empty and "URL" in df_all.columns and "URL" in df.columns:
    df_new = df[~df["URL"].isin(df_all["URL"])]
else:
    df_new = df

if df_new.empty:
    print("No new rows to parse.")
    exit()

df_text = (df_new['Title'].fillna('') + ' ' + df_new['Text'].fillna('')).str.lower()

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
    'RightWingRelated', 'KeywordMatch', 'ExtractedDate', 'ExtractedTime',
    'ExtractedAge', 'ExtractedGender', 'ExtractedAction', 'KeywordExtracted'
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
    kws = find_keywords(text, keywords, diff_threshold)
    related = bool(kws)
    df_new.at[idx, 'RightWingRelated'] = related
    df_new.at[idx, 'KeywordMatch'] = kws
    df_new.at[idx, 'KeywordExtracted'] = find_keywords_with_matches(text, keywords, diff_threshold)

    if related:
        date_match = date_regex.search(str(df_new.at[idx, 'Date']).lower())
        df_new.at[idx, 'ExtractedDate'] = date_match.group(1) if date_match else df_new.at[idx, 'Date']

        time_match = time_regex.findall(text)
        df_new.at[idx, 'ExtractedTime'] = time_match

        df_new.at[idx, 'ExtractedAge'] = age_regex.findall(text)
        df_new.at[idx, 'ExtractedGender'] = gender_regex.findall(text)
        df_new.at[idx, 'ExtractedAction'] = find_keywords(text, action_terms, diff_threshold)

parsed = df_new[df_new['RightWingRelated'] == True].copy()

out_path = os.path.join(output_dir, "merged_parsed_documents.csv")
parsed.to_csv(out_path, index=False)
print(f"Saved parsed data to: {out_path}")

if 'Topic' in parsed.columns:
    parsed = parsed.drop(columns=['Topic'])

if not df_all.empty:
    for col in parsed.columns:
        if col not in df_all.columns:
            df_all[col] = None
    for col in df_all.columns:
        if col not in parsed.columns:
            parsed[col] = None
    df_combined = pd.concat([df_all, parsed[df_all.columns]], ignore_index=True)
    unique_cols = ["Title", "Date", "Location", "URL"]
    df_combined = df_combined.drop_duplicates(subset=unique_cols, keep="first")
else:
    df_combined = parsed

df_combined.to_csv(master_file, index=False)
print(f"Updated master file: {master_file} (Total rows: {len(df_combined)})")
