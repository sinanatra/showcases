/**
 * Stacks streams of text bottom to top, each as thick as its text needs.
 * @param {Array<{ id: string, items: Array<{ x: number, len: number, h: number, lines: any[], joint?: any }> }>} bands
 *   x = where an item would like to start, len = its length, h = its height in lines
 * @param {{ W: number, lineH: number, grid: number, sigma: number, room: number, slack: number, bandGap: number, slope: number, order: string[], fill: boolean, charRatio: number, textFs: number, wave?: (x: number, y: number) => number }} o
 *   sigma = how far the amount of text is smoothed along time,
 *   room = how much more room a stream has than its text needs (1.1 = 10 %),
 *   slack = how much earlier than its place an item may start,
 *   bandGap = room between two streams, in lines,
 *   slope = steepest an edge between two streams may be (height / width),
 *   order = stream ids bottom to top,
 *   fill = items with a `joint` grow into the gaps beside them
 */
export function layoutStreams(bands, o) {
  const W = o.W;
  const n = Math.ceil(W / o.grid) + 1;
  const cell = (x) => Math.min(n - 1, Math.max(0, Math.round(x / o.grid)));
  const s = Math.max(1, o.sigma / o.grid);

  const lens = bands
    .flatMap((b) => b.items.map((it) => it.len))
    .sort((p, q) => p - q);
  const iE = Math.min(
    Math.floor(n / 3),
    Math.ceil((lens[Math.floor(lens.length / 2)] ?? 0) / 2 / o.grid),
  );
  const hold = (a) =>
    Float64Array.from(a, (v, i) =>
      Math.max(v, i < iE ? a[iE] : i > n - 1 - iE ? a[n - 1 - iE] : 0),
    );

  const demand = (band) => {
    const amount = new Float64Array(n);
    const add = (it) => {
      const i0 = cell(it.x),
        i1 = Math.max(i0, cell(it.x + it.len) - 1);
      for (let i = i0; i <= i1; i++)
        amount[i] += (it.h / (i1 - i0 + 1)) * (it.len / o.grid);
    };
    band.items.forEach(add);
    return { amount, add };
  };
  const streams = bands.map((band) => ({ ...band, ...demand(band) }));

  const rank = (b) => (o.order.includes(b.id) ? o.order.indexOf(b.id) : Infinity);
  const ordered = streams.sort((a, b) => rank(a) - rank(b));
  const step = o.slope * o.grid;
  const edge = (ground, lines) =>
    limitSlope(
      hold(
        Float64Array.from(
          ground,
          (g, i) =>
            g + (lines[i] + o.bandGap * Math.min(1, lines[i])) * o.lineH,
        ),
      ),
      step,
    );
  let ground = new Float64Array(n);
  for (const b of ordered) {
    let result;
    for (let pass = 0; pass < 8; pass++) {
      const upper = edge(
        ground,
        gaussian(b.amount, s).map((v) => v * o.room),
      );

      const room = Float64Array.from(upper, (u, i) =>
        Math.max(0, (u - ground[i]) / o.lineH - o.bandGap),
      );
      result = pour(b.items, room, o);
      const late = result.placed.filter((p) => p.late);
      if (!late.length) break;
      for (const p of late) b.add(p.item);
    }

    const close = () => {
      const used = new Float64Array(n);
      for (const p of result.placed) {
        const lo = p.lo ?? p.start,
          hi = p.hi ?? p.start + p.item.len;
        for (let i = cell(lo); i <= cell(hi); i++)
          used[i] = Math.max(used[i], p.line + p.item.h);
      }
      return edge(ground, smoothCover(used, 1));
    };
    let upper = close();

    for (let again = 0; again < 2; again++) {
      const room = Float64Array.from(upper, (u, i) =>
        Math.max(0, (u - ground[i]) / o.lineH - o.bandGap),
      );
      const next = pour(b.items, room, o);
      if (next.placed.some((p) => p.late)) break;
      result = next;
      upper = close();
    }
    if (o.fill) {
      const lines = Float64Array.from(
        upper,
        (u, i) => (u - ground[i]) / o.lineH - o.bandGap,
      );
      extend(result.placed, lines, o);
      upper = close();
    }
    b.placed = result.placed;
    b.lower = ground;
    ground = upper;
  }
  const H = Math.max(...ground) + o.lineH;
  for (const b of ordered) b.base = Float64Array.from(b.lower, (g) => H - g);

  const at = (arr, x) => {
    const f = Math.min(n - 1, Math.max(0, x / o.grid));
    const i = Math.min(n - 2, Math.floor(f));
    return arr[i] + (arr[i + 1] - arr[i]) * (f - i);
  };

  const lineMap = new Map();
  const texts = [];
  for (const b of ordered) {
    for (const p of b.placed) {
      for (const line of p.item.lines) {
        const dy = -(p.line + p.item.h - line.lane) * o.lineH + line.baseline;
        const key = `${b.id}:${dy.toFixed(2)}`;
        let l = lineMap.get(key);
        const start = p.start - (line.shift ?? 0);
        if (!l) lineMap.set(key, (l = { b, dy, x0: start, x1: start }));
        l.x0 = Math.min(l.x0, start);
        l.x1 = Math.max(l.x1, start + line.len);
        texts.push({ l, start, line, item: p.item });
      }
    }
  }

  const wave = o.wave ?? (() => 0);
  const lift = (y) => Math.min(1, Math.max(0, (H - y) / (H * 0.6)));

  const lines = [...lineMap.values()].map((l, index) => {
    l.index = index;
    const count = Math.max(2, Math.ceil((l.x1 - l.x0) / o.grid) + 2);
    const xs = new Float64Array(count),
      ys = new Float64Array(count),
      arc = new Float64Array(count);
    for (let i = 0; i < count; i++) {
      const x = l.x0 + i * o.grid,
        y = at(l.b.base, x) + l.dy;
      xs[i] = x;
      ys[i] = y + wave(x, y) * lift(y);
      if (i) arc[i] = arc[i - 1] + Math.hypot(xs[i] - xs[i - 1], ys[i] - ys[i - 1]);
    }
    return { xs, ys, arc, x0: l.x0, step: o.grid };
  });
  for (const t of texts) {
    t.lineIndex = t.l.index;
    t.offset = arcAt(lines[t.lineIndex], t.start);
    delete t.l;
  }

  const textArea = texts.reduce((a, t) => a + t.line.len, 0) * o.lineH;
  const overflow = ordered.reduce(
    (a, b) => a + b.placed.filter((p) => p.late).length,
    0,
  );
  return { W, H, lines, texts, fill: textArea / (W * H), overflow };
}

