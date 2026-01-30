import { readable, writable, derived } from "svelte/store";
import { lang } from "$lib/i18n";
import { browser } from "$app/environment";

export const keywordsGroup = {
  antisem: "antisemitismus",
  antisemitisch: "antisemitismus",
  antisemitismus: "antisemitismus",

  islamophobie: "islamfeindlichkeit",
  islamfeindlichkeit: "islamfeindlichkeit",
  islamfeindlich: "islamfeindlichkeit",
  islamophobia: "islamfeindlichkeit",
  islamophob: "islamfeindlichkeit",
  islamophobe: "islamfeindlichkeit",
  islamophoben: "islamfeindlichkeit",
  muslimfeindlich: "islamfeindlichkeit",
  muslimfeindlichkeit: "islamfeindlichkeit",
  antimuslimisch: "islamfeindlichkeit",
  "anti-muslimisch": "islamfeindlichkeit",
  "anti muslimisch": "islamfeindlichkeit",
  antiislamisch: "islamfeindlichkeit",
  "anti-islamisch": "islamfeindlichkeit",
  "anti islamisch": "islamfeindlichkeit",

  rassistisch: "fremdenfeindlichkeit",
  rassismus: "fremdenfeindlichkeit",
  fremdenfeindlich: "fremdenfeindlichkeit",
  fremdenfeindlichkeit: "fremdenfeindlichkeit",

  rechtsextremisch: "rechtsextremismus",
  rechtsextremistisch: "rechtsextremismus",
  rechtsextremismus: "rechtsextremismus",
  hakenkreuz: "rechtsextremismus",
  hitlergruß: "rechtsextremismus",
  "sieg heil": "rechtsextremismus",
  nazi: "rechtsextremismus",
  nationalsozialismus: "rechtsextremismus",
  nationalsozialistisch: "rechtsextremismus",
  nationalsozialistische: "rechtsextremismus",

  verfassungswidrig: "rechtsextremismus",
  "mit politischem hintergrund": "rechtsextremismus",

  homophob: "queerfeindlichkeit",
  homophobie: "queerfeindlichkeit",
  queerfeindlichkeit: "queerfeindlichkeit",
  queerfeindlich: "queerfeindlichkeit",
  queerphobie: "queerfeindlichkeit",
  queerphobia: "queerfeindlichkeit",
  transphobie: "queerfeindlichkeit",
  transphob: "queerfeindlichkeit",

  volksverhetzung: "volksverhetzung",
};

// export const canonicalKeywords = Array.from(
//   new Set(Object.values(keywordsGroup))
// ).sort((a, b) => a.localeCompare(b, "de"));

export const canonicalKeywords = [
  "antisemitismus",
  "islamfeindlichkeit",
  "fremdenfeindlichkeit",
  "rechtsextremismus",
  "volksverhetzung",
  "queerfeindlichkeit",
];

export const genderMap = {
  frau: "Adult Female",
  mann: "Adult Male",
  junge: "Youth",
  mädchen: "Youth",
  jugendliche: "Youth",
};

export const articles = writable([]);

const filterDefaults = {
  district: "",
  keyword: "",
  gender: "",
  timeCluster: "",
  text: "",
  showOnlyLatest: false,
  region: "",
  yearMin: null,
  yearMax: null,
  dateMin: null,
  dateMax: null,
};

export function createFilterState(overrides = {}) {
  return { ...filterDefaults, ...overrides };
}

export const filters = writable(createFilterState());

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

