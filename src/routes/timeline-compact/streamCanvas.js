import { pointAt } from "./streamLayout.js";

const FONT = '"Pitch Sans", Courier, monospace';
const BUCKET = 600;
const TILE = 512;
const MAX_TILES = 160;
const OVERVIEW_PX = 4096;
const BUDGET_MS = 14;

/** Every text line with its letters placed on its bent line. */
function place(chart, style) {
  const texts = [];
  const anyLit = chart.texts.some((t) => t.item.report?.highlightId);
  for (const t of chart.texts) {
    const line = chart.lines[t.lineIndex];
    const fs = t.line.fs;

    const cw = fs * style.charRatio + (t.line.track ?? 0);
    const report = t.item.report;
    const lit = !!report?.highlightId;
    const chars = [],
      xs = [],
      ys = [],
      angles = [],
      kinds = [],
      along = [],
      sizes = [];
    const colAt = [0];
    let col = 0;
    for (const run of t.line.runs) {
      const rfs = run.fs ?? fs;
      const w = rfs * style.charRatio + (t.line.track ?? 0);
      for (const ch of run.text) {
        if (ch !== " ") {
          const p = pointAt(line, t.offset + colAt[col] + w / 2);
          chars.push(ch);
          xs.push(p.x);
          ys.push(p.y);
          angles.push(p.angle);
          kinds.push(run.style);
          along.push(col);
          sizes.push(rfs);
        }
        colAt.push(colAt[col] + w);
        col++;
      }
    }
    if (!chars.length) continue;

    const bands = [];
    if (report) {
      const lineH = chart.lineH ?? fs * 1.1;

      const mid = (fs * (0.8 - 0.25)) / 2;
      const up = lineH / 2 + mid,
        down = lineH / 2 - mid;

      const all = t.line.runs
        .map((r) => (r.style === "meta" ? " ".repeat(r.text.length) : r.text))
        .join("");
      const parts = [];
      for (const m of all.matchAll(/\S+(?: {1,2}\S+)*/g)) {
        const last = parts[parts.length - 1];

        if (last && m.index - last[1] < 3) last[1] = m.index + m[0].length;
        else parts.push([m.index, m.index + m[0].length]);
      }
      for (let j = 0; j < parts.length; j++) {
        const [c0, c1] = parts[j];
        const from = t.offset + colAt[c0],
          own = t.offset + colAt[c1],
          to = own + cw * 0.3;
        const top = [],
          bottom = [];
        const steps = Math.max(2, Math.ceil((to - from) / 30));
        for (let i = 0; i <= steps; i++) {
          const p = pointAt(line, from + ((to - from) * i) / steps);
          const nx = -Math.sin(p.angle),
            ny = Math.cos(p.angle);
          top.push([p.x - nx * up, p.y - ny * up]);
          bottom.push([p.x + nx * down, p.y + ny * down]);
        }
        bands.push({
          pts: [...top, ...bottom.reverse()],
          a: pointAt(line, from),
          b: pointAt(line, to),
          color: report.color ?? "#dcdcdc",
          end: report.colorEnd ?? "#ffffff",
          fadeAt: report.fadeAt,
          alpha: anyLit && !lit ? style.fade : 1,
        });
      }
    }
    const box = [
      Math.min(...xs) - fs,
      Math.min(...ys) - fs * 1.2,
      Math.max(...xs) + fs,
      Math.max(...ys) + fs,
    ];
    texts.push({
      bands,
      chars,
      xs,
      ys,
      angles,
      kinds,
      along,
      sizes,
      fs,
      cw,
      box,
      weight: t.line.runs[0]?.style === "label" ? 700 : 400,
      alpha: anyLit && report && !lit ? style.fade : 1,
      report,
    });
  }
  const buckets = new Map();
  for (const t of texts) {
    for (
      let bx = Math.floor(t.box[0] / BUCKET);
      bx <= Math.floor(t.box[2] / BUCKET);
      bx++
    ) {
      for (
        let by = Math.floor(t.box[1] / BUCKET);
        by <= Math.floor(t.box[3] / BUCKET);
        by++
      ) {
        const key = `${bx},${by}`;
        if (!buckets.has(key)) buckets.set(key, []);
        buckets.get(key).push(t);
      }
    }
  }
  return { texts, buckets };
}

