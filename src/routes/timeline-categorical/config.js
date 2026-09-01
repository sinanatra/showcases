export const FS = 10;

export const CHAR_W = FS * 0.615;
export const ITEM_ROW_GAP = 0;
export const LINE_H = FS + 3 + ITEM_ROW_GAP;
export const LINE_H_BOTH = 2 * FS + 6 + ITEM_ROW_GAP;
export const DIST_FS = 6;
export const DIST_CW = DIST_FS * 0.615;
export const DIST_GAP = 5;
export const STACK_GAP = 3;
export const TOP_PAD = 16;
export const H_PAD = 20;
export const PX_PER_DAY = 10;

export const SEGMENT_SNIP_MAX = 140;
export const MAX_SEGMENTS_PER_ITEM = 2;

export const MARKER_LABEL_FS = 120;
export const MARKER_LABEL_DY = -100;

export const DATE_FS = 30;
export const AXIS_LABEL_GAP = 70;
export const AXIS_PAD = AXIS_LABEL_GAP + DATE_FS + 20;

export const DEFAULT_SHOW_BERLIN = true;
export const DEFAULT_SHOW_BRANDENBURG = false;
export const DEFAULT_REVERSED = true;
export const DEFAULT_TEXT_ALIGN = "start";

export const DEFAULT_CATEGORIES = [
  {
    id: "rechts",
    label: "Far-right extremism",
    labelDe: "Rechtsextremismus",
    color: "#8c8c8c",
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
      "heil hitler",
      "nationalsozialismus",
      "nationalsozialistisch",
      "rechtsgerichtet",
    ],
    on: true,
    desc: "Politically motivated crimes logging extreme right incidents. The largest category in the dataset.",
  },
  {
    id: "antisem",
    label: "Antisemitism",
    labelDe: "Antisemitismus",
    color: "#9b9b9b",
    type: "canonical",
    query: "antisemitismus",
    terms: [
      "antisemitisch",
      "antisemitismus",
      "judenfeindlich",
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
    label: "Xenophobia",
    labelDe: "Fremdenfeindlichkeit",
    color: "#ababab",
    type: "canonical",
    query: "fremdenfeindlichkeit",
    terms: [
      "fremdenfeindlichkeit",
      "fremdenfeindlich",
      "rassismus",
      "rassistisch",
      "hautfarbe",
    ],
    on: true,
    desc: "Politically motivated crimes including xenophobic and racially motivated incidents.",
  },
  {
    id: "queer",
    label: "Anti-LGBTQ+ violence",
    labelDe: "Queerfeindlichkeit",
    color: "#bababa",
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
      "transfeindlich",
    ],
    on: true,
    desc: "Politically motivated crimes targeting LGBTQ+ people.",
  },
  {
    id: "islam",
    label: "Islamophobia",
    labelDe: "Islamfeindlichkeit",
    color: "#c9c9c9",
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
    label: "Incitement to hatred",
    labelDe: "Volksverhetzung",
    color: "#d8d8d8",
    type: "canonical",
    query: "volksverhetzung",
    terms: ["volksverhetz", "verfassungswidrig", "volksverhetzend", "hetze"],
    on: true,
    desc: "Politically motivated crimes under §130 StGB: incitement to hatred.",
  },
  {
    id: "ableism",
    label: "Ableism",
    labelDe: "Behindertenfeindlichkeit",
    color: "#e8e8e8",
    type: "canonical",
    query: "behindertenfeindlichkeit",
    terms: [
      "behindertenfeindlich",
      "behindertenfeindlichkeit",
      "körperlich behindert",
      "geistig behindert",
      "physisch behindert",
      "psychisch behindert",
      "körperlich beeinträchtigt",
      "geistig beeinträchtigt",
      "physisch beeinträchtigt",
      "psychisch beeinträchtigt",
    ],
    on: true,
    desc: "Politically motivated crimes targeting people with disabilities.",
  },
  {
    id: "palaestina",
    label: "Palestine / Gaza",
    labelDe: "Palästina / Gaza",
    color: "#6fff00",
    type: "text",
    query:
      "palästina,palestine,gaza,pro-palästina,palästinensischer,palestinian, palestinensische,pro-palestinian,pro-palestine,pro-gaza,gazastre",
    on: true,
    desc: "Police reports mentioning Palestine or Gaza are often classified as anti-Semitic crimes, censoring political protest as a hate crime.",
  },
  {
    id: "misogyn",
    label: "Misogyny",
    labelDe: "Frauenfeindlichkeit",
    color: "orangered",
    type: "text",
    query:
      "misogyn,frauenfeindlich,frauenfeindlichkeit,sexistisch,sexismus,frauenhass,antifeminismus,antifeministisch",
    on: true,
    desc: "Misogyny is not recognised as a politically motivated crime. It almost never appear in police reports and therefore underrepresented.",
  },
  {
    id: "Ukraine",
    label: "Ukraine",
    labelDe: "Ukraine",
    color: "red",
    type: "text",
    on: true,
    query: "ukraine,ukrainisch,ukrainian,russland,putin,russisch,russian",
  },
  
];
