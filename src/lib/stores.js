import { writable, derived } from "svelte/store";
import { lang } from "$lib/i18n";

export const keywordsGroup = {
  antisem: "antisemitismus",
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
  homophob: "homophobie",
  homophobie: "homophobie",
  "mit politischem hintergrund": "mit politischem hintergrund",
  nazi: "nazi",
  queerfeindlichkeit: "queerfeindlichkeit",
  queerfeindlich: "queerfeindlichkeit",
  "sieg heil": "sieg heil",
  transphobie: "transphobie",
  transphob: "transphobie",
  verfassungswidrig: "verfassungswidrig",
  volksverhetzung: "volksverhetzung",
};

export const canonicalKeywords = Array.from(
  new Set(Object.values(keywordsGroup))
).sort((a, b) => a.localeCompare(b, "de"));

const genderMap = {
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
  region: "",
  yearMin: null,
  yearMax: null,
});

export const yearsExtent = derived(articles, ($articles) => {
  let min = Infinity,
    max = -Infinity;
  for (const a of Array.isArray($articles) ? $articles : []) {
    const d = parseDateLoose(a.ExtractedDate || a.Date);
    if (!d || isNaN(+d)) continue;
    const y = d.getFullYear();
    if (y < min) min = y;
    if (y > max) max = y;
  }
  if (!isFinite(min) || !isFinite(max)) {
    const y = new Date().getFullYear();
    return { min: y, max: y };
  }
  return { min, max };
});

export const effectiveYearRange = derived(
  [filters, yearsExtent],
  ([$filters, $extent]) => ({
    min: $filters.yearMin ?? $extent.min,
    max: $filters.yearMax ?? $extent.max,
  })
);

function getYearFromItem(a) {
  const d = parseDateLoose(a?.ExtractedDate || a?.Date);
  return d && !isNaN(+d) ? d.getFullYear() : null;
}

export function getKeywordVariants(canon) {
  if (!canon) return [];
  const variants = Object.entries(keywordsGroup)
    .filter(([, mapped]) => mapped === canon)
    .map(([variant]) => variant);
  return Array.from(new Set([...variants, canon]));
}

// german dates?
const dateCache = new Map();

export function parseDateLoose(v) {
  if (!v) return null;
  const raw = String(v).trim().replace(/,/g, "");
  if (!raw) return null;
  if (dateCache.has(raw)) return dateCache.get(raw);

  let d = null;

  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    const [, y, m, day] = iso;
    d = new Date(Number(y), Number(m) - 1, Number(day));
  } else {
    const de = raw.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2}|\d{4})$/);
    if (de) {
      let [, day, month, year] = de;
      let y = Number(year);
      if (year.length === 2) y += y >= 70 ? 1900 : 2000;
      d = new Date(y, Number(month) - 1, Number(day));
    }
  }

  if (!d || isNaN(+d)) {
    const tmp = new Date(raw);
    d = isNaN(+tmp) ? null : tmp;
  }

  dateCache.set(raw, d);
  return d;
}

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
        a.KeywordMatch.some((k) =>
          variants
            .map(String)
            .map((s) => s.toLowerCase())
            .includes(String(k).toLowerCase())
        )
      )
    )
      return false;
    return true;
  });
}

function splitOutsideQuotes(str, sepRegex) {
  const parts = [];
  let buf = "";
  let inQuotes = false;
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (!inQuotes && sepRegex.test(ch)) {
      if (buf.trim()) parts.push(buf.trim());
      buf = "";
    } else {
      buf += ch;
    }
  }
  if (buf.trim()) parts.push(buf.trim());
  return parts;
}

export function buildTextPredicate(query) {
  const raw = String(query || "").trim();
  if (!raw) return () => true;

  const orGroups = splitOutsideQuotes(raw, /,/)
    .map((g) => g.trim())
    .filter(Boolean)
    .map((g) =>
      splitOutsideQuotes(g, /\+/)
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean)
    )
    .filter((group) => group.length > 0);

  if (orGroups.length === 0) return () => true;

  return (item) => {
    const hay = String(item?.Text || "").toLowerCase();
    return orGroups.some((andTerms) => andTerms.every((t) => hay.includes(t)));
  };
}

export const availableDistricts = derived(
  [articles, filters],
  ([$articles, $filters]) => {
    const base = applyFilters($articles, { ...$filters, district: "" });
    return Array.from(
      new Set(base.map((a) => a.ExtractedDistrict).filter(Boolean))
    ).sort();
  }
);

export const availableGenders = derived(
  [articles, filters],
  ([$articles, $filters]) => {
    const base = applyFilters($articles, { ...$filters, gender: "" });
    const clusters = base
      .flatMap((a) =>
        Array.isArray(a.ExtractedGender) ? a.ExtractedGender : []
      )
      .map((g) => genderMap[String(g).toLowerCase()] || "Other");
    return Array.from(new Set(clusters)).filter(Boolean).sort();
  }
);