export const datesExtent = derived(articles, ($articles) => {
  let min = null;
  let max = null;
  for (const a of Array.isArray($articles) ? $articles : []) {
    const d = parseDateLoose(a.ExtractedDate || a.Date);
    if (!d || isNaN(+d)) continue;
    if (!min || d < min) min = d;
    if (!max || d > max) max = d;
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

export function augmentKeywordMatch(keywordMatch, text) {
  const kws = Array.isArray(keywordMatch) ? [...keywordMatch] : [];
  const hay = String(text || "").toLowerCase();

  const hasIslamophobiaTerm =
    /\b(islamfeind|muslimfeind|islamophob)\w*\b/.test(hay) ||
    kws.some(
      (k) =>
        (keywordsGroup[String(k || "").toLowerCase()] || "") ===
        "islamfeindlichkeit"
    );

  const hasHeadscarfMarker = /\bkopftuch\w*\b/.test(hay);
  const hasHateContext =
    /\b(rassist|fremdenfeind|volksverhetz|beleidig|hass)\w*\b/.test(hay) ||
    kws.some((k) =>
      /\b(rassist|fremdenfeind|volksverhetz)\w*\b/.test(
        String(k || "").toLowerCase()
      )
    );

  if ((hasIslamophobiaTerm || (hasHeadscarfMarker && hasHateContext)) && !kws.includes("islamfeindlichkeit")) {
    kws.push("islamfeindlichkeit");
  }

  return Array.from(new Set(kws)).filter(Boolean);
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
    const set = new Set();
    for (const a of base) {
      const r = detectRegion(a);
      const d = normalizeDistrict(a.ExtractedDistrict, r);
      if (d) set.add(d);
    }
    return Array.from(set).sort();
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

export const isMobile = readable(false, (set) => {
  if (!browser) return;
  set(/Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent));
});

export const recentCount = derived(isMobile, ($isMobile) =>
  $isMobile ? 50 : 350
);

export const recent = derived([articles, recentCount], ([$articles, n]) => {
  const list = Array.isArray($articles) ? $articles : [];
  const sorted = [...list].sort((a, b) => {
    const da = parseDateLoose(a.ExtractedDate || a.Date);
    const db = parseDateLoose(b.ExtractedDate || b.Date);
    if (da && db) return db - da;
    if (db) return 1;
    if (da) return -1;
    return 0;
  });
  return sorted.slice(0, n);
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

export const GENDER_LABELS = {
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

export const TIME_LABELS = {
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
  islamfeindlichkeit: { en: "Anti-Muslim bigotry", de: "Islamfeindlichkeit" },
  fremdenfeindlichkeit: { en: "Xenophobia/Racism", de: "Fremdenfeindlichkeit" },
  rechtsextremismus: { en: "Right-wing extremism", de: "Rechtsextremismus" },
  volksverhetzung: { en: "Incitement of the people", de: "Volksverhetzung" },
  queerfeindlichkeit: { en: "Anti-queer (LGBTQ*)", de: "Queerfeindlichkeit" },
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
  dateMin = null,
  dateMax = null,
} = f || {};

  let out = Array.isArray(list) ? list : [];

  if (region) out = out.filter((a) => detectRegion(a) === region);

  if (district) {
    out = out.filter(
      (a) =>
        normalizeDistrict(a.ExtractedDistrict, detectRegion(a)) === district
    );
  }

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

  const parsedDateMin = dateMin ? parseDateLoose(dateMin) : null;
  const parsedDateMax = dateMax ? parseDateLoose(dateMax) : null;
  const hasYearMin = yearMin != null && Number.isFinite(Number(yearMin));
  const hasYearMax = yearMax != null && Number.isFinite(Number(yearMax));

  const startDate =
    parsedDateMin && !isNaN(+parsedDateMin)
      ? parsedDateMin
      : hasYearMin
      ? new Date(Number(yearMin), 0, 1)
      : null;
  const endDate =
    parsedDateMax && !isNaN(+parsedDateMax)
      ? parsedDateMax
      : hasYearMax
      ? new Date(Number(yearMax), 11, 31, 23, 59, 59, 999)
      : null;

  if (startDate || endDate) {
    out = out.filter((a) => {
      const d = parseDateLoose(a.ExtractedDate || a.Date);
      if (!d) return false;
      if (startDate && d < startDate) return false;
      if (endDate && d > endDate) return false;
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

const berlinDistricts = [
  "Mitte",
  "Friedrichshain-Kreuzberg",
  "Pankow",
  "Charlottenburg-Wilmersdorf",
  "Spandau",
  "Steglitz-Zehlendorf",
  "Tempelhof-Schöneberg",
  "Neukölln",
  "Treptow-Köpenick",
  "Marzahn-Hellersdorf",
  "Lichtenberg",
  "Reinickendorf",
];
const brandenburgCounties = [
  "Barnim",
  "Dahme-Spreewald",
  "Elbe-Elster",
  "Havelland",
  "Märkisch-Oderland",
  "Oberhavel",
  "Oberspreewald-Lausitz",
  "Oder-Spree",
  "Ostprignitz-Ruppin",
  "Potsdam-Mittelmark",
  "Prignitz",
  "Spree-Neiße",
  "Uckermark",
];
const brandenburgCities = [
  "Potsdam",
  "Brandenburg an der Havel",
  "Cottbus",
  "Frankfurt (Oder)",
];

function normalizeDistrict(value, region) {
  if (!value) return "";
  const s = String(value).replace(/\s+/g, " ").trim();
  const parts = s
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  const all = parts.length ? parts : [s];
  const last = all[all.length - 1];
  const matchOne = (list) => {
    for (const name of list) {
      if (
        all.some(
          (t) =>
            t === name || t.replace(/\s+/g, "") === name.replace(/\s+/g, "")
        )
      )
        return name;
      if (s.includes(name)) return name;
    }
    return null;
  };
  if (region === "Berlin") {
    const m = matchOne(berlinDistricts);
    return m || last;
  }
  if (region === "Brandenburg") {
    const c = matchOne(brandenburgCities);
    if (c) return c;
    const k = matchOne(brandenburgCounties);
    if (k) return k;
    return last;
  }
  return last;
}