function arcAt(line, x) {
  const f = Math.min(
    line.xs.length - 1,
    Math.max(0, (x - (line.x0 ?? line.xs[0])) / line.step),
  );
  const i = Math.min(line.xs.length - 2, Math.floor(f));
  return line.arc[i] + (line.arc[i + 1] - line.arc[i]) * (f - i);
}

/** Point and direction at a length `s` along a line. */
export function pointAt(line, s) {
  const { arc, xs, ys } = line;
  let lo = 0,
    hi = arc.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (arc[mid] <= s) lo = mid;
    else hi = mid;
  }
  const t = Math.min(1, Math.max(0, (s - arc[lo]) / (arc[hi] - arc[lo] || 1)));
  const dx = xs[hi] - xs[lo],
    dy = ys[hi] - ys[lo];
  return { x: xs[lo] + dx * t, y: ys[lo] + dy * t, angle: Math.atan2(dy, dx) };
}

/**
 * A slow wave that bends all lines up and down: Perlin noise along x, which
 * changes only slowly from one line to the next, so lines near each other move
 * almost together.
 */
export function makeWave({ amplitude, length, seed = 1 }) {
  if (!amplitude || !length) return () => 0;
  const noise = perlin(seed);
  const across = length * 3;
  return (x, y) =>
    amplitude *
    (noise(x / length, y / across) +
      0.35 * noise((x / length) * 2.3 + 7.1, (y / across) * 2.3));
}

function perlin(seed) {
  const perm = new Uint8Array(512);
  const base = Array.from({ length: 256 }, (_, i) => i);
  let r = seed * 9301 + 49297;
  for (let i = 255; i > 0; i--) {
    r = (r * 9301 + 49297) % 233280;
    const j = Math.floor((r / 233280) * (i + 1));
    [base[i], base[j]] = [base[j], base[i]];
  }
  for (let i = 0; i < 512; i++) perm[i] = base[i & 255];
  const grad = (h, x, y) => (h & 1 ? -x : x) + (h & 2 ? -y : y);
  const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  return (x, y) => {
    const X = Math.floor(x) & 255,
      Y = Math.floor(y) & 255;
    x -= Math.floor(x);
    y -= Math.floor(y);
    const u = fade(x),
      v = fade(y);
    const a = perm[X] + Y,
      b = perm[X + 1] + Y;
    const l1 =
      grad(perm[a], x, y) + u * (grad(perm[b], x - 1, y) - grad(perm[a], x, y));
    const l2 =
      grad(perm[a + 1], x, y - 1) +
      u * (grad(perm[b + 1], x - 1, y - 1) - grad(perm[a + 1], x, y - 1));
    return l1 + v * (l2 - l1);
  };
}