export const availableTimeClusters = derived(
  [articles, filters],
  ([$articles, $filters]) => {
    const base = applyFilters($articles, { ...$filters, timeCluster: "" });
    const set = new Set();
    base.forEach((a) =>
      (Array.isArray(a.ExtractedTime) ? a.ExtractedTime : []).forEach((t) => {
        const h = Number(String(t).split(":")[0]);
        set.add(
          h >= 6 && h < 12
            ? "Morning"
            : h >= 12 && h < 18
            ? "Afternoon"
            : h >= 18 && h < 24
            ? "Evening"
            : "Night"
        );
      })
    );
    return Array.from(set).sort();
  }
);

export const availableKeywords = derived(
  [articles, filters],
  ([$articles, $filters]) => {
    const base = applyFilters($articles, { ...$filters, keyword: "" });
    return Array.from(
      new Set(
        base
          .flatMap((a) => (Array.isArray(a.KeywordMatch) ? a.KeywordMatch : []))
          .map((k) => keywordsGroup[String(k).toLowerCase()] || String(k))
      )
    )
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, "de"));
  }
);

const N = 300;

export const recent = derived(articles, ($articles) => {
  const list = Array.isArray($articles) ? $articles : [];
  const sorted = [...list].sort((a, b) => {
    const da = parseDateLoose(a.ExtractedDate || a.Date);
    const db = parseDateLoose(b.ExtractedDate || b.Date);
    if (da && db) return db - da;
    if (db) return 1;
    if (da) return -1;
    return 0;
  });
  return sorted.slice(0, N);
});

export const filtered = derived([articles, filters], ([$articles, $filters]) =>
  applyFilters($articles, $filters)
);

export const filteredTopN = derived([recent, filters], ([$recent, $filters]) =>
  applyFilters($recent, $filters)
);

export const filteredData = derived(
  [recent, filters],
  ([$recent, $filters]) => {
    let out = $recent;

    if ($filters.region) {
      out = out.filter((a) => detectRegion(a) === $filters.region);
    }

    if ($filters.district) {
      out = out.filter((a) => a.ExtractedDistrict === $filters.district);
    }

    if ($filters.keyword) {
      const variants = getKeywordVariants($filters.keyword)
        .map(String)
        .map((s) => s.toLowerCase());
      out = out.filter(
        (a) =>
          Array.isArray(a.KeywordMatch) &&
          a.KeywordMatch.some((k) => variants.includes(String(k).toLowerCase()))
      );
    }

    if ($filters.text) {
      const q = $filters.text.toLowerCase();
      out = out.filter((a) => (a.Text || "").toLowerCase().includes(q));
    }

    if ($filters.gender) {
      out = out.filter((a) => {
        const gs = Array.isArray(a.ExtractedGender) ? a.ExtractedGender : [];
        const mapped = gs.map(
          (g) => genderMap[String(g).toLowerCase()] || "Other"
        );
        return mapped.includes($filters.gender);
      });
    }

    if ($filters.timeCluster) {
      out = out.filter((a) => {
        const times = Array.isArray(a.ExtractedTime) ? a.ExtractedTime : [];
        return times.some((t) => {
          const h = Number(String(t).split(":")[0]);
          const label =
            h >= 6 && h < 12
              ? "Morning"
              : h >= 12 && h < 18
              ? "Afternoon"
              : h >= 18 && h < 24
              ? "Evening"
              : "Night";
          return label === $filters.timeCluster;
        });
      });
    }

    if ($filters.showOnlyLatest) {
      return out.length ? [out[0]] : [];
    }
    return out;
  }
);

export const record = writable(false);

const GENDER_LABELS = {
  en: {
    "Adult Female": "Adult Female",
    "Adult Male": "Adult Male",
    Youth: "Youth",
    Other: "Other",
  },
  de: {
    "Adult Female": "Erwachsene Frau",
    "Adult Male": "Erwachsener Mann",
    Youth: "Jugendliche*r",
    Other: "Sonstiges",
  },
};

const TIME_LABELS = {
  en: {
    Morning: "Morning",
    Afternoon: "Afternoon",
    Evening: "Evening",
    Night: "Night",
  },
  de: {
    Morning: "Morgen",
    Afternoon: "Nachmittag",
    Evening: "Abend",
    Night: "Nacht",
  },
};

