import { download } from "$lib/utils/download";
import { FONT } from "./streamCanvas.js";

const esc = (t) =>
  t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * @param {{ chart: any, H: number, bands: any[], look: any, charRatio: number, fade: number, file: string }} o
 *   bands = the bands under the reports, from the renderer
 */
export function exportSvg({ chart, H, bands, look, charRatio, fade, file }) {
  const anyLit = chart.texts.some((x) => x.item.report?.highlightId);
  const out = [];
  out.push(
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" xml:space="preserve" width="${chart.W.toFixed(2)}pt" height="${H.toFixed(2)}pt" viewBox="0 0 ${chart.W.toFixed(2)} ${H.toFixed(2)}" font-family='${FONT}'>`,
  );
  out.push(`<rect width="100%" height="100%" fill="${look.background}"/>`);
  for (const y of look.years) {
    out.push(
      `<text x="${y.x.toFixed(1)}" y="${(chart.H + look.yearSize * 1.3).toFixed(1)}" font-size="${look.yearSize}" fill="${look.ink}">${y.year}</text>`,
    );
  }
  out.push("<defs>");
  chart.lines.forEach((l, i) => {
    const pts = [];
    for (let k = 0; k < l.xs.length; k++)
      pts.push(`${l.xs[k].toFixed(1)},${l.ys[k].toFixed(1)}`);
    out.push(`<path id="l${i}" d="M${pts.join("L")}"/>`);
  });
  out.push("</defs>");

  bands.forEach((b, i) => {
    out.push(
      `<linearGradient id="g${i}" gradientUnits="userSpaceOnUse" x1="${b.a.x.toFixed(1)}" y1="${b.a.y.toFixed(1)}" x2="${b.b.x.toFixed(1)}" y2="${b.b.y.toFixed(1)}"><stop offset="0" stop-color="${b.color}"/><stop offset="${(b.fadeAt ?? look.gradientEnd).toFixed(3)}" stop-color="${look.bandEnd ?? b.end}"/></linearGradient>`,
    );
    const d =
      "M" + b.pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join("L") + "Z";
    out.push(
      `<path d="${d}" fill="url(#g${i})"${b.alpha < 1 ? ` opacity="${b.alpha}"` : ""}/>`,
    );
  });
  const blend = look.blend ? ` style="mix-blend-mode: ${look.blend}"` : "";
  for (const x of chart.texts) {
    const report = x.item.report,
      lit = !!report?.highlightId;
    const opacity = anyLit && report && !lit ? ` opacity="${fade}"` : "";
    // dy adds up along a textPath, so each run undoes the one before
    let dyNow = 0,
      before = 0;
    const spans = x.line.runs
      .map((r) => {
        const w = r.text.length * (r.fs ?? x.line.fs) * charRatio;
        const dx = r.under ? -before : 0,
          dy = (r.dy ?? 0) - dyNow;
        dyNow = r.dy ?? 0;
        before = w;
        return `<tspan fill="${look.ink}"${r.fs ? ` font-size="${r.fs.toFixed(2)}"` : ""}${dx ? ` dx="${dx.toFixed(2)}"` : ""}${dy ? ` dy="${dy.toFixed(2)}"` : ""}${r.style === "label" ? ' font-weight="700"' : ""}>${esc(r.text)}</tspan>`;
      })
      .join("");
    out.push(
      `<text font-size="${x.line.fs.toFixed(2)}"${opacity}${blend}><textPath xlink:href="#l${x.lineIndex}" href="#l${x.lineIndex}" startOffset="${x.offset.toFixed(2)}">${spans}</textPath></text>`,
    );
  }
  out.push("</svg>");
  download(new Blob([out.join("\n")], { type: "image/svg+xml" }), file);
}
