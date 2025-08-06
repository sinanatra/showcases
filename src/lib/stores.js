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

export const CANONICAL_KEYWORDS = Array.from(
  new Set(Object.values(KEYWORD_GROUPS))
).sort((a, b) => a.localeCompare(b, "de"));

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

  text: "",
  showOnlyLatest: false,
});

export function filterArticles(list, { district, keyword }, exclude) {
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
        const h = Number(String(t).split(":")[0]);
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

function parseDateLoose(v) {
  if (!v) return null;
  const s = String(v).trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const d = new Date(s);
    return isNaN(d) ? null : d;
  }

  const m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2}|\d{4})$/);
  if (m) {
    let [_, d, mo, y] = m;
    let year = Number(
      y.length === 2 ? (Number(y) >= 70 ? "19" + y : "20" + y) : y
    );
    const date = new Date(year, Number(mo) - 1, Number(d));
    return isNaN(date) ? null : date;
  }

  const dflt = new Date(s);
  return isNaN(dflt) ? null : dflt;
}

function toDateLike(v) {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d) ? null : d;
}
function getKeywordVariants(canon) {
  return Object.entries(KEYWORD_GROUPS)
    .filter(([, mapped]) => mapped === canon)
    .map(([variant]) => variant)
    .concat(canon);
}

const N = 200;
export const recent = derived(articles, ($articles) => {
  const list = Array.isArray($articles) ? $articles : [];
  const sorted = [...list].sort((a, b) => {
    const da = toDateLike(a.ExtractedDate || a.Date);
    const db = toDateLike(b.ExtractedDate || b.Date);
    if (da && db) return db - da;
    if (db) return 1;
    if (da) return -1;
    return 0;
  });
  return sorted.slice(0, N);
});

export const filteredData = derived(
  [recent, filters],
  ([$recent, $filters]) => {
    let out = $recent;

    if ($filters.district) {
      out = out.filter((a) => a.ExtractedDistrict === $filters.district);
    }

    if ($filters.keyword) {
      const variants = getKeywordVariants($filters.keyword);
      out = out.filter(
        (a) =>
          Array.isArray(a.KeywordMatch) &&
          a.KeywordMatch.some((k) => variants.includes(k))
      );
    }

    if ($filters.text) {
      const q = $filters.text.toLowerCase();
      out = out.filter((a) => (a.Text || "").toLowerCase().includes(q));
    }

    if ($filters.showOnlyLatest) {
      return out.length ? [out[0]] : [];
    }

    return out;
  }
);

export const availableKeywords = derived(
  [recent, filters],
  ([$recent, $filters]) => {
    let base = $recent;

    if ($filters.district) {
      base = base.filter((a) => a.ExtractedDistrict === $filters.district);
    }
    if ($filters.text) {
      const q = $filters.text.toLowerCase();
      base = base.filter((a) => (a.Text || "").toLowerCase().includes(q));
    }

    return Array.from(
      new Set(
        base
          .flatMap((a) => (Array.isArray(a.KeywordMatch) ? a.KeywordMatch : []))
          .map((k) => KEYWORD_GROUPS[k] || k)
      )
    )
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, "de"));
  }
);
