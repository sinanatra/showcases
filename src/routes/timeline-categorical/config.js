export const FONT = "Arial, Courier, monospace";
export const FS = 10;
export const CHAR_W = FS * 0.601;
export const LINE_H = 13;
export const TOP_PAD = 16;
export const H_PAD = 20;
export const PX_PER_DAY = 5;
export const SNIP_MAX = 120;

export const CAT_COLORS = [
  "#b52a2a", // red
  "#1f5fa6", // blue
  "#1a7a3c", // green
  "#7a2a8f", // purple
  "#c96800", // amber
  "#007070", // teal
  "#b5006e", // magenta
  "#444444", // dark gray
  "#7a4d00", // brown
  "#3a7a00", // lime
];

export const STORAGE_KEY = "timeline-cat-v7";

export const DEFAULT_CATEGORIES = [
  {
    id: "rechts",
    label: "Rechtsextremismus",
    type: "canonical",
    query: "rechtsextremismus",
    on: true,
    desc: "Incidents classified under right-wing extremism (PMK-rechts). The largest single category in the dataset.",
  },
  {
    id: "antisem",
    label: "Antisemitismus",
    type: "canonical",
    query: "antisemitismus",
    on: true,
    desc: "Incidents targeting Jewish individuals, communities, or institutions. PMK sometimes also logs Israel/Palestine protests here — see Palestine / Gaza for overlap.",
  },
  {
    id: "fremd",
    label: "Fremdenfeindlichkeit",
    type: "canonical",
    query: "fremdenfeindlichkeit",
    on: true,
    desc: "Incidents classified as xenophobic or racially motivated. Classification varies by reporting officer.",
  },
  {
    id: "queer",
    label: "Queerfeindlichkeit",
    type: "canonical",
    query: "queerfeindlichkeit",
    on: true,
    desc: "Incidents targeting LGBTQ+ people. A relatively recent PMK subcategory; coverage is uneven across Bundesländer.",
  },
  {
    id: "islam",
    label: "Islamfeindlichkeit",
    type: "canonical",
    query: "islamfeindlichkeit",
    on: false,
    desc: "Incidents with an anti-Muslim dimension. Likely under-represented in this dataset relative to other categories.",
  },
  {
    id: "vv",
    label: "Volksverhetzung",
    type: "canonical",
    query: "volksverhetzung",
    on: false,
    desc: "Incidents prosecuted under §130 StGB (incitement to hatred). Cuts across all political motives; includes online content.",
  },
  {
    id: "palaestina",
    label: "Palestine / Gaza",
    type: "text",
    query: "palästina,palestine,gaza,pro-palästina",
    on: false,
    desc: "Incidents involving pro-Palestinian demonstrations or Gaza-related context. Many are simultaneously logged under Antisemitismus — the same event can appear in both categories.",
  },
  {
    id: "misogyn",
    label: "Misogynie / Frauenfeindlichkeit",
    type: "text",
    query: "misogyn,frauenfeindlich,frauenfeindlichkeit,sexistisch,sexismus",
    on: true,
    desc: "Misogynistic and women-hostile incidents. Not a PMK category — absent from the official hate crime record.",
  },
  {
    id: "femizid",
    label: "Femicide / Women",
    type: "text",
    query: "femizid,femizide,frauenmord,incel",
    on: false,
    desc: "Femicide and incel-related incidents. These are absent from the PMK record — a structural blind spot in Germany's hate crime statistics.",
  },
];
