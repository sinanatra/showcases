import { parseDateLoose } from "$lib/utils/parseDate";
import { detectRegion } from "$lib/utils/detectRegion";
import { normalizeDistrict } from "$lib/constants/districts";
import { pairedSnippet } from "$lib/utils/pairedSnippet";
import { CHAR_RATIO } from "../timeline-categorical/config.js";
import {
  matchesCategory,
  snippetSegments,
  translateSegment,
  findBoilerplate,
  groupBranchesBySentence,
} from "../timeline-categorical/catTimeline.js";
import { runsWidth } from "./streamLayout.js";
import { LANG_GAP, LANG_TURN } from "./streamCanvas.js";
import {
  ASCENT,
  DESCENT,
  CAP_HEIGHT,
  LINE_RATIO,
  NOTE_SCALE,
  LABEL_SCALE,
  STACK_SCALE,
  SHADE_DARKEST,
  SHADE_LIGHTEST,
  FADE_BOTTOM,
  FADE_TOP,
  LANG_DARKEN,
} from "./config.js";

const isBranch = (c) => c.type === "canonical";
const pad2 = (n) => String(n).padStart(2, "0");
const stamp = (d) =>
  `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${pad2(d.getFullYear() % 100)}`;

/** Sizes of everything, from the text size and the category name size. */
export function typeScale(fs, namePt) {
  const lineH = fs * LINE_RATIO;
  const stackFs = fs * STACK_SCALE;
  return {
    fs,
    lineH,
    charW: fs * CHAR_RATIO,
    baseline: (lineH - fs * (ASCENT + DESCENT)) / 2 + fs * ASCENT,
    noteFs: fs * NOTE_SCALE,
    labelFs: namePt > 0 ? namePt : fs * LABEL_SCALE,
    // date over district, together no taller than the letters of the text
    stackFs,
    dateDy: -ASCENT * fs + CAP_HEIGHT * stackFs,
    placeDy: DESCENT * (fs - stackFs),
  };
}

export const timeScale = (start, end, reversed, width) => (date) => {
  const t = (+date - +start) / (+end - +start || 1);
  return (reversed ? 1 - t : t) * width;
};

/** One item per report and stream it belongs to, and how many each category has. */
export function buildItems(articles, categories, o) {
  const counts = Object.fromEntries(categories.map((c) => [c.id, 0]));
  findBoilerplate(articles);
  const branchCats = categories.filter(isBranch);
  const highlightCats = categories.filter((c) => !isBranch(c));
  const items = [];
  for (const a of articles) {
    const region = detectRegion(a);
    if (region === "Berlin" && !o.showBerlin) continue;
    if (region === "Brandenburg" && !o.showBrandenburg) continue;
    if (/bilanz/i.test(a.Title || "")) continue;
    const date = parseDateLoose(a.ExtractedDate || a.Date);
    if (!date || date < o.start || date >= o.end) continue;

    const matched = branchCats.filter((cat) => matchesCategory(a, cat));
    if (!matched.length) continue;
    const highlights = highlightCats.filter((cat) => matchesCategory(a, cat));
    for (const cat of highlights) counts[cat.id]++;
    const highlight = highlights.find((cat) => cat.on);
    const p = {
      date,
      title: (a.Title || "").trim(),
      text: (a.Text || "").trim(),
      raw: a,
      district: normalizeDistrict(a.ExtractedDistrict, region),
    };
    for (const catIds of groupBranchesBySentence(p, matched)) {
      for (const id of catIds) counts[id]++;
      const cat = matched.find((c) => c.id === catIds[0]);
      if (!cat.on) continue;
      const paint = highlight ?? cat;
      const item = {
        ...p,
        catId: cat.id,
        catIds,
        color: paint.color,
        colorEnd: paint.colorEnd ?? "#ffffff",
        highlightId: highlight?.id ?? null,
      };
      const segment = snippetSegments(item, categories)[0];
      if (segment) items.push({ ...item, segment });
    }
  }
  return { items, counts };
}

/** Stream ids bottom to top. */
export function stackOrder(categories, counts, mode) {
  const ids = categories
    .filter((c) => isBranch(c) && c.on && (counts[c.id] ?? 0) > 0)
    .sort((a, b) => (counts[b.id] ?? 0) - (counts[a.id] ?? 0))
    .map((c) => c.id);
  if (mode === "small") return ids.reverse();
  if (mode === "centre") {
    const bottom = ids.filter((_, i) => i % 2 === 0),
      top = ids.filter((_, i) => i % 2 === 1);
    return [...bottom, ...top.reverse()];
  }
  return ids;
}

const mixHex = (a, b, f) =>
  "#" +
  [1, 3, 5]
    .map((i) =>
      Math.round(
        parseInt(a.slice(i, i + 2), 16) * (1 - f) +
          parseInt(b.slice(i, i + 2), 16) * f,
      )
        .toString(16)
        .padStart(2, "0"),
    )
    .join("");

/** The band colour of each stream and where its gradient ends. */
export function streamShades(order) {
  return Object.fromEntries(
    order.map((id, i) => {
      const f = order.length > 1 ? i / (order.length - 1) : 0;
      return [
        id,
        {
          band: mixHex(SHADE_DARKEST, SHADE_LIGHTEST, f),
          fade: FADE_BOTTOM + (FADE_TOP - FADE_BOTTOM) * f,
        },
      ];
    }),
  );
}

