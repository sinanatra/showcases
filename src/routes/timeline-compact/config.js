// Defaults of the stream timeline. Sizes in cm and pt are on paper.

export const MIN_TEXT_PT = 25;
export const CM = 72 / 2.54;
export const PX_PER_PT = 96 / 72;
export const FILE = "timeline-streams";

// Pitch Semibold, as a share of the font size
export const ASCENT = 0.66;
export const DESCENT = 0.2;
export const CAP_HEIGHT = 0.57;
export const X_HEIGHT = 0.424;
export const LINE_RATIO = 1;

// date and district, category names, and date over district on one line
export const NOTE_SCALE = 14 / 18;
export const LABEL_SCALE = 22 / 18;
export const STACK_SCALE = 0.55;

// stream bands, darkest at the bottom
export const SHADE_DARKEST = "#8f8f8f";
export const SHADE_LIGHTEST = "#ededed";
export const FADE_BOTTOM = 0.7;
export const FADE_TOP = 0.85;

export const THEMES = {
  light: { background: "#ffffff", ink: "#000000" },
  dark: { background: "#000000", ink: "#ffffff", bandEnd: "#000000", blend: "difference" },
};

export const DEFAULTS = {
  fromYear: 2020,
  toYear: 2027,
  widthCm: 700,
  heightCm: 450,
  textPt: MIN_TEXT_PT,
  langMode: "both",
  dateMode: "inline",
  bandPerLang: false,
  stackMode: "small", // "big" | "small" | "centre"
  newestLeft: false,
  dark: false,
  showBerlin: true,
  showBrandenburg: true,
  autoFit: true,
  minSnip: 40,
  fillGaps: true,
  waveCm: 10,
  waveLengthCm: 40,
  slackCm: 10,
  smoothCm: 15,
  maxSlope: 0.25,
  roomPct: 105,
  gapLines: 1,
  showLabels: true,
  namePt: 100, // 0 = LABEL_SCALE of the text
  labelEveryCm: 250,
};