function pour(items, thick, o) {
  const n = thick.length;
  const lines = Math.max(1, Math.ceil(Math.max(...thick) + 0.5));

  const spans = [];
  for (let k = 0; k < lines; k++) {
    const list = [];
    let from = null;
    for (let i = 0; i <= n; i++) {
      const ok = i < n && thick[i] >= k + 0.5;
      if (ok && from == null) from = i;
      if (!ok && from != null) {
        list.push([from * o.grid, (i - 1) * o.grid]);
        from = null;
      }
    }
    spans.push(list);
  }
  const ends = [];
  const endOf = (j) => ends[j] ?? -Infinity;
  const placed = [...items]
    .sort((a, b) => a.x - b.x)
    .map((item) => {
      const want = Math.max(0, item.x - o.slack);
      let best = null;
      for (let k = 0; k + item.h <= lines; k++) {
        let from = want;
        for (let j = k; j < k + item.h; j++) from = Math.max(from, endOf(j));

        const ideal = Math.max(0, item.x);
        for (const [a, b] of spans[k + item.h - 1]) {
          const first = Math.max(from, a);

          if (first > ideal + o.slack) break;

          const start = Math.max(first, Math.min(ideal, b - item.len));
          if (start + item.len <= b) {
            const off = Math.abs(start - ideal);
            // the empty room it would leave behind the item before it on
            // these lines: of two places as near its date, the tighter one,
            // so no gap stays open behind a long item such as a name
            let last = 0;
            for (let j = k; j < k + item.h; j++)
              last = Math.max(last, endOf(j));
            const waste = start - last;
            if (
              !best ||
              off < best.off - 0.5 ||
              (off < best.off + 0.5 && waste < best.waste)
            )
              best = { line: k, start, off, waste };
            break;
          }
        }
      }
      let late = false;
      if (!best) {
        late = true;
        let k = lines;
        while (endOf(k) > want || (item.h > 1 && endOf(k + 1) > want)) k++;
        best = { line: k, start: want };
      }
      for (let j = best.line; j < best.line + item.h; j++)
        ends[j] = best.start + item.len + o.grid;
      return { item, line: best.line, start: best.start, late };
    });
  return { placed };
}