const KEYWORD_LABELS = {
  antisemitismus: { en: "Antisemitism", de: "Antisemitismus" },
  nationalsozialismus: { en: "National Socialism", de: "Nationalsozialismus" },
  rechtsextremismus: { en: "Right-wing extremism", de: "Rechtsextremismus" },
  rassismus: { en: "Racism", de: "Rassismus" },
  fremdenfeindlich: { en: "Xenophobic", de: "Fremdenfeindlich" },
  hakenkreuz: { en: "Swastika", de: "Hakenkreuz" },
  hitlergruß: { en: "Hitler salute", de: "Hitlergruß" },
  homophobie: { en: "Homophobia", de: "Homophobie" },
  "mit politischem hintergrund": {
    en: "With political background",
    de: "Mit politischem Hintergrund",
  },
  nazi: { en: "Nazi", de: "Nazi" },
  queerfeindlichkeit: { en: "Anti-queer", de: "Queerfeindlichkeit" },
  "sieg heil": { en: "Sieg Heil", de: "Sieg Heil" },
  transphobie: { en: "Transphobia", de: "Transphobie" },
  verfassungswidrig: { en: "Unconstitutional", de: "Verfassungswidrig" },
  volksverhetzung: { en: "Incitement of the people", de: "Volksverhetzung" },
};

export const availableGendersLabeled = derived(
  [availableGenders, lang],
  ([$availableGenders, $lang]) =>
    $availableGenders.map((v) => ({
      value: v,
      label: GENDER_LABELS[$lang]?.[v] ?? v,
    }))
);

export const availableTimeClustersLabeled = derived(
  [availableTimeClusters, lang],
  ([$availableTimeClusters, $lang]) =>
    $availableTimeClusters.map((v) => ({
      value: v,
      label: TIME_LABELS[$lang]?.[v] ?? v,
    }))
);

export const availableKeywordsLabeled = derived(
  [availableKeywords, lang],
  ([$availableKeywords, $lang]) =>
    $availableKeywords.map((canon) => ({
      value: canon,
      label: KEYWORD_LABELS[canon]?.[$lang] ?? canon,
    }))
);

function applyFilters(list, f) {
  const {
    district = "",
    keyword = "",
    gender = "",
    timeCluster = "",
    text = "",
    showOnlyLatest = false,
    region = "",
    yearMin = null,
    yearMax = null,
  } = f || {};

  let out = Array.isArray(list) ? list : [];

  if (region) out = out.filter((a) => detectRegion(a) === region);

  if (district) out = out.filter((a) => a.ExtractedDistrict === district);

  if (keyword) {
    const variants = getKeywordVariants(keyword).map((s) =>
      String(s).toLowerCase()
    );
    out = out.filter(
      (a) =>
        Array.isArray(a.KeywordMatch) &&
        a.KeywordMatch.some((k) => variants.includes(String(k).toLowerCase()))
    );
  }

  if (text) {
    const test = buildTextPredicate(text);
    out = out.filter((a) => test(a));
  }

  if (gender) {
    out = out.filter((a) => {
      const gs = Array.isArray(a.ExtractedGender) ? a.ExtractedGender : [];
      const mapped = gs.map(
        (g) => genderMap[String(g).toLowerCase()] || "Other"
      );
      return mapped.includes(gender);
    });
  }

  if (timeCluster) {
    out = out.filter((a) => {
      const times = Array.isArray(a.ExtractedTime) ? a.ExtractedTime : [];
      return times.some((t) => {
        const h = Number(String(t).split(":")[0]);
        const label =
          h >= 6 && h < 12
            ? "Morning"
            : h >= 12 && h < 18
            ? "Afternoon"
            : h >= 18 && h < 24
            ? "Evening"
            : "Night";
        return label === timeCluster;
      });
    });
  }

  if (yearMin != null || yearMax != null) {
    out = out.filter((a) => {
      const y = getYearFromItem(a);
      if (y == null) return false; // exclude undated items
      if (yearMin != null && y < yearMin) return false;
      if (yearMax != null && y > yearMax) return false;
      return true;
    });
  }

  if (showOnlyLatest) {
    const sorted = [...out].sort((a, b) => {
      const da = parseDateLoose(a.ExtractedDate || a.Date);
      const db = parseDateLoose(b.ExtractedDate || b.Date);
      if (da && db) return db - da;
      if (db) return 1;
      if (da) return -1;
      return 0;
    });
    return sorted.length ? [sorted[0]] : [];
  }

  return out;
}

export const availableRegions = derived(articles, ($articles) => {
  const set = new Set(
    (Array.isArray($articles) ? $articles : [])
      .map(detectRegion)
      .filter(Boolean)
  );
  return Array.from(set).sort(); // ["Berlin","Brandenburg"]
});

function detectRegion(a) {
  const src = String(a?.SourceFile || "").toLowerCase();
  const url = String(a?.URL || "").toLowerCase();
  if (src.includes("berlin") || url.includes("berlin.de")) return "Berlin";
  if (src.includes("brandenburg") || url.includes("brandenburg.de"))
    return "Brandenburg";
  return "";
}
