import pandas as pd
import glob
import os
import re
import difflib

input_dir = "data"
output_dir = "output"
os.makedirs(output_dir, exist_ok=True)

csv_files = glob.glob(os.path.join(input_dir, "*.csv"))
if not csv_files:
    raise FileNotFoundError(f"No CSV files found in {input_dir}")

dfs = []
for file in csv_files:
    df_temp = pd.read_csv(file)
    df_temp["SourceFile"] = os.path.basename(file)
    dfs.append(df_temp)

df = pd.concat(dfs, ignore_index=True)

df_text = (df['Title'].fillna('') + ' ' + df['Text'].fillna('')).str.lower()

keywords = [
    "volksverhetzung", "hitlergruß", "hakenkreuz",
    "nazi", "rechtsextremistisch", "fremdenfeindlich",
    "nationalsozialismus", "nationalsozialistisch",
    "rassismus", "antisemitismus", "homophobie",
    "transphobie", "sieg heil"
]
action_terms = [
    "graffiti", "angriff", "schlagen", "treten", "schubsen",
    "brandanschlag", "beleidigung", "versammlung", "online posts",
    "raubüberfall", "diebstahl", "körperverletzung",
    "tötungsversuch"
]

time_regex = re.compile(r"\b([0-2]?\d[:\.]?[0-5]?\d)\s*uhr")
date_regex = re.compile(r"\b(\d{1,2}[\./]\d{1,2}[\./]\d{2,4})\b")
age_regex = re.compile(r"\b(\d{1,3})(?:[- ]?jährig(?:e[rn]?)?|\sjahre alt)\b")
gender_regex = re.compile(r"\b(mann|frau|jugendlicher|jugendliche|mädchen|junge)\b")
street_regex = re.compile(r"\b[a-zäöüß]+(?:straße|platz|allee|ring)\b")

diff_threshold = 0.85

for col in [
    'RightWingRelated', 'KeywordMatch', 'ExtractedDate', 'ExtractedTime',
    'ExtractedAge', 'ExtractedGender', 'ExtractedAction', 'KeywordExtracted'
]:
    df[col] = None

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

# df['KeywordExtracted'] = None

for idx, text in df_text.items():
    kws = find_keywords(text, keywords, diff_threshold)
    related = bool(kws)
    df.at[idx, 'RightWingRelated'] = related
    df.at[idx, 'KeywordMatch'] = kws
    df.at[idx, 'KeywordExtracted'] = find_keywords_with_matches(text, keywords, diff_threshold)


    if related:
        date_match = date_regex.search(str(df.at[idx, 'Date']).lower())
        df.at[idx, 'ExtractedDate'] = date_match.group(1) if date_match else df.at[idx, 'Date']

        time_match = time_regex.findall(text)
        df.at[idx, 'ExtractedTime'] = time_match
        
        df.at[idx, 'ExtractedAge'] = age_regex.findall(text)
        df.at[idx, 'ExtractedGender'] = gender_regex.findall(text)
        df.at[idx, 'ExtractedAction'] = find_keywords(text, action_terms, diff_threshold)

out_path = os.path.join(output_dir, "merged_parsed_documents.csv")
parsed = df[df['RightWingRelated'] == True]
parsed.to_csv(out_path, index=False)

print(f"Saved parsed data to: {out_path}")