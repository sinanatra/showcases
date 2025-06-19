import { writable, derived } from "svelte/store";

export const articles = writable([]);

export const filters = writable({
  district: "",
  keyword: "",
  gender: "",
  timeCluster: "",
});

const GENDER_MAP = {
  frau: "Adult Female",
  mann: "Adult Male",
  junge: "Youth",
  mädchen: "Youth",
  jugendliche: "Youth",
};

function filterArticles(
  list,
  { district, keyword, gender, timeCluster },
  exclude
) {
  return (Array.isArray(list) ? list : []).filter((a) => {
    if (exclude !== "district" && district && a.ExtractedDistrict !== district)
      return false;
    if (
      exclude !== "keyword" &&
      keyword &&
      !(Array.isArray(a.KeywordMatch) && a.KeywordMatch.includes(keyword))
    )
      return false;

    if (exclude !== "gender" && gender) {
      const clusters = (
        Array.isArray(a.ExtractedGender) ? a.ExtractedGender : []
      ).map((g) => GENDER_MAP[g] || "Other");
      if (!clusters.includes(gender)) return false;
    }

    if (exclude !== "timeCluster" && timeCluster) {
      const clusters = (
        Array.isArray(a.ExtractedTime) ? a.ExtractedTime : []
      ).map((t) => {
        const h = Number(t.split(":")[0]);
        if (h >= 6 && h < 12) return "Morning";
        if (h >= 12 && h < 18) return "Afternoon";
        if (h >= 18 && h < 24) return "Evening";
        return "Night";
      });
      if (!clusters.includes(timeCluster)) return false;
    }

    return true;
  });
}

export const availableDistricts = derived(
  [articles, filters],
  ([$articles, $filters]) => {
    const filtered = filterArticles($articles, $filters, "district");
    return Array.from(
      new Set(filtered.map((a) => a.ExtractedDistrict).filter(Boolean))
    ).sort();
  }
);

export const availableKeywords = derived(
  [articles, filters],
  ([$articles, $filters]) => {
    const filtered = filterArticles($articles, $filters, "keyword");
    return Array.from(
      new Set(
        filtered.flatMap((a) =>
          Array.isArray(a.KeywordMatch) ? a.KeywordMatch : []
        )
      )
    )
      .filter(Boolean)
      .sort();
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
