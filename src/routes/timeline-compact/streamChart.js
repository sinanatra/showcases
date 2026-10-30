import { CHAR_RATIO } from "../timeline-categorical/config.js";
import { makeBands, typeScale, timeScale } from "./streamItems.js";
import { layoutStreams, makeWave } from "./streamLayout.js";
import { CM, MIN_TEXT_PT } from "./config.js";

/** Period and sizes on paper, from the params of the print. */
export function paper(params) {
  const start = new Date(Number(params.fromYear) || 2020, 0, 1);
  const end = new Date(Math.max(+params.fromYear + 1, Number(params.toYear) || 2027), 0, 1);
  const FS = Math.max(MIN_TEXT_PT, Number(params.textPt) || MIN_TEXT_PT);
  const W = Math.max(50, Number(params.widthCm) || 700) * CM;
  return {
    start,
    end,
    FS,
    W,
    type: typeScale(FS, Number(params.namePt)),
    maxH: Math.max(20, Number(params.heightCm) || 450) * CM,
    xOf: timeScale(start, end, params.newestLeft, W),
  };
}

/** The whole chart: every stream with its reports placed. Null if it is empty. */
export function streamChart(items, categories, params, o) {
  const { type, W, xOf, FS } = o.paper;
  const bands = makeBands(items, categories, {
    type,
    width: W,
    xOf,
    shades: o.shades,
    translatedMap: o.translatedMap,
    snip: o.snip,
    labelEvery: Math.max(20, Number(params.labelEveryCm) || 150) * CM,
    langMode: params.langMode,
    dateMode: params.dateMode,
    bandPerLang: params.bandPerLang,
    fillGaps: params.fillGaps,
    showLabels: params.showLabels,
  });
  if (!bands.length) return null;
  return layoutStreams(bands, {
    W,
    lineH: type.lineH,
    wave: makeWave({
      amplitude: Math.max(0, Number(params.waveCm) || 0) * CM,
      length: Math.max(10, Number(params.waveLengthCm) || 90) * CM,
    }),
    grid: 30,
    slack: Math.max(0, Number(params.slackCm) || 0) * CM,
    sigma: Math.max(2, Number(params.smoothCm) || 60) * CM,
    room: Math.max(1, (Number(params.roomPct) || 105) / 100),
    bandGap: Math.max(0, Number(params.gapLines) || 0),
    slope: Math.min(1, Math.max(0.05, Number(params.maxSlope) || 0.25)),
    fill: params.fillGaps,
    charRatio: CHAR_RATIO,
    textFs: FS,
    order: o.order,
  });
}
