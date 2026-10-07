// Defaults of the categorical timeline, in drawing units.
// The side panel edits most of them live; copy values you like back here.

// text
export const FS = 10;                 // snippet text (not the size on paper: see PRINT_TEXT_PT)
export const CHAR_RATIO = 0.615;      // character width / text size
export const ITEM_ROW_GAP = 0;
export const LANG_STACKED = false;     // both languages: EN under DE (true) or after it (false)
export const STACK_GAP = 0;
export const DIST_FS = 6;             // district label
export const DIST_GAP = 5;
export const SEGMENT_SNIP_MAX = 140;  // snippet length in characters
export const MAX_SEGMENTS_PER_ITEM = 1;

// layout
export const TOP_PAD = 0;
export const H_PAD = 0;
export const PX_PER_DAY = 10;         // solved automatically when two of width / height / text are fixed
export const BRANCH_START_GAP = 0;    // rows between the starts of two branches
export const BRANCH_CLEARANCE = 0;    // empty rows kept between different categories

// category names along the branches
export const MARKER_LABEL_FS = 120;
export const MARKER_LABEL_DY = -60;   // distance from the branch (negative = above)
export const MARKER_LABEL_START = 0;  // percent along the branch
export const MARKER_LABEL_REPEATS = 6;

// date axis
export const TICK_EVERY_MONTHS = 1;   // 3 = quarters, 12 = years
export const TICK_MID_LINES = true;
export const TICK_LABEL_FORMAT = "DD-MM-YY";   // tokens: DD MM MMM YY YYYY
export const TICK_STROKE = 0.5;
export const TICK_COLOR_YEAR = "#888";
export const TICK_COLOR = "#e0e0e0";
export const TICK_COLOR_MID = "#f0f0f0";
export const DATE_FS = 30;            // date labels
export const AXIS_LABEL_GAP = 70;     // their distance below the baseline
export const YEAR_FS = 160;           // the year, written large where each year starts (0 = off)

// print: fix any of the three, the rest follows from the chart
export const PRINT_TEXT_PT = null;
export const PDF_WIDTH_CM = null;
export const PDF_HEIGHT_CM = null;
export const EXPORT_DIVISOR = 1;      // 3 = the exported file is 1/3 of the print size (print it at 300 %)

// side panel
export const DEFAULT_SHOW_BERLIN = true;
export const DEFAULT_SHOW_BRANDENBURG = true;
export const DEFAULT_REVERSED = true; // newest on the left
export const DEFAULT_TEXT_ALIGN = "start";

export { CATEGORIES as DEFAULT_CATEGORIES } from "../../lib/constants/categories.js";
