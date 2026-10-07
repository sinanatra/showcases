// Every adjustable number of the categorical timeline lives here.
// Sizes are in drawing units; what they become on paper is set under "print".
// These are the defaults: the "Layout" section of the side panel edits most of
// them live (see settings.svelte.js) — copy values you like back into this file.

// ── text ──────────────────────────────────────────────────────
// Snippet text size in drawing units — the yardstick every other size here is
// relative to. It is NOT the size on paper: that is PRINT_TEXT_PT below.
export const FS = 10;
export const CHAR_RATIO = 0.615;      // width of one monospace character, as a share of the text size
export const ITEM_ROW_GAP = 0;        // extra space between stacked rows
export const LANG_STACKED = true;     // both languages: true = EN under DE, false = EN after DE on one line
export const STACK_GAP = 0;           // gap between the DE and EN line of one item (stacked only)
export const DIST_FS = 6;             // district label left of each item
export const DIST_GAP = 5;

export const SEGMENT_SNIP_MAX = 140;  // longest quoted snippet, in characters
export const MAX_SEGMENTS_PER_ITEM = 1;

// ── layout ────────────────────────────────────────────────────
export const TOP_PAD = 0;
export const H_PAD = 0;
export const PX_PER_DAY = 10;         // horizontal space per day (ignored when a print width AND height are set)

// Each category's branch starts this many rows above the previous one (smallest
// category at the bottom), so the branches are apart where they begin and each
// has room for its name. 0 = all start on the same rows.
export const BRANCH_START_GAP = 0;
// Empty rows kept between reports of different categories wherever they would
// otherwise touch, so two branches never run into each other. 0 = they may interleave.
export const BRANCH_CLEARANCE = 0;

export const MARKER_LABEL_FS = 120;   // category names along the branches
export const MARKER_LABEL_DY = -60;    // how far a name sits from its branch (negative = above it)
export const MARKER_LABEL_START = 0;    // where along a branch the first name sits, in percent of its length
export const MARKER_LABEL_REPEATS = 6;  // how many times a name is repeated along its branch (fewer if they would collide)

// ── date axis ─────────────────────────────────────────────────
export const TICK_EVERY_MONTHS = 1;   // a tick line + date label every N months (3 = quarters, 12 = years)
export const TICK_MID_LINES = true;   // faint line halfway between two ticks
// Tokens: DD day, MM month number, MMM month name, YYYY / YY year. E.g. "MMM YYYY", "MM/YY", "YYYY".
export const TICK_LABEL_FORMAT = "DD-MM-YY";
export const TICK_STROKE = 0.5;
export const TICK_COLOR_YEAR = "#888";   // ticks on 1 January
export const TICK_COLOR = "#e0e0e0";
export const TICK_COLOR_MID = "#f0f0f0";

export const DATE_FS = 30;            // date label size
export const AXIS_LABEL_GAP = 70;     // distance of the date labels below the baseline

// ── print (PDF / SVG export) ──────────────────────────────────
// Fix any of the three; what you leave null follows from the chart:
//   text only            → print size follows (day spacing = PX_PER_DAY)
//   width or height only → text size follows
//   width + height       → day spacing is solved to match that proportion, text size follows
//   width + text         → day spacing is solved to reach that width, height follows
//   height + text        → day spacing is solved to reach that height, width follows
//   all three            → laid out as width + text; the panel says whether the height fits
export const PRINT_TEXT_PT = null;    // snippet text size on paper, in pt
export const PDF_WIDTH_CM = null;
export const PDF_HEIGHT_CM = null;

// ── defaults of the side panel ────────────────────────────────
export const DEFAULT_SHOW_BERLIN = true;
export const DEFAULT_SHOW_BRANDENBURG = true;
export const DEFAULT_REVERSED = true;      // newest on the left
export const DEFAULT_TEXT_ALIGN = "start";

// Categories are defined in /categories.json.
export { CATEGORIES as DEFAULT_CATEGORIES } from "../../lib/constants/categories.js";