function gather(buckets, x0, y0, x1, y1) {
  const out = new Set();
  for (let bx = Math.floor(x0 / BUCKET); bx <= Math.floor(x1 / BUCKET); bx++) {
    for (
      let by = Math.floor(y0 / BUCKET);
      by <= Math.floor(y1 / BUCKET);
      by++
    ) {
      for (const t of buckets.get(`${bx},${by}`) ?? []) {
        if (
          t.box[0] <= x1 &&
          t.box[2] >= x0 &&
          t.box[1] <= y1 &&
          t.box[3] >= y0
        )
          out.add(t);
      }
    }
  }
  return [...out];
}

/** Draws [x0, x0 + w/k] × [y0, y0 + h/k] of the chart at k pixels per point. */
function paint(ctx, data, theme, chart, k, x0, y0, w, h) {
  const x1 = x0 + w / k,
    y1 = y0 + h / k;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.fillStyle = theme.background;
  ctx.fillRect(0, 0, w, h);
  ctx.setTransform(k, 0, 0, k, -x0 * k, -y0 * k);

  ctx.strokeStyle = theme.axis;
  ctx.lineWidth = Math.max(1 / k, 1.5);
  for (const y of theme.years) {
    ctx.beginPath();
    ctx.moveTo(y.x, chart.H + theme.yearSize * 0.15);
    ctx.lineTo(y.x, chart.H + theme.yearSize * 0.45);
    ctx.stroke();
  }
  ctx.fillStyle = theme.axis;
  ctx.font = `400 ${theme.yearSize}px ${FONT}`;
  ctx.textAlign = "center";
  for (const y of theme.years)
    ctx.fillText(String(y.year), y.x, chart.H + theme.yearSize * 1.3);
  ctx.textAlign = "start";

  const list = gather(data.buckets, x0, y0, x1, y1);

  for (const b of list.flatMap((t) => t.bands)) {
    const g = ctx.createLinearGradient(b.a.x, b.a.y, b.b.x, b.b.y);
    const end = theme.bandEnd ?? b.end;
    g.addColorStop(0, b.color);
    g.addColorStop(b.fadeAt ?? theme.gradientEnd, end);
    g.addColorStop(1, end);
    ctx.globalAlpha = b.alpha;
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(b.pts[0][0], b.pts[0][1]);
    for (let i = 1; i < b.pts.length; i++) ctx.lineTo(b.pts[i][0], b.pts[i][1]);
    ctx.closePath();
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = theme.blend ?? "source-over";

  if (list.length && list[0].fs * k < 5) {
    ctx.strokeStyle = theme.de;
    ctx.lineCap = "butt";
    for (const t of list) {
      ctx.globalAlpha = t.alpha * (t.weight > 400 ? 0.9 : 0.6);
      ctx.lineWidth = t.fs * (t.weight > 400 ? 0.6 : 0.35);
      ctx.beginPath();
      for (let i = 0; i < t.chars.length; i++) {
        const c = Math.cos(t.angles[i]),
          s = Math.sin(t.angles[i]);
        const bx = t.xs[i] + s * t.sizes[i] * 0.3,
          by = t.ys[i] - c * t.sizes[i] * 0.3,
          half = t.sizes[i] * 0.28;

        if (i === 0 || t.along[i] !== t.along[i - 1] + 1)
          ctx.moveTo(bx - c * half, by - s * half);
        ctx.lineTo(bx + c * half, by + s * half);
      }
      ctx.stroke();
    }
  } else {
    ctx.textAlign = "center";
    for (const t of list) {
      ctx.globalAlpha = t.alpha;
      let fill = "",
        size = 0;
      for (let i = 0; i < t.chars.length; i++) {
        if (t.sizes[i] !== size)
          ctx.font = `${t.weight} ${(size = t.sizes[i])}px ${FONT}`;
        const f = theme[t.kinds[i]] ?? theme.de;
        if (f !== fill) ctx.fillStyle = fill = f;
        const c = Math.cos(t.angles[i]) * k,
          s = Math.sin(t.angles[i]) * k;
        ctx.setTransform(c, s, -s, c, (t.xs[i] - x0) * k, (t.ys[i] - y0) * k);
        ctx.fillText(t.chars[i], 0, 0);
      }
    }
    ctx.textAlign = "start";
  }
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

/** @param {HTMLCanvasElement} canvas */
export function createRenderer(canvas) {
  let chart = null,
    theme = null,
    data = null,
    overview = null;
  let tiles = new Map(),
    base = 1,
    view = null,
    frame = 0;

  function drawTile(z, tx, ty) {
    const k = base * 2 ** z;
    const c = document.createElement("canvas");
    c.width = c.height = TILE;
    paint(
      c.getContext("2d"),
      data,
      theme,
      chart,
      k,
      (tx * TILE) / k,
      (ty * TILE) / k,
      TILE,
      TILE,
    );
    return c;
  }

  function frameNow() {
    frame = 0;
    if (!chart || !view) return;
    const dpr = window.devicePixelRatio || 1;
    const cw = canvas.clientWidth,
      ch = canvas.clientHeight;
    if (
      canvas.width !== Math.round(cw * dpr) ||
      canvas.height !== Math.round(ch * dpr)
    ) {
      canvas.width = Math.round(cw * dpr);
      canvas.height = Math.round(ch * dpr);
    }
    const ctx = canvas.getContext("2d");
    const k = view.k * dpr;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = theme.background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    const so = overview.scale;
    ctx.setTransform(k / so, 0, 0, k / so, view.x * dpr, view.y * dpr);
    ctx.drawImage(overview, 0, 0);
    if (k <= so * 1.5) return;

    const z = Math.max(0, Math.ceil(Math.log2(k / base)));
    const tk = base * 2 ** z;
    const x0 = -view.x / view.k,
      y0 = -view.y / view.k;
    const x1 = x0 + cw / view.k,
      y1 = y0 + ch / view.k;
    const s = k / tk;
    const started = performance.now();
    let missing = false;
    for (
      let tx = Math.floor((x0 * tk) / TILE);
      tx <= Math.floor((x1 * tk) / TILE);
      tx++
    ) {
      for (
        let ty = Math.floor((y0 * tk) / TILE);
        ty <= Math.floor((y1 * tk) / TILE);
        ty++
      ) {
        if (
          tx < 0 ||
          ty < 0 ||
          (tx * TILE) / tk > chart.W ||
          (ty * TILE) / tk > chart.fullH
        )
          continue;
        const key = `${z}:${tx}:${ty}`;
        let tile = tiles.get(key);
        if (!tile && performance.now() - started < BUDGET_MS) {
          tile = drawTile(z, tx, ty);
          tiles.set(key, tile);
          if (tiles.size > MAX_TILES) tiles.delete(tiles.keys().next().value);
        }
        if (!tile) {
          missing = true;
          continue;
        }

        tiles.delete(key);
        tiles.set(key, tile);
        ctx.setTransform(
          s,
          0,
          0,
          s,
          view.x * dpr + tx * TILE * s,
          view.y * dpr + ty * TILE * s,
        );
        ctx.drawImage(tile, 0, 0);
      }
    }

    if (missing) frame = requestAnimationFrame(frameNow);
  }

  return {
    /** A new chart: everything placed again. */
    set(newChart, style, newTheme) {
      chart = newChart;
      data = place(chart, style);
      this.look(newTheme);
    },
    /** A new look: only drawn again. */
    look(newTheme) {
      theme = newTheme;
      if (!chart) return;
      chart.fullH = chart.H + theme.yearSize * 1.5;
      tiles = new Map();
      const scale = Math.min(OVERVIEW_PX / chart.W, OVERVIEW_PX / chart.fullH);
      overview = document.createElement("canvas");
      overview.width = Math.ceil(chart.W * scale);
      overview.height = Math.ceil(chart.fullH * scale);
      overview.scale = scale;
      paint(
        overview.getContext("2d"),
        data,
        theme,
        chart,
        scale,
        0,
        0,
        overview.width,
        overview.height,
      );
      base = scale;
      this.draw(view);
    },
    draw(newView) {
      if (newView) view = newView;
      if (!frame) frame = requestAnimationFrame(frameNow);
    },
    /** The bands under the reports, for the SVG export. */
    bands: () => (data?.texts ?? []).flatMap((t) => t.bands),
    /** Every text line with its letters placed, for the PDF export. */
    texts: () => data?.texts ?? [],
    /** The report under a point of the chart, if any. */
    reportAt(x, y) {
      if (!data) return null;
      for (const t of gather(data.buckets, x, y, x, y)) {
        if (!t.report) continue;
        for (let i = 0; i < t.chars.length; i++) {
          const c = Math.cos(t.angles[i]),
            s = Math.sin(t.angles[i]);
          const u = (x - t.xs[i]) * c + (y - t.ys[i]) * s,
            v = -(x - t.xs[i]) * s + (y - t.ys[i]) * c;
          if (Math.abs(u) <= t.cw * 0.6 && v <= t.fs * 0.3 && v >= -t.fs * 0.9)
            return t.report;
        }
      }
      return null;
    },
  };
}
