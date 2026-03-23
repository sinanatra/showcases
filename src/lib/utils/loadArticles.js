import * as d3 from "d3";
import { get } from "svelte/store";
import { articles, augmentKeywordMatch } from "$lib/stores";
import { parseList } from "$lib/utils/parseList";

export async function loadArticles() {
  if (get(articles).length) return;

  const raw = await d3.csv("/all_merged.csv");
  articles.set(
    raw.map((d) => ({
      ...d,
      KeywordMatch: augmentKeywordMatch(
        parseList(d.KeywordMatch),
        `${d.Title || ""} ${d.Text || ""}`
      ),
      ExtractedGender: parseList(d.ExtractedGender),
      ExtractedTime: parseList(d.ExtractedTime),
      ExtractedAction: parseList(d.ExtractedAction),
      ExtractedDistrict: parseList(d.ExtractedDistrict)[0] || d.Location || "",
      ExtractedDate: d.ExtractedDate || d.Date,
      Text: d.Text || "",
      Title: d.Title || "",
      URL: d.URL || "",
    }))
  );
}
