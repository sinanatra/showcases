import { jsPDF } from "jspdf";

const MAX_PT = 14400;
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

  if (!(bytes[0] === 0 && bytes[1] === 1 && bytes[2] === 0 && bytes[3] === 0))
    return null;
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000)
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return (fontB64 = btoa(bin));
}

/**
 * @param {{ W: number, H: number, texts: any[], years: { x: number, year: number }[], theme: any, yearSize: number, chartH: number, file: string }} o
 */
export async function exportPdf(o) {
  const userUnit = Math.max(1, Math.ceil(Math.max(o.W, o.H) / MAX_PT));
  const k = 1 / userUnit;
  const pdf = new jsPDF({
    orientation: o.W >= o.H ? "landscape" : "portrait",
    unit: "pt",
    format: [o.W * k, o.H * k],
    userUnit,
    compress: true,
  });

  let font = "courier";
  const b64 = await loadFont();
  if (b64) {
    pdf.addFileToVFS("PitchSans-Semibold.ttf", b64);
    pdf.addFont("PitchSans-Semibold.ttf", "Pitch Sans", "normal");
    font = "Pitch Sans";
  }
  const setFont = (weight) =>
    pdf.setFont(font, font === "courier" && weight > 400 ? "bold" : "normal");

  const theme = o.theme;
  const bg = rgb(theme.background);
  pdf.setFillColor(...bg);
  pdf.rect(0, 0, o.W * k, o.H * k, "F");

  pdf.setDrawColor(...rgb(theme.grid));
  pdf.setLineWidth(0.75 * k);
  for (const y of o.years) pdf.line(y.x * k, 0, y.x * k, o.chartH * k);
  setFont(400);
  pdf.setFontSize(o.yearSize * k);
  pdf.setTextColor(...rgb(theme.axis));
  for (const y of o.years)
    pdf.text(
      String(y.year),
      (y.lx + o.yearSize * 0.15) * k,
      (o.chartH + o.yearSize * 1.1) * k,
    );

  const shape = (pts) => {
    const rel = [];
    for (let i = 1; i < pts.length; i++)
      rel.push([
        (pts[i][0] - pts[i - 1][0]) * k,
        (pts[i][1] - pts[i - 1][1]) * k,
      ]);
    pdf.lines(rel, pts[0][0] * k, pts[0][1] * k, [1, 1], "F", true);
  };
  const faded = new Map();
  const opacity = (a) => {
    if (!faded.has(a)) faded.set(a, new pdf.GState({ opacity: a }));
    pdf.setGState(faded.get(a));
  };

  for (const t of o.texts) {
    const b = t.band;
    if (!b) continue;
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

  for (const t of o.texts) {
    opacity(t.alpha);
    setFont(t.weight);
    pdf.setFontSize(t.fs * k);
    let color = "";
    for (let i = 0; i < t.chars.length; i++) {
      const c = theme[t.kinds[i]] ?? theme.de;
      if (c !== color) pdf.setTextColor(...rgb((color = c)));

      const a = t.angles[i];
      const x = t.xs[i] - Math.cos(a) * (t.fs * 0.3),
        y = t.ys[i] - Math.sin(a) * (t.fs * 0.3);
      pdf.text(t.chars[i], x * k, y * k, { angle: (-a * 180) / Math.PI });
    }
  }
  opacity(1);

  const bytes = new Uint8Array(pdf.output("arraybuffer"));

  if (userUnit > 1) bytes.set(new TextEncoder().encode("%PDF-1.6"), 0);
  const url = URL.createObjectURL(
    new Blob([bytes], { type: "application/pdf" }),
  );
  Object.assign(document.createElement("a"), {
    href: url,
    download: o.file,
  }).click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
