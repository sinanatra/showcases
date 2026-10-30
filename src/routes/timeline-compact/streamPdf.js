import { jsPDF } from "jspdf";
import { download } from "$lib/utils/download";

const STEPS = 12;

const rgb = (c) => {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(c).trim());
  return m
    ? [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16))
    : [0, 0, 0];
};
const mix = (a, b, f) => a.map((v, i) => Math.round(v + (b[i] - v) * f));

let fontB64 = null;
async function loadFont() {
  if (fontB64) return fontB64;
  const res = await fetch("/fonts/Pitch_Semibold.ttf").catch(() => null);
  if (!res?.ok) return null;
  const bytes = new Uint8Array(await res.arrayBuffer());
  // TrueType only
  if (!(bytes[0] === 0 && bytes[1] === 1 && bytes[2] === 0 && bytes[3] === 0))
    return null;
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000)
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return (fontB64 = btoa(bin));
}

/**
 * @param {{ W: number, H: number, chartH: number, texts: any[], look: any, file: string }} o
 *   texts = the placed letters from the renderer, look = theme with years and yearSize
 */
export async function exportPdf(o) {
  const scale = Math.max(1, Math.ceil(Math.max(o.W, o.H) / 14400));
  const k = 1 / scale;
  const pageW = o.W * k, pageH = o.H * k;
  const pdf = new jsPDF({
    orientation: o.W >= o.H ? "landscape" : "portrait",
    unit: "pt",
    format: [pageW, pageH],
    compress: true,
  });
  if (scale > 1) pdf.internal.write(`q ${k} 0 0 ${k} 0 ${pageH * (1 - k)} cm`);

  let font = "courier";
  const b64 = await loadFont();
  if (b64) {
    pdf.addFileToVFS("PitchSans-Semibold.ttf", b64);
    pdf.addFont("PitchSans-Semibold.ttf", "Pitch Sans", "normal");
    font = "Pitch Sans";
  }
  const setFont = (weight) =>
    pdf.setFont(font, font === "courier" && weight > 400 ? "bold" : "normal");

  const theme = o.look;
  const bg = rgb(theme.background);
  const ink = rgb(theme.ink);
  pdf.setFillColor(...bg);
  pdf.rect(0, 0, o.W, o.H, "F");

  setFont(400);
  pdf.setFontSize(theme.yearSize);
  pdf.setTextColor(...ink);
  for (const y of theme.years)
    pdf.text(String(y.year), y.x, o.chartH + theme.yearSize * 1.3);

  const shape = (pts) => {
    const rel = [];
    for (let i = 1; i < pts.length; i++)
      rel.push([
        pts[i][0] - pts[i - 1][0],
        pts[i][1] - pts[i - 1][1],
      ]);
    pdf.lines(rel, pts[0][0], pts[0][1], [1, 1], "F", true);
  };
  const faded = new Map();
  const opacity = (a) => {
    if (!faded.has(a)) faded.set(a, new pdf.GState({ opacity: a }));
    pdf.setGState(faded.get(a));
  };

  for (const b of o.texts.flatMap((t) => t.bands)) {
    opacity(b.alpha);
    const start = rgb(b.color),
      end = rgb(theme.bandEnd ?? b.end);
    const half = b.pts.length / 2;
    const top = b.pts.slice(0, half),
      bottom = b.pts.slice(half).reverse();
    const n = top.length - 1;
    const fadeTo = Math.max(1, Math.round(n * (b.fadeAt ?? theme.gradientEnd)));
    for (let s = 0; s < STEPS; s++) {
      const i0 = Math.floor((s * fadeTo) / STEPS),
        i1 = s === STEPS - 1 ? n : Math.floor(((s + 1) * fadeTo) / STEPS);
      if (i1 <= i0) continue;
      const c = mix(start, end, s / (STEPS - 1));
      if (s === STEPS - 1 && c.every((v, j) => v === bg[j])) continue;
      pdf.setFillColor(...c);
      shape([...top.slice(i0, i1 + 1), ...bottom.slice(i0, i1 + 1).reverse()]);
    }
  }
  opacity(1);

  pdf.setTextColor(...ink);
  for (const t of o.texts) {
    opacity(t.alpha);
    setFont(t.weight);
    let size = 0;
    for (let i = 0; i < t.chars.length; i++) {
      const fs = t.sizes[i];
      if (fs !== size) pdf.setFontSize((size = fs));

      const a = t.angles[i];
      const x = t.xs[i] - Math.cos(a) * (fs * 0.3),
        y = t.ys[i] - Math.sin(a) * (fs * 0.3);
      pdf.text(t.chars[i], x, y, { angle: (-a * 180) / Math.PI });
    }
  }
  opacity(1);

  if (scale > 1) pdf.internal.write("Q");

  // const file = scale > 1 ? o.file.replace(/\.pdf$/, `-at-1-${scale}.pdf`) : o.file;
  download(new Blob([pdf.output("arraybuffer")], { type: "application/pdf" }), o.file);
  return scale;
}
