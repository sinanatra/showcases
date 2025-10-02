import pandas as pd
from urllib.parse import urlsplit, urlunsplit
import os

def normalize_url(u: str) -> str:
    if not isinstance(u, str) or not u:
        return ""
    u = u.strip()
    try:
        scheme, netloc, path, query, frag = urlsplit(u)
        netloc = netloc.lower()
        path = path or "/"
        return urlunsplit((scheme or "https", netloc, path.rstrip("/") or "/", query, ""))
    except Exception:
        return u.lower().strip()

df_all = pd.read_csv("rss/output/all_merged.csv") if os.path.exists("rss/output/all_merged.csv") else pd.DataFrame()
df_extra = pd.read_csv("historical/output/merged_parsed_documents_with_topic.csv") if os.path.exists("historical/output/merged_parsed_documents_with_topic.csv") else pd.DataFrame()

if df_all.empty and df_extra.empty:
    pd.DataFrame().to_csv("output/all_merged_deduped.csv", index=False)
    print("Saved: output/all_merged_deduped.csv (0 rows)")
else:
    cols = sorted(set(df_all.columns).union(df_extra.columns))
    if not df_all.empty:
        for c in cols:
            if c not in df_all.columns:
                df_all[c] = None
    if not df_extra.empty:
        for c in cols:
            if c not in df_extra.columns:
                df_extra[c] = None
    df_combined = pd.concat([df_all[cols], df_extra[cols]], ignore_index=True)
    if "URL" not in df_combined.columns:
        df_combined["URL"] = ""
    df_combined["URL_norm"] = df_combined["URL"].fillna("").map(normalize_url)
    dedupe_keys = ["URL_norm"]
    for k in ["Title", "Date", "Location", "URL"]:
        if k in df_combined.columns:
            dedupe_keys.append(k)
    df_combined = df_combined.drop_duplicates(subset=dedupe_keys, keep="first")
    df_combined = df_combined.drop(columns=["URL_norm"], errors="ignore")
    os.makedirs("output", exist_ok=True)
    df_combined.to_csv("output/all_merged_deduped.csv", index=False)
    print(f"Saved: output/all_merged_deduped.csv ({len(df_combined)} rows)")
