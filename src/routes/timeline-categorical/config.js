// font is defined by --font-mono in static/style.css
export const FS = 10;

// ── district legend ───────────────────────────────────────────
// Berlin Bezirke
export const DISTRICT_ICONS = {
  Mitte: "Mi",
  "Friedrichshain-Kreuzberg": "FK",
  Pankow: "Pa",
  "Charlottenburg-Wilmersdorf": "CW",
  Spandau: "Sp",
  "Steglitz-Zehlendorf": "SZ",
  "Tempelhof-Schöneberg": "TS",
  Neukölln: "Nk",
  "Treptow-Köpenick": "TK",
  "Marzahn-Hellersdorf": "MH",
  Lichtenberg: "Li",
  Reinickendorf: "Re",
  // Brandenburg Städte
  Potsdam: "Pd",
  "Brandenburg an der Havel": "BH",
  Cottbus: "Co",
  "Frankfurt (Oder)": "FF",
  // Brandenburg Landkreise
  Barnim: "Bn",
  "Dahme-Spreewald": "DS",
  "Elbe-Elster": "EE",
  Havelland: "Hv",
  "Märkisch-Oderland": "MO",
  Oberhavel: "OH",
  "Oberspreewald-Lausitz": "OL",
  "Oder-Spree": "OS",
  "Ostprignitz-Ruppin": "OR",
  "Potsdam-Mittelmark": "PM",
  Prignitz: "Pr",
  "Spree-Neiße": "SN",
  Uckermark: "Um",
};

export const CHAR_W = FS * 0.615;
export const LINE_H = 23;
export const TOP_PAD = 16;
export const H_PAD = 20;
export const PX_PER_DAY = 20;
export const SNIP_MAX = 200;
export const MARKER_LABEL_FS = 24;
export const MARKER_DESC_FS = 12;
export const BASELINE_GAP = 220;

export const DEFAULT_SHOW_BILANZ = false;
export const DEFAULT_SHOW_BERLIN = true;
export const DEFAULT_SHOW_BRANDENBURG = false;
export const DEFAULT_REVERSED = true;
export const DEFAULT_DISPLAY_MODE = "text";
export const DEFAULT_TEXT_ALIGN = "start";

export const DEFAULT_CATEGORIES = [
  {
    id: "rechts",
    icon: "■",
    label: "Far-right extremism",
    color: "#A5A5A5",
    type: "canonical",
    query: "rechtsextremismus",
    terms: [
      "hakenkreuz",
      "ss-rune",
      "nazisymbol",
      "rechtsextrem",
      "nazi",
      "neonazi",
      "hitlergruß",
      "sieg heil",
      "nationalsozialismus",
      "nationalsozialistisch",
      "rechtsgerichtet",
    ],
    on: true,
    desc: "Politically motivated crimes logging extreme right incidents. The largest category in the dataset.",
  },
  {
    id: "antisem",
    icon: "●",
    label: "Antisemitism",
    color: "#dddddd",
    type: "canonical",
    query: "antisemitismus",
    terms: [
      "antisemitisch",
      "antisemitismus",
      "davidstern",
      "jüdisch",
      "synagoge",
      "israel",
    ],
    on: true,
    desc: "Politically motivated crimes focussed on antisemitic incidents: graffiti, threats, physical attacks.",
  },
  {
    id: "fremd",
    icon: "▲",
    label: "Xenophobia",
    color: "#E2E2E2",
    type: "canonical",
    query: "fremdenfeindlichkeit",
    terms: [
      "fremdenfeindlichkeit",
      "fremdenfeindlich",
      "rassismus",
      "rassistisch",
    ],
    on: true,
    desc: "Politically motivated crimes including xenophobic and racially motivated incidents.",
  },
  {
    id: "queer",
    icon: "◆",
    label: "Anti-LGBTQ+ violence",
    color: "#a4b1a1",
    type: "canonical",
    query: "queerfeindlichkeit",
    terms: [
      "homophob",
      "transphob",
      "queerfeindlich",
      "queerphobie",
      "homophobie",
      "transphobie",
      "transfrau",
      "transgender",
      "regenbogenfahne",
      "homosexuell",
      "schwul",
      "lesbisch",
      "csd",
      "pride",
      "christopher street",
    ],
    on: true,
    desc: "Politically motivated crimes targeting LGBTQ+ people.",
  },
  {
    id: "islam",
    icon: "★",
    label: "Islamophobia",
    color: "#a2a1b1",
    type: "canonical",
    query: "islamfeindlichkeit",
    terms: [
      "islamfeindlichkeit",
      "islamfeindlich",
      "islamophobie",
      "islamophob",
      "muslimfeindlich",
      "muslimfeindlichkeit",
      "antimuslimisch",
      "anti-muslimisch",
      "antiislamisch",
      "anti-islamisch",
      "kopftuch",
      "hidschab",
      "hijab",
      "moschee",
      "muslimisch",
      "muslime",
    ],
    on: true,
    desc: "Politically motivated crimes including incidents targeting Muslims and Muslim institutions.",
  },
  {
    id: "vv",
    icon: "▼",
    label: "Incitement to hatred",
    color: "#eaeaea",
    type: "canonical",
    query: "volksverhetzung",
    terms: ["volksverhetz", "verfassungswidrig", "volksverhetzend", "hetze"],
    on: true,
    desc: "Politically motivated crimes under §130 StGB: incitement to hatred.",
  },
  {
    id: "palaestina",
    icon: "◇",
    label: "Palestine / Gaza",
    color: "#FAFAFA",
    type: "text",
    query:
      "palästina,palestine,gaza,pro-palästina,palästinensischer,palestinian",
    on: true,
    desc: "Police reports mentioning Palestine or Gaza are often classified as anti-Semitic crimes, censoring political protest as a hate crime.",
  },
  {
    id: "misogyn",
    icon: "▮",
    label: "Misogyny",
    color: "#e7e7e7",
    type: "text",
    query: "misogyn,frauenfeindlich,frauenfeindlichkeit,sexistisch,sexismus",
    on: true,
    desc: "Misogyny is not recognised as a politically motivated crime. It almost never appear in police reports and therefore underrepresented.",
  },
  // {
  //   id: "alcohol",
  //   label: "Alcohol",
  //   color: "#d4c8b0",
  //   type: "text",
  //   query: "alkohol,betrunken,betrunkener,alkoholisiert,trunkenheit",
  //   on: true,
  //   desc: "Police reports where alcohol was a factor in the incident.",
  // },
  // {
  //   id: "vandalism",
  //   label: "Vandalism",
  //   color: "#c9c0b0",
  //   type: "text",
  //   query: "sachbeschädigung,schmiererei,graffiti,beschmiert,sachschaden,hakenkreuz,schmierer",
  //   on: true,
  //   desc: "Politically motivated vandalism and graffiti. 72% of vandalism cases in the dataset involve swastika symbols. Memorial sites, schools, and residential spaces are frequently targeted.",
  // },

  // {
  //   id: "youth",
  //   label: "Youth",
  //   color: "#c5b8a8",
  //   type: "text",
  //   query: "jugendlich,minderjährig,jugendlicher,heranwachsender,jugend,schüler,jugendliche",
  //   on: true,
  //   desc: "339 police reports involve people aged 18 or younger — as offenders or victims. They act in groups, share right-extremist beliefs, and are individually targeted by racial aggression.",
  // },
];