// "…beleidigt" + "insulted…": no dots where one language meets the other
const joinLangs = (parts, gap) =>
  parts
    .map((t, i) => (i ? t.replace(/^\s*…\s*/, "") : t))
    .map((t, i, all) => (i < all.length - 1 ? t.replace(/\s*…\s*$/, "") : t))
    .join(gap);

const labelTexts = (cat) => [
  (cat.labelDe || cat.label).toUpperCase(),
  cat.label.toUpperCase(),
];

// with both languages, German and English names take turns
function labelItem(cat, x, n, o) {
  const t = o.type;
  const [de, en] = labelTexts(cat);
  const text =
    o.langMode === "de" ? de : o.langMode === "en" ? en : n % 2 === 0 ? de : en;
  const fs = t.labelFs;
  const h = Math.max(1, Math.ceil((fs * CAP_HEIGHT * 1.1) / t.lineH - 1e-6));
  const len = text.length * fs * CHAR_RATIO;
  return {
    x: Math.max(0, Math.min(x, o.width - len - 2 * t.charW)),
    len: len + 2 * t.charW,
    h,
    label: true,
    lines: [
      {
        lane: 0,
        runs: [{ text, style: "label" }],
        fs,
        baseline: (h * t.lineH + fs * CAP_HEIGHT) / 2,
        len,
      },
    ],
  };
}

/** The items of each stream, with their lines of text, for layoutStreams. */
export function makeBands(items, categories, o) {
  const t = o.type;
  const gap = 2 * t.charW;
  const join = (parts) => joinLangs(parts, o.bandPerLang ? LANG_GAP : LANG_TURN);
  const line = (lane, runs) => ({
    lane,
    runs,
    fs: t.fs,
    baseline: t.baseline,
    len: runsWidth(runs, t.fs, CHAR_RATIO),
  });

  return categories
    .filter((c) => isBranch(c) && c.on)
    .map((cat) => {
      const out = [];
      let lastLabel = -Infinity,
        labels = 0;
      const own = items
        .filter((it) => it.catId === cat.id)
        .sort((a, b) => +a.date - +b.date);
      for (const it of own) {
        const pair = pairedSnippet(it.text, it.segment, o.translatedMap);
        const en =
          o.langMode === "de"
            ? ""
            : pair
              ? pair.en(o.snip)
              : translateSegment(it.segment, o.translatedMap);
        const de =
          o.langMode === "en" && en ? "" : pair ? pair.de(o.snip) : it.segment.text;
        const texts = [
          de && { text: de, style: "de" },
          en && { text: en, style: "en" },
        ].filter(Boolean);

        const date = stamp(it.date);
        const district = it.district || "";
        const width = Math.max(date.length, district.length) + 1;
        const meta = (text, run) => ({
          text: text.padStart(width - 1) + " ",
          style: "meta",
          ...run,
        });
        const rows =
          o.dateMode === "aligned" && texts.length > 1
            ? [
                [meta(date, { fs: t.noteFs }), texts[0]],
                [meta(district, { fs: t.noteFs }), texts[1]],
              ]
            : [
                [
                  ...(district
                    ? [
                        meta(date, { fs: t.stackFs, dy: t.dateDy }),
                        meta(district, { fs: t.stackFs, dy: t.placeDy, under: true }),
                      ]
                    : [meta(date, { fs: t.noteFs })]),
                  { text: join(texts.map((x) => x.text)), style: texts[0].style },
                ],
              ];
        const lines = rows.map((runs, i) => line(i, runs));

        // lines may grow into the room beside them, still centred on the word
        let joint = null;
        if (o.fillGaps && pair) {
          const grown = (n) => {
            const d = de ? pair.de(n) : "",
              e = en ? pair.en(n) : "";
            return rows.length === 1 && d && e ? [join([d, e])] : [d, e].filter(Boolean);
          };
          joint = { n: o.snip, max: pair.max + 2, texts: grown };
        }

        // starts at its date at the left end, ends at it at the right end
        const len = Math.max(...lines.map((l) => l.len));
        const at = o.xOf(it.date);
        const x = at - len * Math.min(1, Math.max(0, at / o.width));
        if (o.showLabels && Math.abs(x - lastLabel) >= o.labelEvery) {
          out.push(labelItem(cat, Math.max(0, x - 1), labels++, o));
          lastLabel = x;
        }

        const shade = o.shades[cat.id];
        const report = it.highlightId
          ? it
          : {
              ...it,
              color: shade?.band ?? it.color,
              colorEn: shade && mixHex(shade.band, "#000000", LANG_DARKEN),
              fadeAt: shade?.fade,
            };
        out.push({ x, len: len + gap, h: lines.length, lines, report, joint });
      }
      // with both languages, every stream names itself in each at least once
      const [de, en] = labelTexts(cat);
      if (o.showLabels && o.langMode === "both" && labels === 1 && de !== en) {
        const first = out.find((i) => i.label);
        out.push(labelItem(cat, first.x + first.len, labels++, o));
      }
      return { id: cat.id, items: out };
    })
    .filter((b) => b.items.length);
}
