// Live, editable copy of the layout parameters in config.js. Components read
// from here, so a change in the side panel re-lays-out the chart immediately.
import * as config from "./config.js";

/** label + hint for every parameter the side panel can edit */
export const EDITABLE = [
  ["PX_PER_DAY", "Day spacing", "Horizontal space per day. Larger = wider chart with fewer stacked rows. Solved automatically when two of width / height / text size are fixed."],
  ["SEGMENT_SNIP_MAX", "Snippet length", "Longest quoted snippet in characters. Shorter boxes pack into fewer rows."],
  ["DIST_FS", "District size", "Size of the district label left of each item."],
  ["DATE_FS", "Date label size", "Size of the dates on the axis."],
  ["AXIS_LABEL_GAP", "Date label offset", "Distance of the dates below the baseline."],
  ["TICK_EVERY_MONTHS", "Tick every (months)", "1 = monthly, 3 = quarters, 12 = years."],
  ["BRANCH_START_GAP", "Branch separation (rows)", "Each branch starts this many rows above the previous one, smallest category at the bottom. 0 = all start together."],
  ["BRANCH_CLEARANCE", "Branch clearance (rows)", "Empty rows kept between reports of different categories where they would touch, so branches never run into each other. 0 = they may interleave."],
  ["MARKER_LABEL_FS", "Category name size", "Size of the category names along the branches."],
  ["MARKER_LABEL_DY", "Category name offset", "How far a name sits from its branch. Negative = above it; closer to 0 = tighter, so branches can be closer together."],
  ["MARKER_LABEL_START", "Category name start (%)", "Where along its branch the first name sits: 0 = at the very start, 50 = halfway."],
  ["MARKER_LABEL_REPEATS", "Category name repeats", "How many times a name is repeated along its branch. Names that would collide are left out."],
];

const KEYS = [
  ...EDITABLE.map(([key]) => key),
  "FS", "CHAR_RATIO", "LANG_STACKED", "DIST_GAP",
  "MAX_SEGMENTS_PER_ITEM", "H_PAD", "TOP_PAD", "ITEM_ROW_GAP", "STACK_GAP",
  "TICK_MID_LINES", "TICK_LABEL_FORMAT",
];
const STORE_KEY = "timeline-categorical-settings";

export const defaults = Object.fromEntries(KEYS.map((k) => [k, /** @type {any} */ (config)[k]]));

function stored() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORE_KEY) || "{}");
    // only what the panel can edit — anything else always comes from config.js
    const editable = new Set([...EDITABLE.map(([key]) => key), "LANG_STACKED"]);
    return Object.fromEntries(Object.entries(saved).filter(([k]) => editable.has(k)));
  } catch {
    return {};
  }
}

export const settings = $state({ ...defaults, ...stored() });

/** Remembers panel edits in this browser, so a reload keeps them. */
export function saveSettings() {
  try {
    const changed = Object.fromEntries(Object.entries(settings).filter(([k, v]) => v !== defaults[k]));
    localStorage.setItem(STORE_KEY, JSON.stringify(changed));
  } catch {}
}

export function resetSettings() {
  Object.assign(settings, defaults);
  saveSettings();
}

export const isChanged = () => KEYS.some((k) => settings[k] !== defaults[k]);

// derived sizes
export const charW = () => settings.FS * settings.CHAR_RATIO;
export const distCW = () => settings.DIST_FS * settings.CHAR_RATIO;
export const dateCW = () => settings.DATE_FS * settings.CHAR_RATIO;
export const lineH = () => settings.FS + 3 + settings.ITEM_ROW_GAP;
export const lineHBoth = () => 2 * settings.FS + 3 + settings.STACK_GAP + settings.ITEM_ROW_GAP;
export const axisPad = () => settings.AXIS_LABEL_GAP + settings.DATE_FS + 20;
