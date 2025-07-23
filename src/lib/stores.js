import { writable, derived } from "svelte/store";

export const KEYWORD_GROUPS = {
  antisemitisch: "antisemitismus",
  antisemitismus: "antisemitismus",
  nationalsozialismus: "nationalsozialismus",
  nationalsozialistisch: "nationalsozialismus",
  nationalsozialistische: "nationalsozialismus",
  rechtsextremisch: "rechtsextremismus",
  rechtsextremistisch: "rechtsextremismus",
  rassistisch: "rassismus",
  rassismus: "rassismus",
  fremdenfeindlich: "fremdenfeindlich",
  hakenkreuz: "hakenkreuz",
  hitlergruß: "hitlergruß",
  homophobie: "homophobie",
  "mit politischem hintergrund": "mit politischem hintergrund",
  nazi: "nazi",
  queerfeindlichkeit: "queerfeindlichkeit",
  "sieg heil": "sieg heil",
  transphobie: "transphobie",
  verfassungswidrig: "verfassungswidrig",
  volksverhetzung: "volksverhetzung",
};

const GENDER_MAP = {
  frau: "Adult Female",
  mann: "Adult Male",
  junge: "Youth",
  mädchen: "Youth",
  jugendliche: "Youth",
};

export const articles = writable([]);
export const filters = writable({
  district: "",
  keyword: "",
  gender: "",
  timeCluster: "",
});

function getKeywordVariants(canon) {
  return Object.entries(KEYWORD_GROUPS)
    .filter(([variant, mapped]) => mapped === canon)
    .map(([variant]) => variant)
    .concat(canon);
}

export function filterArticles(
  list,
  { district, keyword, gender, timeCluster },
  exclude
) {
  const variants = keyword ? getKeywordVariants(keyword) : [];
  return (Array.isArray(list) ? list : []).filter((a) => {
    if (exclude !== "district" && district && a.ExtractedDistrict !== district)
      return false;
    if (
      exclude !== "keyword" &&
      keyword &&
      !(
        Array.isArray(a.KeywordMatch) &&
        a.KeywordMatch.some((k) => variants.includes(k))
      )
    )
      return false;
    return true;
  });
}

export const availableKeywords = derived(
  [articles, filters],
  ([$articles, $filters]) => {
    const filtered = filterArticles($articles, $filters, "keyword");
    return Array.from(
      new Set(
        filtered
          .flatMap((a) => (Array.isArray(a.KeywordMatch) ? a.KeywordMatch : []))
          .map((k) => KEYWORD_GROUPS[k] || k)
      )
    )
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, "de"));
  }
);

export const availableDistricts = derived(
  [articles, filters],
  ([$articles, $filters]) => {
    const filtered = filterArticles($articles, $filters, "district");
    return Array.from(
      new Set(filtered.map((a) => a.ExtractedDistrict).filter(Boolean))
    ).sort();
  }
);

export const availableGenders = derived(
  [articles, filters],
  ([$articles, $filters]) => {
    const filtered = filterArticles($articles, $filters, "gender");
    const clusters = filtered
      .flatMap((a) =>
        Array.isArray(a.ExtractedGender) ? a.ExtractedGender : []
      )
      .map((g) => GENDER_MAP[g] || "Other");
    return Array.from(new Set(clusters)).filter(Boolean).sort();
  }
);

export const availableTimeClusters = derived(
  [articles, filters],
  ([$articles, $filters]) => {
    const filtered = filterArticles($articles, $filters, "timeCluster");
    const clusters = new Set();
    filtered.forEach((a) =>
      (Array.isArray(a.ExtractedTime) ? a.ExtractedTime : []).forEach((t) => {
        const h = Number(t.split(":")[0]);
        const label =
          h >= 6 && h < 12
            ? "Morning"
            : h >= 12 && h < 18
            ? "Afternoon"
            : h >= 18 && h < 24
            ? "Evening"
            : "Night";
        clusters.add(label);
      })
    );
    return Array.from(clusters).sort();
  }
);

export const filtered = derived([articles, filters], ([$articles, $filters]) =>
  filterArticles(Array.isArray($articles) ? $articles : [], $filters, null)
);

export const record = writable(false);