function extend(placed, room, o) {
  const n = room.length;
  const byLine = new Map();
  for (const p of placed) {
    for (const line of p.item.lines) {
      const k = p.line + p.item.h - 1 - line.lane;
      if (!byLine.has(k)) byLine.set(k, []);
      byLine.get(k).push({ p, line, k });
    }

    for (let lane = p.item.lines.length; lane < p.item.h; lane++) {
      const k = p.line + p.item.h - 1 - lane;
      if (!byLine.has(k)) byLine.set(k, []);
      byLine.get(k).push({
        p,
        line: { lane, len: p.item.len, fs: p.item.lines[0].fs },
        k,
      });
    }
  }
  const where = new Map();
  for (const list of byLine.values()) {
    list.sort((a, b) => a.p.start - b.p.start);
    list.forEach((e, i) => where.set(e.line, { e, list, i }));
  }
  const startOf = (e) => e.p.start - (e.line.shift ?? 0);
  const reach = (k, c, dir) => {
    while (c + dir >= 0 && c + dir < n && room[c + dir] >= k + 1) c += dir;
    return c * o.grid;
  };

  const free = (line) => {
    const { e, list, i } = where.get(line);
    const gap = 2 * line.fs * o.charRatio;
    const start = startOf(e),
      end = start + line.len;
    const prev =
      i > 0 ? startOf(list[i - 1]) + list[i - 1].line.len + gap : -Infinity;
    const next = i + 1 < list.length ? startOf(list[i + 1]) - gap : Infinity;
    return {
      before: Math.max(
        0,
        start -
          Math.max(
            prev,
            reach(e.k, Math.max(0, Math.floor(start / o.grid)), -1),
          ),
      ),
      after: Math.max(
        0,
        Math.min(
          next,
          reach(e.k, Math.min(n - 1, Math.ceil(end / o.grid)), 1),
        ) - end,
      ),
    };
  };
  for (const p of [...placed].sort((a, b) => a.start - b.start)) {
    const J = p.item.joint;
    if (!J) continue;
    const lines = p.item.lines;
    const room0 = new Map(lines.map((l) => [l, free(l)]));

    const early = Math.max(
      0,
      p.start -
        (Math.max(0, p.item.x) - o.slack) -
        Math.max(...lines.map((l) => l.shift ?? 0)),
    );
    const before = Math.min(early, ...lines.map((l) => room0.get(l).before));
    const cw = lines[0].fs * o.charRatio;

    const now = lines.map((l) => l.runs.at(-1).text.length);
    const widest = (caps) => {
      let lo = J.n,
        hi = J.max,
        best = null;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        const t = J.texts(mid);
        if (t.length === lines.length && t.every((x, i) => x.length <= caps[i])) {
          best = { n: mid, t };
          lo = mid + 1;
        } else hi = mid - 1;
      }
      return best;
    };
    let got = widest(
      lines.map((l, i) => now[i] + Math.floor((before + room0.get(l).after) / cw)),
    );
    if (!got) continue;
    let added = got.t.map((x, i) => x.length - now[i]);
    // shift left by at most half of what is added, so the word stays centred
    const left = Math.min(before, (Math.max(...added) * cw) / 2);
    if (added.some((a, i) => a * cw - left > room0.get(lines[i]).after + 0.5)) {
      got = widest(
        lines.map((l, i) => now[i] + Math.floor((left + room0.get(l).after) / cw)),
      );
      if (!got) continue;
      added = got.t.map((x, i) => x.length - now[i]);
    }
    if (!added.some((a) => a >= 4)) continue;
    J.n = got.n;
    lines.forEach((l, i) => {
      l.shift = (l.shift ?? 0) + left;
      l.runs = l.runs.map((r, j) =>
        j === l.runs.length - 1 ? { ...r, text: got.t[i] } : r,
      );
      l.len = runsWidth(l.runs, l.fs, o.charRatio);
    });
  }

  for (const p of placed) {
    // two characters of the text, also after a (bigger) category name
    const gap = 2 * (o.textFs ?? p.item.lines[0].fs) * o.charRatio;
    p.lo = Math.min(...p.item.lines.map((l) => p.start - (l.shift ?? 0)));
    p.hi =
      Math.max(...p.item.lines.map((l) => p.start - (l.shift ?? 0) + l.len)) +
      gap;
  }
}

/** Width of runs of text, each in its own size; a run set `under` another takes none. */
export function runsWidth(runs, fs, charRatio) {
  return runs.reduce(
    (a, r) => a + (r.under ? 0 : r.text.length * (r.fs ?? fs) * charRatio),
    0,
  );
}

function limitSlope(a, step) {
  const out = Float64Array.from(a);
  for (let i = 1; i < out.length; i++)
    out[i] = Math.max(out[i], out[i - 1] - step);
  for (let i = out.length - 2; i >= 0; i--)
    out[i] = Math.max(out[i], out[i + 1] - step);
  return out;
}

function gaussian(a, s) {
  const r = Math.max(1, Math.round(s * 0.9));
  const ones = new Float64Array(a.length).fill(1);
  let v = a,
    w = ones;
  for (let k = 0; k < 3; k++) {
    v = box(v, r);
    w = box(w, r);
  }
  return v.map((x, i) => x / w[i]);
}

function box(a, r) {
  const out = new Float64Array(a.length);
  let sum = 0;
  for (let i = 0; i <= Math.min(r, a.length - 1); i++) sum += a[i];
  for (let i = 0; i < a.length; i++) {
    out[i] = sum / (2 * r + 1);
    if (i + r + 1 < a.length) sum += a[i + r + 1];
    if (i - r >= 0) sum -= a[i - r];
  }
  return out;
}

function smoothCover(a, s) {
  const r = Math.max(1, Math.round(s));
  const max = a.map((_, i) => {
    let m = 0;
    for (
      let j = Math.max(0, i - 2 * r);
      j <= Math.min(a.length - 1, i + 2 * r);
      j++
    )
      m = Math.max(m, a[j]);
    return m;
  });
  return box(box(max, r), r);
}
