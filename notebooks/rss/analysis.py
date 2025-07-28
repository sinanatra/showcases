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

right_keywords = [
    "volksverhetzung", "hitlergruß", "hakenkreuz", "nazi", "rechtsextremistisch",
    "rechtsextremisch", "fremdenfeindlich", "islamophobie", "islamfeindlichkeit",
    "nationalsozialismus", "nationalsozialistisch", "nationalsozialistische",
    "rassismus", "rassistisch", "antisemitismus", "antisemitisch",
    "homophobie", "transphobie", "queerfeindlichkeit", "queerphobie",
    "sieg heil", "verfassungswidrig", "mit politischem hintergrund"
]

# For demonstration, just a few generic crime terms:
general_crime_keywords = [
    "diebstahl", "einbruch", "raub", "betrug", "körpverletzung", "brandstiftung",
    "überfall", "unfall", "drogen", "waffe", "drohung"
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

for col in [
    'RightWingRelated', 'GeneralCrimeRelated', 'KeywordMatch', 'ExtractedDate', 'ExtractedTime',
    'ExtractedAge', 'ExtractedGender', 'ExtractedAction', 'KeywordExtracted', 'Topic'
]:
    df[col] = None

for idx, text in df_text.items():
    right_kws = find_keywords(text, right_keywords, diff_threshold)
    general_kws = find_keywords(text, general_crime_keywords, diff_threshold)
    related_right = bool(right_kws)
    related_general = bool(general_kws)
    topic = "Other"
    if related_right:
        topic = "RightWing"
    elif related_general:
        topic = "GeneralCrime"
    df.at[idx, 'RightWingRelated'] = related_right
    df.at[idx, 'GeneralCrimeRelated'] = related_general
    df.at[idx, 'Topic'] = topic
    df.at[idx, 'KeywordMatch'] = right_kws + general_kws
    df.at[idx, 'KeywordExtracted'] = find_keywords_with_matches(text, right_keywords+general_crime_keywords, diff_threshold)

    if related_right or related_general:
        date_match = date_regex.search(str(df.at[idx, 'Date']).lower())
        df.at[idx, 'ExtractedDate'] = date_match.group(1) if date_match else df.at[idx, 'Date']
        time_match = time_regex.findall(text)
        df.at[idx, 'ExtractedTime'] = time_match
        df.at[idx, 'ExtractedAge'] = age_regex.findall(text)
        df.at[idx, 'ExtractedGender'] = gender_regex.findall(text)
        df.at[idx, 'ExtractedAction'] = find_keywords(text, action_terms, diff_threshold)

out_path = os.path.join(output_dir, "merged_topic_documents.csv")
df.to_csv(out_path, index=False)
print(f"Saved classified data to: {out_path}")