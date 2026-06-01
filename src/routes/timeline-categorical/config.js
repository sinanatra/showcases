// "Courier Prime, monospace" / "Cutive Mono, monospace"
export const FONT = "Courier Prime, monospace";
export const FS = 10;
export const CHAR_W = FS * 0.601;
export const LINE_H = 13;
export const TOP_PAD = 16;
export const H_PAD = 20;
export const PX_PER_DAY = 5;
export const SNIP_MAX = 100;

export const DEFAULT_SHOW_BILANZ      = false;
export const DEFAULT_SHOW_BERLIN      = true;
export const DEFAULT_SHOW_BRANDENBURG = false;
export const DEFAULT_REVERSED         = true;
export const DEFAULT_DISPLAY_MODE     = "text";

export const DEFAULT_CATEGORIES = [
  {
    id: "rechts",
    label: "Far-right extremism",
    color: "#A5A5A5",
    type: "canonical",
    query: "rechtsextremismus",
    terms: ["hakenkreuz", "ss-rune", "nazisymbol", "rechtsextrem", "nazi", "neonazi", "hitlergruß", "sieg heil", "nationalsozialismus", "nationalsozialistisch", "rechtsgerichtet"],
    on: true,
    desc: "Politically motivated crimes logging extreme right incidents. The largest category in the dataset.",
  },
  {
    id: "antisem",
    label: "Antisemitism",
    color: "#dddddd",
    type: "canonical",
    query: "antisemitismus",
    terms: ["antisemitisch", "antisemitismus", "davidstern", "jüdisch", "synagoge", "israel"],
    on: true,
    desc: "Politically motivated crimes focussed on antisemitic incidents: graffiti, threats, physical attacks.",
  },
  {
    id: "fremd",
    label: "Xenophobia",
    color: "#E2E2E2",
    type: "canonical",
    query: "fremdenfeindlichkeit",
    terms: ["fremdenfeindlichkeit", "fremdenfeindlich", "rassismus", "rassistisch"],
    on: true,
    desc: "Politically motivated crimes including xenophobic and racially motivated incidents.",
  },
  {
    id: "queer",
    label: "Anti-LGBTQ+ violence",
    color: "#a4b1a1",
    type: "canonical",
    query: "queerfeindlichkeit",
    terms: ["queerfeindlichkeit", "queerfeindlich", "queerphobie", "homophobie", "homophob", "transphobie", "transphob", "transfrau", "transgender", "regenbogenfahne", "homosexuell", "schwul", "lesbisch"],
    on: true,
    desc: "Politically motivated crimes targeting LGBTQ+ people.",
  },
  {
    id: "islam",
    label: "Islamophobia",
    color: "#a2a1b1",
    type: "canonical",
    query: "islamfeindlichkeit",
    terms: ["islamfeindlichkeit", "islamfeindlich", "islamophobie", "islamophob", "muslimfeindlich", "muslimfeindlichkeit", "antimuslimisch", "anti-muslimisch", "antiislamisch", "anti-islamisch", "kopftuch", "hidschab", "hijab", "moschee", "muslimisch", "muslime"],
    on: true,
    desc: "Politically motivated crimes including incidents targeting Muslims and Muslim institutions.",
  },
  {
    id: "vv",
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
    label: "Palestine / Gaza",
    color: "#FAFAFA",
    type: "text",
    query: "palästina,palestine,gaza,pro-palästina,palästinensischer,palestinian",
    on: true,
    desc: "Police reports mentioning Palestine or Gaza are often classified as anti-Semitic crimes, censoring political protest as a hate crime.",
  },
  {
    id: "misogyn",
    label: "Misogyny",
    color: "#e7e7e7",
    type: "text",
    query: "misogyn,frauenfeindlich,frauenfeindlichkeit,sexistisch,sexismus",
    on: true,
    desc: "Misogyny is not recognised as a politically motivated crime. It almost never appear in police reports and therefore underrepresented.",
  },
];
