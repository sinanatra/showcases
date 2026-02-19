import { shortenAroundKeyword } from "$lib/utils/textUtils";
import { growthParams } from "$lib/components/dataViz/growth";
import {
  createRegionProjector,
  drawRegionOutlines,
  drawRegionStreets,
} from "$lib/components/map/outlines";

function parseDateLoose(v) {
  if (!v) return null;
  const raw = String(v).trim().replace(/,/g, "");
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    const [, y, m, d] = iso;
    return new Date(Number(y), Number(m) - 1, Number(d));
  }
  const de = raw.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2}|\d{4})$/);
  if (de) {
    let [, day, month, year] = de;
    let y = Number(year);
    if (year.length === 2) y += y >= 70 ? 1900 : 2000;
    return new Date(y, Number(month) - 1, Number(day));
  }
  const tmp = new Date(raw);
  return isNaN(+tmp) ? null : tmp;
}

function parseList(str) {
  if (!str) return [];
  if (Array.isArray(str)) return str;
  try {
    const arr = JSON.parse(String(str).replace(/'/g, '"'));
    return Array.isArray(arr) ? arr : [];
  } catch {
    return String(str)
      .replace(/[\[\]'"]/g, "")
      .split(/[,;]\s*/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
}

function detectRegion(row) {
  const s = String(row?.SourceFile || "").toLowerCase();
  const u = String(row?.URL || "").toLowerCase();
  if (s.includes("berlin") || u.includes("berlin.de")) return "Berlin";
  if (s.includes("brandenburg") || u.includes("brandenburg.de"))
    return "Brandenburg";
  return "";
}

export function normalizeGeocodedRow(r) {
  const lat = Number(r.latitude);
  const lon = Number(r.longitude);
  const d = parseDateLoose(r.ExtractedDate || r.Date);
  const actions = parseList(r.ExtractedAction);
  const action0 = String(actions?.[0] || "").trim();
  const kws = parseList(r.KeywordMatch);
  const kw0 = String(kws?.[0] || "").trim();
  const text = String(r.Text || "");
  const title = String(r.Title || "");
  const sentence = shortenAroundKeyword(`${title} ${text}`.trim(), kw0, 120);
  const region = detectRegion(r);

  return {
    lat,
    lon,
    date: d ? +d : null,
    kw: kw0,
    action: action0,
    sentence,
    title,
    url: String(r.URL || ""),
    region,
  };
}

export function createTextSketch({ getIncidents, getSettings, setStatus }) {
  return (p) => {
    const scale = 0.62;
    const glyphScale = 0.35;
    const baseSegmentLength = 6.2;
    const baseLtrSpacing = 7.3;
    const widthBucket = 100;
    const baseRepulsionRadius = 14;
    const normalSpawnBurst = 12;
    const catchupSpawnBurst = 96;
    const seekWarmStartBurst = 72;

    const charCache = new Map();
    const maxCache = 1400;
    const keywordColors = {};

    function colorForKey(key, index, total) {
      if (!key) return p.color(0, 0, 74);
      const i = Number.isFinite(index) ? index : 0;
      const n = Math.max(1, Number.isFinite(total) ? total : 1);
      const bri = 52 + (i * 120) / Math.max(n - 1, 1);
      return p.color(0, 0, bri);
    }

    let particles = [];
    let globalBuckets = new Map();
    let simFrame = 0;

    let incidents = [];
    let lastIncidentsRef = null;
    let nextIncidentIndex = 0;
    let minT = null;
    let maxT = null;
    let playhead = null;
    let lastMillis = null;
    let lastResetVersion = null;
    let lastSeekVersion = null;
    let lastProjectionKey = null;
    let needsBasemapRedraw = true;
    let projectPoint = null;
    let basemapLayer = null;
    let textLayer = null;

    const params = () => {
      const settings = getSettings?.() || {};
      const mode = String(settings.growthMode || "fungal");
      return growthParams[mode] || growthParams.fungal;
    };

    function lineScale() {
      const settings = getSettings?.() || {};
      const s = Number(settings.lineScale ?? 1);
      return Number.isFinite(s) ? Math.max(0.15, Math.min(3.2, s)) : 1;
    }

    function segmentLength() {
      return 10; // Math.max(0.1, Math.min(12, baseSegmentLength * lineScale()));
    }

    function ltrSpacing() {
      return 9; // baseLtrSpacing * (segmentLength() / baseSegmentLength);
    }

    function anchorTextOffset() {
      return Math.max(ltrSpacing() * 0.9, repulsionRadius() * 0.7);
    }

    function lengthFactor() {
      return 1;
    }

    function repulsionRadius() {
      return baseRepulsionRadius * (segmentLength() / baseSegmentLength);
    }

    function clampPlayhead(ms) {
      if (!Number.isFinite(ms)) return minT;
      if (!Number.isFinite(minT) || !Number.isFinite(maxT)) return ms;
      return Math.max(minT, Math.min(maxT, ms));
    }

    function desiredStartMs() {
      const settings = getSettings?.() || {};
      const s = Number(settings.startAtMs);
      return clampPlayhead(Number.isFinite(s) ? s : minT);
    }

    function lowerBoundByDate(targetMs) {
      const t = Number(targetMs);
      if (!Number.isFinite(t) || !incidents.length) return 0;
      let lo = 0;
      let hi = incidents.length;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (incidents[mid].date < t) lo = mid + 1;
        else hi = mid;
      }
      return lo;
    }

    function ratioToMs(ratio) {
      if (!Number.isFinite(minT) || !Number.isFinite(maxT)) return null;
      const r = Math.max(0, Math.min(1, Number(ratio) || 0));
      return minT + (maxT - minT) * r;
    }

    function regionFilter() {
      const rf = String(getSettings?.()?.regionFilter || "all");
      if (rf === "Berlin" || rf === "Brandenburg") return rf;
      return "all";
    }

    function districtFilter() {
      if (regionFilter() !== "Berlin") return "";
      const df = String(getSettings?.()?.districtFilter || "");
      return df || "";
    }

    function sidePadding() {
      const s = Number(getSettings?.()?.sidePadding);
      if (!Number.isFinite(s)) return 0;
      return Math.max(0, Math.min(360, s));
    }

    function projectionPadding() {
      const rf = regionFilter();
      const df = districtFilter();
      if (df) return { x: sidePadding(), y: 10 };
      if (rf === "all") return { x: sidePadding(), y: 36 };
      return { x: sidePadding(), y: 8 };
    }

    function refreshProjection(force = false) {
      const rf = regionFilter();
      const df = districtFilter();
      const pad = projectionPadding();
      const projectionKey = `${rf}:${df}:${pad.x}:${pad.y}`;
      const changed = projectionKey !== lastProjectionKey;
      if (!force && !changed && projectPoint) return;
      projectPoint = createRegionProjector({
        regionFilter: rf,
        districtFilter: df,
        width: p.width,
        height: p.height,
        paddingX: pad.x,
        paddingY: pad.y,
      });
      lastProjectionKey = projectionKey;
      needsBasemapRedraw = true;
      if (!force && changed) resetSimulation();
    }

    function getCachedLetter(colorKey, letter, textSize) {
      const key = `${colorKey}_${letter}_${Math.round(textSize)}`;
      if (charCache.has(key)) {
        const val = charCache.get(key);
        charCache.delete(key);
        charCache.set(key, val);
        return val;
      }

      const ts = Math.max(
        1,
        Math.min(34, Math.round(textSize * glyphScale * 1.9)),
      );
      const side = Math.max(2, Math.ceil((ts + 6) * 0.5));
      const pg = p.createGraphics(side, side);
      if (typeof pg.pixelDensity === "function") {
        pg.pixelDensity(Math.min(2, window.devicePixelRatio || 1));
      }
      if (typeof pg.smooth === "function") pg.smooth();
      pg.colorMode(p.HSB);
      pg.textFont("courier");
      pg.textAlign(p.CENTER, p.CENTER);
      pg.textSize(ts);
      const w = Math.max(pg.textWidth(letter), 4);
      pg.noStroke();
      pg.fill(keywordColors[colorKey] || p.color(0, 0, 74));
      pg.rectMode(p.CENTER);
      pg.rect(pg.width / 2, pg.height / 2, w + 6, ts + 6);
      pg.fill(0, 0, 4);
      pg.text(letter, pg.width / 2, pg.height / 2);

      charCache.set(key, pg);
      if (charCache.size > maxCache) {
        const oldestKey = charCache.keys().next().value;
        const old = charCache.get(oldestKey);
        old?.remove?.();
        charCache.delete(oldestKey);
      }
      return pg;
    }

    function createLayers(width, height) {
      basemapLayer?.remove?.();
      textLayer?.remove?.();

      basemapLayer = p.createGraphics(width, height);
      textLayer = p.createGraphics(width, height);

      const density = Math.min(2, window.devicePixelRatio || 1);
      if (typeof basemapLayer.pixelDensity === "function") {
        basemapLayer.pixelDensity(density);
      }
      if (typeof textLayer.pixelDensity === "function") {
        textLayer.pixelDensity(density);
      }
      if (typeof basemapLayer.colorMode === "function") {
        basemapLayer.colorMode(p.HSB);
      }
      if (typeof textLayer.colorMode === "function") {
        textLayer.colorMode(p.HSB);
      }

      basemapLayer.clear();
      textLayer.clear();
      needsBasemapRedraw = true;
    }

    function redrawBasemapLayer() {
      if (!basemapLayer || !projectPoint) return;
      basemapLayer.clear();
      drawRegionStreets(basemapLayer, {
        project: projectPoint,
        regionFilter: regionFilter(),
        districtFilter: districtFilter(),
      });
    drawRegionOutlines(basemapLayer, {
      project: projectPoint,
      regionFilter: regionFilter(),
      districtFilter: districtFilter(),
    });
      needsBasemapRedraw = false;
    }

    function fadeTextLayer(alpha = 0.1) {
      if (!textLayer?.drawingContext) return;
      const a = Math.max(0, Math.min(1, Number(alpha) || 0));
      if (a <= 0) return;
      const ctx = textLayer.drawingContext;
      ctx.save();
      ctx.globalCompositeOperation = "destination-out";
      ctx.fillStyle = `rgba(0, 0, 0, ${a})`;
      ctx.fillRect(0, 0, textLayer.width, textLayer.height);
      ctx.restore();
    }

    function drawGlyph(colorKey, letter, x, y, angle) {
      const textSize = repulsionRadius() / 1.2;
      const cached = getCachedLetter(colorKey, letter, textSize);
      if (!cached) return;
      const g = textLayer || p;
      g.push();
      g.translate(x, y);
      g.rotate(angle);
      g.imageMode(p.CENTER);
      g.image(cached, 0, 0);
      g.pop();
    }

    function growDir(br, tip) {
      const { growthMode = "fungal" } = getSettings?.() || {};
      const gp = params();

      let dir = br.dir0.copy();
      if (br.__rand == null) br.__rand = Math.random();
      const localChaos = (br.__rand - 0.5) * 2;
      dir.y += (gp.downwardBias || 0) + localChaos * 0.08;
      dir.normalize();
      const nv = p.noise(
        tip.x * 0.01 * scale,
        tip.y * 0.01 * scale,
        simFrame * 0.03,
      );
      const rotAmt = p.map(
        nv,
        0,
        1,
        -gp.directionRandomness,
        gp.directionRandomness,
      );
      dir.rotate(rotAmt * (0.5 + Math.abs(localChaos)));

      if (growthMode === "staccato") {
        if (Math.random() < 0.25) {
          dir.rotate((Math.random() - 0.5) * gp.directionRandomness * 3);
        }
        dir.add(
          p.createVector(
            (Math.random() - 0.5) * 0.6 * gp.directionRandomness,
            (Math.random() - 0.5) * 0.6 * gp.directionRandomness,
          ),
        );
      }
      if (growthMode === "psychedelic") {
        const phase = (br.phase || 0) + simFrame * (0.08 + br.__rand * 0.3);
        const swirl = p
          .createVector(Math.cos(phase), Math.sin(phase))
          .mult(0.9 + br.__rand);
        dir.add(swirl).normalize();
      }
      if (growthMode === "vortex") {
        const toCenter = p.createVector(
          tip.x - br.anchor.x,
          tip.y - br.anchor.y,
        );
        if (toCenter.mag() > 0.001) {
          const tang = p.createVector(-toCenter.y, toCenter.x).normalize();
          dir.add(tang.mult(1.2 + br.__rand * 2));
          dir.add(toCenter.normalize().mult(-0.6 * (1 + br.__rand)));
        }
      }
      if (growthMode === "river") {
        const s = 0.0025;
        const t = simFrame * 0.015;
        const a = p.noise(tip.x * s, tip.y * s, t) * Math.PI * 2;
        const flow = p.createVector(Math.cos(a), Math.sin(a));
        dir.add(flow.mult(0.6 + Math.random() * 1.4)).normalize();
      }
      if (growthMode === "tendrils") {
        const osc = 0.25 * Math.sin((br.phase || 0) + simFrame * 0.08);
        dir.rotate(osc * (1 + Math.random() * 1.5));
      }
      if (growthMode === "plasma") {
        if (Math.random() < 0.08) {
          dir.add(
            p.createVector(
              (Math.random() - 0.5) * 3,
              (Math.random() - 0.5) * 3,
            ),
          );
        }
      }
      if (growthMode === "calm") {
        const side = br.__rand < 0.5 ? -1 : 1;
        const target = p.createVector(side, 0.03).normalize();
        dir.mult(0.88).add(target.mult(0.12)).normalize();
      }
      return dir.normalize();
    }

    function rebuildBuckets() {
      globalBuckets.clear();
      for (const w of particles) {
        const nodes = w?.nodes || [];
        for (let i = 0; i < nodes.length; i++) {
          const n = nodes[i];
          const bx = Math.floor(n.x / widthBucket);
          const by = Math.floor(n.y / widthBucket);
          const key = `${bx},${by}`;
          if (!globalBuckets.has(key)) globalBuckets.set(key, []);
          globalBuckets.get(key).push(n);
        }
      }
    }

    function spawnParticle(inc) {
      if (!projectPoint) return null;
      const anchorPx = projectPoint(inc.lon, inc.lat);
      if (!Number.isFinite(anchorPx?.x) || !Number.isFinite(anchorPx?.y))
        return null;

      const anchor = p.createVector(anchorPx.x, anchorPx.y);
      const kw = inc.kw || "";
      const action = inc.action || "";
      const sentence = inc.sentence || "";
      if (!sentence.length) return null;

      const angle = p.random(0, Math.PI * 2);
      const dir0 = p.createVector(Math.cos(angle), Math.sin(angle)).normalize();

      const nodes = [anchor.copy()];
      const pathLength = 0;
      const distArr = [0];
      const leadInSteps = Math.ceil(
        anchorTextOffset() / Math.max(segmentLength(), 1),
      );

      return {
        id: `${inc.lon},${inc.lat},${inc.date}`,
        lon: inc.lon,
        lat: inc.lat,
        date: inc.date,
        kw,
        action,
        sentence,
        title: inc.title,
        url: inc.url,
        anchor,
        nodes,
        dir0,
        phase: Math.random() * Math.PI * 2,
        grown: 0,
        pathLength,
        distArr,
        segmentCursor: 1,
        lastPlacedCharIndex: -1,
        isAnchor: true,
        maxSteps: Math.max(
          6,
          leadInSteps +
            Math.ceil(
            (sentence.length || 1) *
              (ltrSpacing() / Math.max(segmentLength(), 1)) *
              lengthFactor(),
          ),
        ),
        finished: false,
      };
    }

    function clearSimulation() {
      particles = [];
      globalBuckets.clear();
      textLayer?.clear?.();
    }

    function setIncidents(list) {
      incidents = (Array.isArray(list) ? list : [])
        .filter(
          (x) =>
            x &&
            Number.isFinite(x.lat) &&
            Number.isFinite(x.lon) &&
            Number.isFinite(x.date),
        )
        .sort((a, b) => a.date - b.date);
      refreshProjection(true);

      nextIncidentIndex = 0;
      minT = incidents.length ? incidents[0].date : null;
      maxT = incidents.length ? incidents.at(-1).date : null;
      playhead = desiredStartMs();
      nextIncidentIndex = lowerBoundByDate(playhead);
      lastMillis = null;

      const allColorKeys = Array.from(
        new Set(incidents.map((a) => a.action || a.kw).filter(Boolean)),
      ).sort((a, b) => a.localeCompare(b));
      charCache.clear();
      allColorKeys.forEach((key, i) => {
        keywordColors[key] = colorForKey(key, i, allColorKeys.length);
      });

      clearSimulation();
    }

    function resetSimulation(hydrate = false) {
      playhead = desiredStartMs();
      nextIncidentIndex = 0;
      lastMillis = null;
      simFrame = 0;
      clearSimulation();
      seekToMs(playhead, { hydrate });
    }

    function placeLetters(w) {
      const margin = anchorTextOffset();
      const usableLength = Math.max(0, w.pathLength - margin);
      let ci = w.lastPlacedCharIndex + 1;
      const spacing = ltrSpacing();
      let si = Math.max(1, Number(w.segmentCursor) || 1);
      while (ci < w.sentence.length && ci * spacing < usableLength) {
        const target = margin + ci * spacing;
        while (si < w.distArr.length && w.distArr[si] < target) si++;
        if (si <= 0 || si >= w.distArr.length) {
          w.segmentCursor = si;
          break;
        }
        const d0 = w.distArr[si - 1];
        const v0 = w.nodes[si - 1];
        const v1 = w.nodes[si];
        if (!v0 || !v1) break;

        const seg = v1.dist(v0);
        const tnorm = seg > 0 ? (target - d0) / seg : 0;
        const px = p.lerp(v0.x, v1.x, tnorm);
        const py = p.lerp(v0.y, v1.y, tnorm);
        const ang = p.atan2(v1.y - v0.y, v1.x - v0.x);
        const letter = w.sentence[ci];
        const colorKey = w.action || w.kw || "";
        drawGlyph(colorKey, letter, px, py, ang);

        w.lastPlacedCharIndex = ci;
        w.segmentCursor = si;
        ci++;
      }
    }

    function growParticle(w, stepBoost = 1) {
      if (w.finished) return;
      const steps = Math.max(1, Math.round(stepBoost));

      for (let step = 0; step < steps; step++) {
        const tip = w.nodes[w.nodes.length - 1];
        let dir = growDir(w, tip);

        const bx = Math.floor(tip.x / widthBucket);
        const by = Math.floor(tip.y / widthBucket);
        const repulse = repulsionRadius();
        const repulseMul = 0.35 * scale;
        let repulseX = 0;
        let repulseY = 0;
        for (let dx = -1; dx <= 1; dx++) {
          for (let dy = -1; dy <= 1; dy++) {
            const arr = globalBuckets.get(`${bx + dx},${by + dy}`) || [];
            for (let j = 0; j < arr.length; j++) {
              const n2 = arr[j];
              if (!n2) continue;
              const dx2 = tip.x - n2.x;
              const dy2 = tip.y - n2.y;
              const d = Math.hypot(dx2, dy2);
              if (d > 0 && d < repulse) {
                const inv = repulseMul / d;
                repulseX += dx2 * inv;
                repulseY += dy2 * inv;
              }
            }
          }
        }
        if (repulseX !== 0 || repulseY !== 0) {
          dir.x += repulseX;
          dir.y += repulseY;
        }
        dir.normalize();

        const next = tip.copy().add(dir.copy().mult(segmentLength()));

        next.x = p.constrain(next.x, -60, p.width + 60);
        next.y = p.constrain(next.y, -60, p.height + 60);

        w.nodes.push(next);
        w.grown++;
        const segLen = tip.dist(next);
        w.pathLength += segLen;
        w.distArr.push(w.pathLength);

        placeLetters(w);
        if (w.grown >= w.maxSteps) {
          w.finished = true;
          break;
        }
      }
    }

    function spawnDue(maxBurst = 8) {
      if (!Number.isFinite(playhead) || playhead == null) return;
      const capped = maxBurst != null;
      const cap = capped ? Math.max(0, Math.floor(Number(maxBurst))) : 0;
      if (capped && cap <= 0) return;

      let spawned = 0;
      while (
        nextIncidentIndex < incidents.length &&
        incidents[nextIncidentIndex].date <= playhead
      ) {
        const inc = incidents[nextIncidentIndex];
        const w = spawnParticle(inc);
        if (!w) break;
        particles.push(w);
        nextIncidentIndex++;
        if (capped) {
          spawned++;
          if (spawned >= cap) break;
        }
      }
    }

    function dayStartMs(ms) {
      if (!Number.isFinite(ms)) return ms;
      const d = new Date(ms);
      d.setHours(0, 0, 0, 0);
      return +d;
    }

    function spawnDateOnly(targetMs) {
      const start = dayStartMs(targetMs);
      if (!Number.isFinite(start)) return;
      const end = start + 86400000;
      nextIncidentIndex = lowerBoundByDate(start);

      while (
        nextIncidentIndex < incidents.length &&
        incidents[nextIncidentIndex].date < end
      ) {
        const inc = incidents[nextIncidentIndex];
        const w = spawnParticle(inc);
        if (w) particles.push(w);
        nextIncidentIndex++;
      }
    }

    function spawnHistoricalAnchors(targetMs) {
      const start = dayStartMs(targetMs);
      if (!Number.isFinite(start)) return;
      nextIncidentIndex = 0;
      while (
        nextIncidentIndex < incidents.length &&
        incidents[nextIncidentIndex].date < start
      ) {
        const inc = incidents[nextIncidentIndex];
        const w = spawnParticle(inc);
        if (w) {
          w.finished = true;
          w.isHistorical = true;
          particles.push(w);
        }
        nextIncidentIndex++;
      }
    }

    function drawAnchors() {
      const textSize = repulsionRadius() / 1.2;

      const ts = Math.max(
        1,
        Math.min(34, Math.round(textSize * glyphScale * 1.9)),
      );
      const side = Math.max(2, Math.ceil((ts + 6) * 0.3));
      const g = textLayer || p;
      g.push();
      g.noStroke();
      g.rectMode(p.CENTER);
      for (let i = 0; i < particles.length; i++) {
        const w = particles[i];
        if (!w?.anchor || !w?.isAnchor) continue;
        if (!w.isHistorical && (w.lastPlacedCharIndex ?? -1) < 0) continue;
        g.fill("yellow");
        g.push();
        g.translate(w.anchor.x, w.anchor.y);
        g.square(0, 0, side * 0.5);
        g.pop();
      }
      g.pop();
    }

    function updatePlayhead() {
      const settings = getSettings?.() || {};
      const { daysPerSecond = 20 } = settings;
      const skipEmptyGaps = Boolean(settings.skipEmptyGaps);
      const gapSkipThresholdDays = Math.max(
        1,
        Number(settings.gapSkipThresholdDays) || 45,
      );
      const now = p.millis();
      if (lastMillis == null) lastMillis = now;
      const dt = Math.max(0, now - lastMillis);
      lastMillis = now;
      if (!Number.isFinite(minT) || !Number.isFinite(maxT)) return;
      const current = Number.isFinite(playhead) ? playhead : minT;
      const nextDate = incidents[nextIncidentIndex]?.date;

      if (skipEmptyGaps && Number.isFinite(nextDate) && nextDate > current) {
        const gapDays = (nextDate - current) / 86400000;
        if (gapDays > gapSkipThresholdDays) {
          playhead = Math.min(maxT, nextDate);
          return;
        }
      }

      const stepMs = (Number(daysPerSecond) || 20) * 86400000 * (dt / 1000);
      playhead = Math.min(maxT, current + stepMs);
    }

    function seekToMs(ms, { hydrate = false, mode = "progressive" } = {}) {
      const target = clampPlayhead(ms);
      if (!Number.isFinite(target)) return;

      if (mode === "exact-date") {
        clearSimulation();
        nextIncidentIndex = 0;
        playhead = target;
        spawnHistoricalAnchors(target);
        spawnDateOnly(target);

        if (hydrate && particles.length) {
          rebuildBuckets();
          const from = Math.max(0, particles.length - 80);
          for (let i = from; i < particles.length; i++) {
            const w = particles[i];
            if (!w.finished) growParticle(w, 2);
          }
          simFrame++;
        }
        return;
      }

      const was = playhead;
      const backwards = !Number.isFinite(was) || target < was;

      if (backwards) {
        clearSimulation();
        nextIncidentIndex = 0;
      }

      playhead = target;
      spawnDue(seekWarmStartBurst);

      if (hydrate && particles.length) {
        rebuildBuckets();
        const from = Math.max(0, particles.length - 80);
        for (let i = from; i < particles.length; i++) {
          const w = particles[i];
          if (!w.finished) growParticle(w, 2);
        }
        simFrame++;
      }
    }

    p.setup = () => {
      p.pixelDensity(Math.min(2, window.devicePixelRatio || 1));
      const c = p.createCanvas(window.innerWidth, window.innerHeight);
      // c.elt.style.background = "transparent";
      p.colorMode(p.HSB);
      p.frameRate(30);
      p.clear();
      createLayers(p.width, p.height);

      lastIncidentsRef = getIncidents?.() || [];
      setIncidents(lastIncidentsRef);
      seekToMs(playhead, { hydrate: false });
      const initialSettings = getSettings?.() || {};
      lastResetVersion = initialSettings.resetVersion ?? null;
      lastSeekVersion = initialSettings.timelineSeekVersion ?? null;
    };

    p.draw = () => {
      const didClear = p.frameCount % 10 === 0;
      if (didClear) fadeTextLayer(0.1);
      // fadeTextLayer(0.02);

      if (needsBasemapRedraw) redrawBasemapLayer();

      const latest = getIncidents?.() || [];
      if (latest !== lastIncidentsRef && Array.isArray(latest)) {
        lastIncidentsRef = latest;
        setIncidents(latest);
        seekToMs(playhead, { hydrate: false });
      }

      const settings = getSettings?.() || {};
      const resetVersion = settings.resetVersion ?? null;
      if (resetVersion != null && resetVersion !== lastResetVersion) {
        lastResetVersion = resetVersion;
        resetSimulation(false);
      }

      const seekVersion = settings.timelineSeekVersion ?? null;
      if (seekVersion != null && seekVersion !== lastSeekVersion) {
        lastSeekVersion = seekVersion;
        const seekRatio = Number(settings.timelineSeekRatio);
        const seekMode = String(settings.timelineSeekMode || "progressive");
        const targetMs = ratioToMs(seekRatio);
        const shouldHydrate = seekRatio > 0;
        seekToMs(targetMs, {
          hydrate: shouldHydrate,
          mode: seekMode,
        });
      }

      drawAnchors();

      let hasBacklog =
        nextIncidentIndex < incidents.length &&
        incidents[nextIncidentIndex].date <= playhead;
      if (!hasBacklog) updatePlayhead();
      hasBacklog =
        nextIncidentIndex < incidents.length &&
        incidents[nextIncidentIndex].date <= playhead;
      spawnDue(hasBacklog ? catchupSpawnBurst : normalSpawnBurst);

      if (simFrame % 4 === 0) rebuildBuckets();
      const growthSpeed = Math.max(0.2, Number(settings.growthSpeed) || 1);
      const stride = growthSpeed < 1 ? Math.max(1, Math.round(1 / growthSpeed)) : 1;
      const stepBoost = growthSpeed > 1 ? growthSpeed : 1;
      for (let i = 0; i < particles.length; i++) {
        if (simFrame % stride !== 0) continue;
        if (i % 2 === simFrame % 2) growParticle(particles[i], stepBoost);
      }
      simFrame++;

      if (typeof setStatus === "function" && simFrame % 8 === 0) {
        const ratio =
          Number.isFinite(minT) && Number.isFinite(maxT) && maxT > minT
            ? (playhead - minT) / (maxT - minT)
            : 0;
        setStatus({
          minT,
          maxT,
          playhead,
          active: particles.length,
          progressed: nextIncidentIndex,
          total: incidents.length,
          ratio: Math.max(0, Math.min(1, ratio)),
        });
      }

      p.clear();
      if (basemapLayer) p.image(basemapLayer, 0, 0, p.width, p.height);
      if (textLayer) p.image(textLayer, 0, 0, p.width, p.height);
    };

    p.windowResized = () => {
      p.resizeCanvas(window.innerWidth, window.innerHeight);
      createLayers(p.width, p.height);
      refreshProjection(true);
      resetSimulation(false);
    };

    p.remove = () => {
      for (const pg of charCache.values()) {
        pg?.remove?.();
      }
      charCache.clear();
      basemapLayer?.remove?.();
      textLayer?.remove?.();
    };
  };
}
