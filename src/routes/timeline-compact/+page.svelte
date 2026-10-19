<script>
  import { onMount, untrack } from "svelte";
  import * as d3 from "d3";
  import { articles } from "$lib/stores";
  import { loadArticles } from "$lib/utils/loadArticles";
  import { parseDateLoose } from "$lib/utils/parseDate";
  import { detectRegion } from "$lib/utils/detectRegion";
  import { normalizeDistrict } from "$lib/constants/districts";
  import { loadReportTranslations } from "$lib/utils/reportTranslations";
  import { splitSentences } from "$lib/utils/sentences";
  import { CATEGORIES, GRADIENT_END_AT } from "$lib/constants/categories.js";
  import { CHAR_RATIO } from "../timeline-categorical/config.js";
  import { settings } from "../timeline-categorical/settings.svelte.js";
  import {
    matchesCategory,
    snippetSegments,
    translateSegment,
    findBoilerplate,
    groupBranchesBySentence,
  } from "../timeline-categorical/catTimeline.js";
  import { layoutStreams, makeWave } from "./streamLayout.js";
  import { createRenderer } from "./streamCanvas.js";

 
 
  const MIN_TEXT_PT = 18;
  const CM = 72 / 2.54;
  const LINE_RATIO = 1.1;
  const ASCENT = 0.8;
  const DESCENT = 0.25;
 
 
  const THEMES = {
    light: {
      background: "#ffffff",
      de: "#000000",
      en: "#000000",
      meta: "#000000",
      label: "#000000",
      grid: "#e6e6e6",
      axis: "#000000",
    },
    dark: {
      background: "#000000",
      de: "#ffffff",
      en: "#ffffff",
      meta: "#ffffff",
      label: "#ffffff",
      grid: "#1c1c1c",
      axis: "#ffffff",
      blend: "difference",
    },
  };

  const MIN_DATE = new Date("2020-01-01");

  let categories = $state(CATEGORIES.map((c) => ({ ...c })));
  let langMode = $state("both");
  let textPt = $state(MIN_TEXT_PT);
  let widthCm = $state(600);
  let maxHeightCm = $state(300);
  let slackCm = $state(10);
  let smoothCm = $state(15);
  let maxSlope = $state(0.25);
  let roomPct = $state(105);
  let labelLanes = $state(2);
  let labelEveryCm = $state(100);
  let waveCm = $state(5);
  let waveLengthCm = $state(20);
  const seed = 1;                 // wave seed
  let dark = $state(false);
  let fillGaps = $state(true);
  let dateMode = $state("aligned");
  let gapLines = $state(3);
  let smallFirst = $state(true);
  let newestLeft = $state(false);
  let showBerlin = $state(true);
  let showBrandenburg = $state(true);
  let highlightFade = $state(0.25);
  let translatedMap = $state.raw({});
  let translationsReady = $state(false);

  let FS = $derived(Math.max(MIN_TEXT_PT, Number(textPt) || MIN_TEXT_PT));
  let charW = $derived(FS * CHAR_RATIO);
  let lineH = $derived(FS * LINE_RATIO);
  let W = $derived(Math.max(50, Number(widthCm) || 600) * CM);
  let maxH = $derived(Math.max(20, Number(maxHeightCm) || 300) * CM);

  onMount(() => {
    const css = getComputedStyle(document.documentElement);
    const highlight = css.getPropertyValue("--highlight").trim();
    const fadeValue = parseFloat(css.getPropertyValue("--highlight-fade"));
    if (Number.isFinite(fadeValue)) highlightFade = fadeValue;
    const highlightEnd = css.getPropertyValue("--highlight-end").trim();
    for (const c of categories) {
      if (c.type === "canonical") continue;
      if (highlight) c.color = highlight;
      if (highlightEnd) c.colorEnd = highlightEnd;
    }
    loadArticles();
    loadReportTranslations().then((map) => {
      translatedMap = map;
      translationsReady = true;
    });
  });

 
 
  const DARKEST = "#8f8f8f";
  const LIGHTEST = "#ededed";
 
  const FADE_BOTTOM = 0.7;
  const FADE_TOP = 0.85;
  const mixHex = (a, b, f) =>
    "#" + [1, 3, 5].map((i) => Math.round(parseInt(a.slice(i, i + 2), 16) * (1 - f) + parseInt(b.slice(i, i + 2), 16) * f).toString(16).padStart(2, "0")).join("");

 
  let built = $derived.by(() => {
    const counts = Object.fromEntries(categories.map((c) => [c.id, 0]));
    findBoilerplate($articles);
    const branchCats = categories.filter((c) => c.type === "canonical");
    const highlightCats = categories.filter((c) => c.type !== "canonical");
    const items = [];
    for (const a of $articles) {
      const region = detectRegion(a);
      if (region === "Berlin" && !showBerlin) continue;
      if (region === "Brandenburg" && !showBrandenburg) continue;
      if (/bilanz/i.test(a.Title || "")) continue;
      const date = parseDateLoose(a.ExtractedDate || a.Date);
      if (!date || date < MIN_DATE) continue;

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
  });

 
  let stackOrder = $derived.by(() => {
    const ids = categories
      .filter((c) => c.type === "canonical" && c.on && (built.counts[c.id] ?? 0) > 0)
      .sort((a, b) => (built.counts[b.id] ?? 0) - (built.counts[a.id] ?? 0))
      .map((c) => c.id);
    return smallFirst ? ids.reverse() : ids;
  });
  let grays = $derived(
    Object.fromEntries(
      stackOrder.map((id, i) => {
        const f = stackOrder.length > 1 ? i / (stackOrder.length - 1) : 0;
        return [id, { band: mixHex(DARKEST, LIGHTEST, f), fade: FADE_BOTTOM + (FADE_TOP - FADE_BOTTOM) * f }];
      }),
    ),
  );

 
  const pad2 = (n) => String(n).padStart(2, "0");
  // date and district are notes: set smaller than the text
  const NOTE_SCALE = 0.7;
  let noteFs = $derived(FS * NOTE_SCALE);
  // how wide runs are, each in its own size
  const runsWidth = (runs) => runs.reduce((s, r) => s + r.text.length * (r.fs ?? FS) * CHAR_RATIO, 0);

  let lineBase = $derived((lineH - FS * (ASCENT + DESCENT)) / 2 + FS * ASCENT);
  const line = (lane, runs) => ({
    lane,
    runs,
    fs: FS,
    baseline: lineBase,
    len: runsWidth(runs),
  });

  let span = $derived.by(() => {
    const dates = built.items.map((it) => +it.date);
    if (!dates.length) return null;
    const max = Math.max(...dates);
    const min = new Date(new Date(Math.min(...dates)).getFullYear(), 0, 1);
    return { min: +min, max };
  });
 
 
  let margin = $derived.by(() => {
    const lens = built.items
      .map((it) => (it.segment.text.length + 20) * charW)
      .sort((a, b) => a - b);
    return lens.length
      ? Math.min(W / 4, lens[Math.floor(lens.length / 2)] / 2)
      : 0;
  });
 
  let shrink = 0;
  const xOf = (date) => {
    if (!span) return 0;
    const t = (+date - span.min) / (span.max - span.min || 1);
    return margin + (newestLeft ? 1 - t : t) * (W - 2 * margin - shrink);
  };

 
 
  // A report in German and in English, sentence by sentence, so the same
  // stretch can be cut from both: a window of n German characters centred on
  // the found word, and the English of exactly those sentences, cut at the
  // same points within them. German and English always say the same thing.
  function paired(it) {
    const seg = it.segment;
    const raw = splitSentences(it.text || "");
    if (!raw.length) return null;
    const norm = (t) => String(t ?? "").replace(/\s+/g, " ").trim();
    let D = "", E = "";
    const dS = [], dL = [], eS = [], eL = [];
    for (const sentence of raw) {
      const d = norm(sentence), e = norm(translatedMap[sentence] ?? translatedMap[d] ?? "");
      if (D) D += " ";
      dS.push(D.length);
      dL.push(d.length);
      D += d;
      if (E && e) E += " ";
      eS.push(E.length);
      eL.push(e.length);
      E += e;
    }
    const full = norm(seg.full ?? seg.text);
    let k = raw.findIndex((x) => norm(x) === full);
    if (k < 0) k = raw.findIndex((x) => norm(x).includes(full.replace(/^…|…$/g, "").slice(0, 40)));
    if (k < 0) return null;
    const centre = dS[k] + (seg.at ?? 0.5) * dL[k];
    // a place in the German, as the same place in the English
    const toEn = (pos) => {
      let i = 0;
      while (i + 1 < dS.length && dS[i + 1] <= pos) i++;
      return eS[i] + Math.min(1, Math.max(0, (pos - dS[i]) / Math.max(1, dL[i]))) * eL[i];
    };
    // the found word in the English: its translation within the translated
    // sentence, else the same place in it
    let enCentre = toEn(centre);
    const word = seg.word ? norm(translatedMap[seg.word.toLowerCase()] ?? "") : "";
    if (word && eL[k]) {
      const at = E.slice(eS[k], eS[k] + eL[k]).toLowerCase().indexOf(word.toLowerCase());
      if (at >= 0) enCentre = eS[k] + at + word.length / 2;
    }
    // Whole words within `half` either side of `c`, cut the same on both
    // sides, so the found word is always in the middle; "…" where text goes on.
    const around = (text, c, half) => {
      half = Math.max(0, Math.min(half, c, text.length - c));
      let a = Math.round(c - half), b = Math.round(c + half);
      while (a > 0 && a < b && text[a - 1] !== " ") a++;
      while (b < text.length && b > a && text[b] !== " ") b--;
      const body = text.slice(a, b).trim();
      return body ? (a > 0 ? "…" : "") + body + (b < text.length ? "…" : "") : "";
    };
    return {
      max: D.length,
      de: (n) => around(D, centre, n / 2),
      // as much English as the German window covers, centred on the word
      en: (n) => (E ? around(E, enCentre, (toEn(centre + n / 2) - toEn(centre - n / 2)) / 2) : ""),
    };
  }

  function labelItem(cat, x) {
    const de = (cat.labelDe || cat.label).toUpperCase();
    const en = cat.label.toUpperCase();
    const text =
      langMode === "de"
        ? de
        : langMode === "en"
          ? en
          : de === en
            ? de
            : `${de} · ${en}`;
    const h = Math.max(1, Math.round(Number(labelLanes) || 0));
    const fs = Math.max(FS, h * lineH * 0.78);
    const len = text.length * fs * CHAR_RATIO;
    const baseline = (h * lineH - fs * (ASCENT + DESCENT)) / 2 + fs * ASCENT;
    return {
      x,
      len: len + 2 * charW,
      h,
      label: true,
      lines: [{ lane: 0, runs: [{ text, style: "label" }], fs, baseline, len }],
    };
  }

  function makeBands() {
    const gap = 2 * charW;
    const every = Math.max(20, Number(labelEveryCm) || 150) * CM;
    return categories
      .filter((c) => c.type === "canonical" && c.on)
      .map((cat) => {
        const items = [];
        let lastLabel = -Infinity;
        const own = built.items
          .filter((it) => it.catId === cat.id)
          .sort((a, b) => +a.date - +b.date);
        for (const it of own) {
          // German and English cut from the same stretch of the report
          const pair = paired(it);
          const snip = settings.SEGMENT_SNIP_MAX;
          let en = langMode === "de" ? "" : pair ? pair.en(snip) : translateSegment(it.segment, translatedMap);
          const de = langMode === "en" && en ? "" : pair ? pair.de(snip) : it.segment.text;
          const meta = {
            text: `${pad2(it.date.getDate())}.${pad2(it.date.getMonth() + 1)}.${pad2(it.date.getFullYear() % 100)} ${it.district ? it.district + " " : ""}`,
            style: "meta",
            fs: noteFs,
          };
          const texts = [
            de && { text: de, style: "de" },
            en && { text: en, style: "en" },
          ].filter(Boolean);
         
         
         
          const date = `${pad2(it.date.getDate())}.${pad2(it.date.getMonth() + 1)}.${pad2(it.date.getFullYear() % 100)}`;
          const district = it.district || "";
          const width = Math.max(date.length, district.length) + 1;
          const rows =
            dateMode === "aligned" && texts.length > 1
              ? [
                 
                  [
                    { text: date.padStart(width - 1) + " ", style: "meta", fs: noteFs },
                    texts[0],
                  ],
                  [
                    { text: district.padStart(width - 1) + " ", style: "meta", fs: noteFs },
                    texts[1],
                  ],
                ]
              : // one long line: date and district, the German, then the English
                [[meta, { text: texts.map((t) => t.text).join("   "), style: texts[0].style }]];
          const lines = rows.map((runs, i) => line(i, runs));
          let itemJoint = null;
         
          // Lines can grow to fill a gap: German and English together, from
          // the same wider stretch of the report, still centred on the word.
          if (fillGaps && pair) {
            const growing = lines.filter((l) => l.runs.at(-1).style !== "meta");
            for (const l of growing) {
              l.resize = true;
              l.resizeRun = l.runs.length - 1;
            }
            const texts = (n) => {
              const d = de ? pair.de(n) : "", e = en ? pair.en(n) : "";
              return rows.length === 1 && d && e ? [d + "   " + e] : [d, e].filter(Boolean);
            };
            itemJoint = { n: snip, max: pair.max + 2, texts };
          }
          const len = Math.max(...lines.map((l) => l.len));
          const x = xOf(it.date) - len / 2;
          if (labelLanes > 0 && Math.abs(x - lastLabel) >= every) {
            items.push(labelItem(cat, Math.max(0, x - 1)));
            lastLabel = x;
          }
         
          const report = it.highlightId
            ? it
            : { ...it, color: grays[cat.id]?.band ?? it.color, fadeAt: grays[cat.id]?.fade };
          items.push({ x, len: len + gap, h: lines.length, lines, report, joint: itemJoint });
        }
        return { id: cat.id, cat, items };
      })
      .filter((b) => b.items.length);
  }

  let AXIS_H = $derived(FS * 5);
  let chart = $derived.by(() => {
    const options = {
      W,
      lineH,
      slack: Math.max(0, Number(slackCm) || 0) * CM,
      grid: 30,
      sigma: Math.max(2, Number(smoothCm) || 60) * CM,
      room: Math.max(1, (Number(roomPct) || 105) / 100),
     
     
      bandGap: Math.max(0, Number(gapLines) || 0),
      fill: fillGaps,
      charRatio: CHAR_RATIO,
      slope: Math.min(1, Math.max(0.05, Number(maxSlope) || 0.25)),
      smallFirst,
      order: stackOrder,
    };
   
   
    const bend = makeWave({
      amplitude: Math.max(0, Number(waveCm) || 0) * CM,
      length: Math.max(10, Number(waveLengthCm) || 90) * CM,
      seed,
      height: maxH * 2,
    });
    options.wave = bend.wave;
    options.lineH = lineH * (1 + bend.squeeze);
   
   
    shrink = 0;
    let result = null;
    for (let pass = 0; pass < 4; pass++) {
      const bands = makeBands();
      if (!bands.length) return null;
      result = layoutStreams(bands, options);
      if (result.W <= W + 1) break;
      shrink += result.W - W;
    }
    result.shrink = shrink;
    return result;
  });
  let totalH = $derived(chart ? chart.H + AXIS_H : 0);
  const tooBig = () => totalH > maxH + 1 || chart.W > W + 1;
  let tooTall = $derived(!!chart && tooBig());
  let years = $derived.by(() => {
    if (!span || !chart) return [];
    const out = [];
    for (
      let y = new Date(span.min).getFullYear();
      new Date(y, 0, 1) <= span.max;
      y++
    ) {
     
      const x = xOf(new Date(y, 0, 1)),
        x2 = xOf(new Date(Math.min(+new Date(y + 1, 0, 1), span.max)));
      out.push({ year: y, x, lx: Math.min(x, x2) });
    }
    return out;
  });

 
  function fitSnippets() {
    let lo = 20,
      hi = 600;
    while (hi - lo > 2) {
      const mid = Math.round((lo + hi) / 2);
      settings.SEGMENT_SNIP_MAX = mid;
      if (tooBig()) hi = mid;
      else lo = mid;
    }
    settings.SEGMENT_SNIP_MAX = lo;
  }

  let autoFit = $state(true);
  let fitTimer;
  let fitKey = $derived(
    JSON.stringify([
      W, maxH, FS, langMode, categories.map((c) => c.on), slackCm, smoothCm, maxSlope, roomPct,
      labelLanes, labelEveryCm, waveCm, waveLengthCm, fillGaps, gapLines,
      dateMode, smallFirst, newestLeft, showBerlin, showBrandenburg, $articles.length, translationsReady,
    ]),
  );
  let fittedKey = $state(null);
  let ready = $derived(!!$articles.length && translationsReady && (!autoFit || fittedKey === fitKey));
  let fitting = $derived(!!$articles.length && !ready);
  $effect(() => {
    const key = fitKey;
    if (!autoFit || !$articles.length || !translationsReady) return;
    clearTimeout(fitTimer);
    fitTimer = setTimeout(() => {
      fitSnippets();
      fittedKey = key;
    }, 60);
  });

 
 
 
  let canvasEl = $state(null);
  const PX_PER_PT = 96 / 72;
  const PAD = 12;
  let viewW = $state(800);
  let viewH = $state(600);
  let view = d3.zoomIdentity;
  let renderer = null;
  const redraw = () => renderer?.draw(view);
  const zoomer = d3
    .zoom()
    .scaleExtent([0.005, 4])
    .on("zoom", (e) => {
      view = e.transform;
      redraw();
    });
  let theme = $derived(THEMES[dark ? "dark" : "light"]);
  $effect(() => {
    if (!canvasEl) return;
    renderer = createRenderer(canvasEl);
    d3.select(canvasEl).call(zoomer).on("dblclick.zoom", null);
    return () => (renderer = null);
  });
  let look = $derived({
    ...theme,
    years,
    yearSize: FS * 3,
    gradientEnd: GRADIENT_END_AT / 100,
   
    bandEnd: dark ? theme.background : null,
  });
 
  $effect(() => {
    if (!canvasEl || !chart || !ready) return;
    const style = { charRatio: CHAR_RATIO, fade: highlightFade };
    untrack(() => {
      renderer?.set(chart, style, look);
      fitAll();
    });
   
    document.fonts?.ready.then(() => untrack(() => renderer?.look(look)));
  });
 
  $effect(() => {
    const l = look;
    untrack(() => renderer?.look(l));
  });
  $effect(() => {
    viewW;
    viewH;
    untrack(redraw);
  });
  function zoomTo(k, x = PAD, y = PAD) {
    if (canvasEl)
      d3.select(canvasEl).call(
        zoomer.transform,
        d3.zoomIdentity.translate(x, y).scale(k),
      );
  }
  const fitAll = () =>
    chart &&
    zoomTo(Math.min((viewW - 2 * PAD) / chart.W, (viewH - 2 * PAD) / totalH));
  const fitHeight = () => chart && zoomTo((viewH - 2 * PAD) / totalH);

  const toChart = (e) => {
    const r = canvasEl.getBoundingClientRect();
    return view.invert([e.clientX - r.left, e.clientY - r.top]);
  };
  let pointer = $state(false);
  function onMove(e) {
    if (!renderer) return;
    pointer = !!renderer.reportAt(...toChart(e))?.raw?.URL;
  }
  let downAt = null;
  function onClick(e) {
   
    if (downAt && Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 4)
      return;
    const url = renderer?.reportAt(...toChart(e))?.raw?.URL;
    if (url) window.open(url, "_blank", "noreferrer");
  }

 
  let exportingPdf = $state(false);
  async function exportPDF() {
    if (!chart || !renderer) return;
    exportingPdf = true;
   
    await new Promise((r) => setTimeout(r, 30));
    try {
      const { exportPdf } = await import("./streamPdf.js");
      await exportPdf({
        W: chart.W,
        H: totalH,
        chartH: chart.H,
        texts: renderer.texts(),
        years,
        theme: look,
        yearSize: FS * 3,
        file: "timeline-streams.pdf",
      });
    } finally {
      exportingPdf = false;
    }
  }

 
  const esc = (t) =>
    t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  function exportSVG() {
    if (!chart) return;
    const t = theme;
    const anyLit = chart.texts.some((x) => x.item.report?.highlightId);
    const out = [];
    out.push(
      `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" xml:space="preserve" width="${chart.W.toFixed(2)}pt" height="${totalH.toFixed(2)}pt" viewBox="0 0 ${chart.W.toFixed(2)} ${totalH.toFixed(2)}" font-family='"Pitch Sans", Courier, monospace'>`,
    );
    out.push(`<rect width="100%" height="100%" fill="${t.background}"/>`);
    for (const y of years) {
      out.push(`<line x1="${y.x.toFixed(1)}" x2="${y.x.toFixed(1)}" y1="${(chart.H + FS * 0.45).toFixed(1)}" y2="${(chart.H + FS * 1.35).toFixed(1)}" stroke="${t.axis}" stroke-width="1.5"/>`);
      out.push(`<text x="${y.x.toFixed(1)}" y="${(chart.H + FS * 3.9).toFixed(1)}" text-anchor="middle" font-size="${FS * 3}" fill="${t.axis}">${y.year}</text>`);
    }
    out.push("<defs>");
    chart.lines.forEach((l, i) => {
      const pts = [];
      for (let k = 0; k < l.xs.length; k++)
        pts.push(`${l.xs[k].toFixed(1)},${l.ys[k].toFixed(1)}`);
      out.push(`<path id="l${i}" d="M${pts.join("L")}"/>`);
    });
    out.push("</defs>");
   
    (renderer?.bands() ?? []).forEach((b, i) => {
      out.push(
        `<linearGradient id="g${i}" gradientUnits="userSpaceOnUse" x1="${b.a.x.toFixed(1)}" y1="${b.a.y.toFixed(1)}" x2="${b.b.x.toFixed(1)}" y2="${b.b.y.toFixed(1)}"><stop offset="0" stop-color="${b.color}"/><stop offset="${(b.fadeAt ?? GRADIENT_END_AT / 100).toFixed(3)}" stop-color="${look.bandEnd ?? b.end}"/></linearGradient>`,
      );
      const d =
        "M" +
        b.pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join("L") +
        "Z";
      out.push(
        `<path d="${d}" fill="url(#g${i})"${b.alpha < 1 ? ` opacity="${b.alpha}"` : ""}/>`,
      );
    });
    const blend = t.blend ? ` style="mix-blend-mode: ${t.blend}"` : "";
    for (const x of chart.texts) {
      const report = x.item.report,
        lit = !!report?.highlightId;
      const opacity =
        anyLit && report && !lit ? ` opacity="${highlightFade}"` : "";
      const spans = x.line.runs
        .map(
          (r) =>
            `<tspan fill="${t[r.style] ?? t.de}"${r.fs ? ` font-size="${r.fs.toFixed(2)}"` : ""}${r.style === "label" ? ' font-weight="700"' : ""}>${esc(r.text)}</tspan>`,
        )
        .join("");
      const track = x.line.track
        ? ` letter-spacing="${x.line.track.toFixed(2)}"`
        : "";
      out.push(
        `<text font-size="${x.line.fs.toFixed(2)}"${opacity}${blend}${track}><textPath xlink:href="#l${x.lineIndex}" href="#l${x.lineIndex}" startOffset="${x.offset.toFixed(2)}">${spans}</textPath></text>`,
      );
    }
    out.push("</svg>");
    const url = URL.createObjectURL(
      new Blob([out.join("\n")], { type: "image/svg+xml" }),
    );
    Object.assign(document.createElement("a"), {
      href: url,
      download: "timeline-streams.svg",
    }).click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
</script>

<div class="page">
  <div class="chart-wrap" bind:clientWidth={viewW} bind:clientHeight={viewH}>
    {#if !ready}
      <p class="loading overlay">{$articles.length ? "Preparing…" : "Loading…"}</p>
    {/if}
    {#if $articles.length && chart}
      <canvas
        bind:this={canvasEl}
        class="chart"
        class:pointer
        onmousemove={onMove}
        onmousedown={(e) => (downAt = [e.clientX, e.clientY])}
        onclick={onClick}
      ></canvas>
    {/if}
  </div>

  {#snippet num(label, title, value, set, min = 0, step = 1)}
    <label class="param-row" {title}>
      <span>{label}</span><input type="number" {min} {step} {value} onchange={(e) => set(+e.currentTarget.value)} />
    </label>
  {/snippet}
  {#snippet choice(options, current, set)}
    <div class="btn-row">
      {#each options as [value, label]}
        <button class="toggle-btn" class:active={current === value} onclick={() => set(value)}>{label}</button>
      {/each}
    </div>
  {/snippet}

  <aside class="panel">
    <div class="section-title">Paper</div>
    <div class="paper" class:over={tooTall}>
      {#if ready}{Math.round((chart?.W ?? W) / CM)} × {Math.round(totalH / CM)} cm{:else}…{/if}
    </div>
    <div class="note">
      {#if fitting}fitting…{:else if chart}text fills {Math.round(chart.fill.chart * 100)}% · snippets {settings.SEGMENT_SNIP_MAX} characters{/if}
      {#if tooTall}<br /><span class="over">larger than the paper even with the shortest snippets</span>{/if}
    </div>
    <div class="pair">
      {@render num("Width (cm)", "Width of the print: the time axis", widthCm, (v) => (widthCm = v), 50, 10)}
      {@render num("Height (cm)", "Height of the print", maxHeightCm, (v) => (maxHeightCm = v), 20, 10)}
    </div>

    <div class="section-title">View</div>
    <div class="btn-row">
      <button class="plain-btn" onclick={fitAll} title="Whole chart in view">Fit</button>
      <button class="plain-btn" onclick={fitHeight} title="Full height in view">Height</button>
      <button class="plain-btn" onclick={() => canvasEl && d3.select(canvasEl).call(zoomer.scaleTo, PX_PER_PT)} title="Real size: text as big on screen as on paper">1:1</button>
    </div>

    <div class="section-title">Language</div>
    {@render choice([["de", "DE"], ["en", "EN"], ["both", "Both"]], langMode, (v) => (langMode = v))}

    <div class="section-title">Lines</div>
    {@render choice([["aligned", "2 lines"], ["inline", "1 line"]], dateMode, (v) => (dateMode = v))}

    <div class="section-title">Order</div>
    {@render choice([[false, "Biggest at bottom"], [true, "Smallest at bottom"]], smallFirst, (v) => (smallFirst = v))}
    <div style="height:4px"></div>
    {@render choice([[false, "Oldest → newest"], [true, "Newest → oldest"]], newestLeft, (v) => (newestLeft = v))}

    <div class="section-title">Look</div>
    <div class="btn-row">
      <button class="toggle-btn" class:active={dark} onclick={() => (dark = !dark)} title="Light text on black">Dark</button>
    </div>

    {#each [["Categories", true], ["Commentary", false]] as [title, canonical]}
      <div class="section-title">{title}</div>
      {#each categories.filter((c) => (c.type === "canonical") === canonical) as cat}
        <button class="leg-row" class:off={!cat.on} onclick={() => (cat.on = !cat.on)}>
          <span class="leg-chip" style:background={cat.on ? (grays[cat.id]?.band ?? cat.color ?? "#999") : undefined}>{cat.label}</span>
          <span class="leg-count">{built.counts[cat.id] ?? 0}</span>
        </button>
      {/each}
    {/each}

    <div class="section-title">Region</div>
    <label class="check-row"><input type="checkbox" bind:checked={showBerlin} /> Berlin</label>
    <label class="check-row"><input type="checkbox" bind:checked={showBrandenburg} /> Brandenburg</label>

    <div class="section-title">Export</div>
    <div class="btn-row">
      <button class="plain-btn" onclick={exportPDF} disabled={!chart || exportingPdf} title="Vector PDF at print size; takes a few seconds"
        >{exportingPdf ? "Making…" : "PDF"}</button
      >
      <button class="plain-btn" onclick={exportSVG} disabled={!chart} title="SVG at print size">SVG</button>
    </div>

    <details class="advanced">
      <summary>Advanced</summary>
      {@render num(`Text (pt)`, `Printed text size, never below ${MIN_TEXT_PT} pt`, textPt, (v) => (textPt = v), MIN_TEXT_PT)}
      <label class="check-row" title="Whenever something changes the size, the snippet length is found again so the chart fits the paper"
        ><input type="checkbox" bind:checked={autoFit} /> Always fit the paper</label
      >
      {#if !autoFit}
        {@render num("Snippet length", "Longest quoted snippet in characters, per language", settings.SEGMENT_SNIP_MAX, (v) => (settings.SEGMENT_SNIP_MAX = v), 20, 10)}
        <button class="plain-btn" onclick={fitSnippets} disabled={!chart} title="Longest snippets with which the chart still fits the paper">Fit snippet length</button>
      {/if}
      <label class="check-row" title="Each report grows, still centred on its word, into the free room beside it on its line"
        ><input type="checkbox" bind:checked={fillGaps} /> Fill gaps with more text</label
      >
      {@render num("Wave (cm)", "How far the lines swing up and down. 0 = no wave.", waveCm, (v) => (waveCm = v), 0, 1)}
      {@render num("Wave length (cm)", "The length of one swing of the wave", waveLengthCm, (v) => (waveLengthCm = v), 10, 10)}
      {@render num("Time slack (cm)", "How far a report may move from its date to fit", slackCm, (v) => (slackCm = v), 0, 5)}
      {@render num("Smoothing (cm)", "How far the amount of text is smoothed along time", smoothCm, (v) => (smoothCm = v), 2, 5)}
      {@render num("Max slope", "Steepest an edge between two streams may be (height / width)", maxSlope, (v) => (maxSlope = v), 0.05, 0.05)}
      {@render num("Room (%)", "Room in each stream, in % of its text", roomPct, (v) => (roomPct = v), 100, 5)}
      {@render num("Gap between streams", "White between two streams, in lines", gapLines, (v) => (gapLines = v), 0, 0.2)}
      {@render num("Name size (lines)", "Height of the category names in lines. 0 = no names.", labelLanes, (v) => (labelLanes = v), 0, 1)}
      {@render num("Name every (cm)", "A stream repeats its name every this many cm", labelEveryCm, (v) => (labelEveryCm = v), 20, 10)}
      {#if chart?.overflow}<div class="note over">{chart.overflow} reports did not fit their stream: more room</div>{/if}
    </details>
  </aside>
</div>

<style>
  :global(body) {
    margin: 0;
    background: #fff;
    overflow: hidden;
  }

  .page {
    display: flex;
    width: 100vw;
    height: 100vh;
    background: #fff;
  }
  .chart-wrap {
    position: relative;
    flex: 1;
    min-width: 0;
    overflow: hidden;
  }
  svg {
    display: block;
  }
  .chart {
    display: block;
    width: 100%;
    height: 100%;
    cursor: grab;
  }
  .chart.pointer {
    cursor: pointer;
  }

  .overlay {
    position: absolute;
    inset: 0;
    margin: 0;
    background: #fff;
    z-index: 1;
  }
  .loading {
    padding: 32px;
    color: #aaa;
    font-size: 13px;
    font-family: var(--font-mono);
  }

  .panel {
    flex-shrink: 0;
    box-sizing: border-box;
    width: 220px;
    height: 100vh;
    padding: 12px;
    overflow-y: auto;
    background: #f4f3ef;
    border-left: 1px solid #ddd;
    font-family: var(--font-mono);
    font-size: 11px;
    color: #555;
  }
  .section-title {
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: #aaa;
    margin: 16px 0 4px;
  }
  .section-title:first-child {
    margin-top: 0;
  }
  .paper {
    font-size: 16px;
    color: #000;
  }
  .over {
    color: #d00000 !important;
  }
  .note {
    font-size: 10px;
    color: #888;
    padding: 3px 0;
  }

  .pair {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px;
  }
  .pair .param-row {
    flex-direction: column;
    align-items: stretch;
  }
  .pair .param-row input {
    width: 100%;
    box-sizing: border-box;
  }
  .advanced {
    margin-top: 16px;
  }
  .advanced summary {
    cursor: pointer;
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: #aaa;
    margin-bottom: 6px;
  }
  .btn-row {
    display: flex;
    gap: 4px;
  }
  .plain-btn,
  .toggle-btn {
    flex: 1;
    width: 100%;
    box-sizing: border-box;
    border: 1px solid #bbb;
    background: #fff;
    color: #333;
    cursor: pointer;
    font: inherit;
    padding: 5px;
    text-align: center;
  }
  .plain-btn:hover,
  .toggle-btn:hover,
  .toggle-btn.active {
    background: #111;
    color: #fff;
    border-color: #111;
  }
  .plain-btn:disabled {
    opacity: 0.4;
    cursor: default;
  }

  .param-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 6px;
    padding: 1px 0;
    font-size: 10px;
  }
  .param-row input {
    width: 3.6rem;
    border: 1px solid #d4d4d4;
    background: #fff;
    font: inherit;
    padding: 2px 4px;
  }
  .check-row {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 3px 0;
    cursor: pointer;
  }
  .check-row input {
    accent-color: #555;
  }

  .leg-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 6px;
    width: 100%;
    background: none;
    border: none;
    cursor: pointer;
    font: inherit;
    color: #000;
    padding: 2px 0;
    text-align: left;
  }
  .leg-count {
    font-size: 10px;
    color: #aaa;
    flex-shrink: 0;
  }
  .leg-chip {
    padding: 1px 4px;
    background: #e0e0e0;
  }
  .leg-row.off .leg-chip {
    background: none !important;
    color: #bbb;
    text-decoration: line-through;
  }
</style>
