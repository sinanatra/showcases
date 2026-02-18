import { shorten, shortenAroundKeyword } from "$lib/utils/textUtils";

export function createSketch({
  vizData,
  growthMode,
  growthParams,
  noZoom,
  startGap = 105,
  startZoom = 0.5,
  startPan = { x: 0, y: 0 },
  disableScrollZoom = false,
  activeHighlightTerms,
  recordStore,
  isMobile,
  setTooltip,
  setHoveredHitbox,
  clearTooltip,
  getIsPinned,
  getHoveredHitbox,
  pinTooltip,
  currentFocusFor,
  registerControls,
}) {
  return (p) => {
    const data = vizData;
    const params = () => growthParams[growthMode] || growthParams.fungal;
    const scale = 0.75;
    const segmentLength = 10 * scale;
    const widthBucket = 100 * scale;
    const ltrSpacing = 10 * scale;
    const charCache = new Map();
    const maxCache = 5000;
    const keywordColors = {};
    let branches = [];
    const clampPanValue = (val) =>
      typeof val === "number" && Number.isFinite(val) ? val : 0;
    let initialPan = {
      x: clampPanValue(startPan?.x),
      y: clampPanValue(startPan?.y),
    };
    let pan = { ...initialPan };
    let targetPan = { ...initialPan };
    let zoom = 1;
    let targetZoom = 1;
    let dragging = false;
    let lastX = 0;
    let lastY = 0;
    let simFrame = 0;
    let bufferCenter = { x: 0, y: 0 };
    let bufferBounds = { left: 0, right: 0, top: 0, bottom: 0 };
    let worldBuffer;
    let globalBuckets = new Map();
    let letterHitboxes = [];
    let firstDraw = true;
    const repulsionRadius = (isMobile ? 9 : 12) * scale;
    const bucketRebuildStride = 3;
    const branchUpdateStride = 2;
    const startMargin = Math.max(0, startGap) * scale;
    let isRecording = false;
    const unsub = recordStore.subscribe((v) => (isRecording = v));
    const zoomMin = 0.25;
    const zoomMax = 1.5;
    let initialZoomValue = 1;

    function parseList(value) {
      if (!value) return [];
      if (Array.isArray(value)) return value;
      const raw = String(value).trim();
      if (!raw) return [];
      try {
        const arr = JSON.parse(raw.replace(/'/g, '"'));
        return Array.isArray(arr) ? arr : [];
      } catch {
        return raw
          .replace(/[\[\]'"]/g, "")
          .split(/[,;]\s*/)
          .map((s) => s.trim())
          .filter(Boolean);
      }
    }

    function actionForItem(item) {
      const actions = parseList(item?.ExtractedAction);
      const action0 = String(actions?.[0] || "").trim();
      return action0;
    }

    initialZoomValue = noZoom
      ? 1
      : p.constrain(startZoom ?? 0.5, zoomMin, zoomMax);
    zoom = initialZoomValue;
    targetZoom = initialZoomValue;

    function resetView() {
      targetPan = { ...initialPan };
      pan = { ...targetPan };
      zoom = initialZoomValue;
      targetZoom = initialZoomValue;
    }

    function zoomBy(mult) {
      if (noZoom) return;
      const nextZoom = p.constrain(targetZoom * mult, zoomMin, zoomMax);
      if (Math.abs(nextZoom - targetZoom) > 0.001) {
        targetZoom = nextZoom;
      }
    }

    registerControls?.({
      zoomIn: () => zoomBy(1.12),
      zoomOut: () => zoomBy(1 / 1.12),
      resetView,
    });

    function getCachedLetter(colorKey, letter, textSize) {
      const key = `${colorKey}_${letter}_${Math.round(textSize)}`;
      if (charCache.has(key)) {
        const val = charCache.get(key);
        charCache.delete(key);
        charCache.set(key, val);
        return val;
      }
      const ts = Math.max(8, Math.min(28, Math.round(textSize)));
      const pg = p.createGraphics(40 * scale, 40 * scale);
      pg.colorMode(p.HSB);
      pg.textFont("courier");
      pg.textAlign(p.CENTER, p.CENTER);
      pg.textSize(ts);
      const w = Math.max(pg.textWidth(letter), 4);
      pg.noStroke();
      pg.fill(keywordColors[colorKey] || p.color(0, 0, 75));
      pg.rectMode(p.CENTER);
      pg.rect(pg.width / 2, pg.height / 2, w + 4, ts + 4);
      pg.fill(0, 0, 0);
      pg.text(letter, pg.width / 2, pg.height / 2);
      charCache.set(key, pg);
      if (charCache.size > maxCache) {
        const oldestKey = charCache.keys().next().value;
        charCache.delete(oldestKey);
      }
      return pg;
    }

    function growBranch(br, tip) {
      const gp = params();
      let dir = br.dir0.copy();
      if (br.__rand == null) br.__rand = Math.random();
      const localChaos = (br.__rand - 0.5) * 2;
      dir.y += (gp.downwardBias || 0) + localChaos * 0.08;
      dir.normalize();
      const nv = p.noise(
        tip.x * 0.01 * scale,
        tip.y * 0.01 * scale,
        simFrame * 0.03
      );
      const rotAmt = p.map(
        nv,
        0,
        1,
        -gp.directionRandomness,
        gp.directionRandomness
      );
      dir.rotate(rotAmt * (0.5 + Math.abs(localChaos)));
      if (growthMode === "staccato") {
        if (Math.random() < 0.25) {
          dir.rotate((Math.random() - 0.5) * gp.directionRandomness * 3);
        }
        dir.add(
          p.createVector(
            (Math.random() - 0.5) * 0.6 * gp.directionRandomness,
            (Math.random() - 0.5) * 0.6 * gp.directionRandomness
          )
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
          tip.x - (br.center?.x || 0),
          tip.y - (br.center?.y || 0)
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
            p.createVector((Math.random() - 0.5) * 3, (Math.random() - 0.5) * 3)
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

    function setupBranches(data, w, h) {
      const cx = w / 2;
      const cy = h / 2;
      charCache.clear();
      const allColorKeys = Array.from(
        new Set(
          data
            .map((a) => actionForItem(a) || a?.KeywordMatch?.[0] || "")
            .filter(Boolean)
        )
      );
      allColorKeys.forEach((key, i) => {
        keywordColors[key] = p.color(
          0,
          0,
          55 + (i * 120) / Math.max(allColorKeys.length - 1, 1)
        );
      });
      const result = [];
      if (!data.length) return result;
      const kw0 = data[0]?.KeywordMatch?.[0] || "";
      const action0 = actionForItem(data[0]);
      const text0 = data[0]?.Text ?? data[0]?.sentence ?? "";
      const focus0 = currentFocusFor(text0, kw0);
      const trunkText = shortenAroundKeyword(text0, focus0, 120);
      const trunkDir = p.createVector(0, -1);
      const trunkNodes = [p.createVector(cx, cy)];
      const trunkOffset = trunkDir
        .copy()
        .mult(startMargin * (0.85 + Math.random() * 0.1));
      trunkNodes.push(trunkNodes[0].copy().add(trunkOffset));
      const trunkPathLength = trunkNodes[0].dist(trunkNodes[1]);
      const trunkDistArr = [0, trunkPathLength];
      result.push({
        kw: kw0,
        action: action0,
        text: trunkText,
        nodes: trunkNodes,
        dir0: trunkDir.copy(),
        grown: 0,
        sentence: trunkText,
        pathLength: trunkPathLength,
        distArr: trunkDistArr,
        lastPlacedCharIndex: -1,
        maxSteps: Math.ceil(
          (trunkText.length || 1) * (ltrSpacing / Math.max(segmentLength, 1))
        ),
        finished: false,
        url: data[0]?.URL || "",
        date: data[0]?.ExtractedDate || data[0]?.Date || "",
        title: data[0]?.Title || "",
        renderOffset: startMargin,
      });
      for (let i = 1; i < data.length; i++) {
        const angle = p.random(-Math.PI * 0.85, -Math.PI * 0.05);
        const radius =
          (startMargin || segmentLength) * (0.95 + Math.random() * 0.6);
        const attachPoint = p.createVector(
          cx + Math.cos(angle) * radius,
          cy + Math.sin(angle) * radius
        );
        const dirSeed = p
          .createVector(Math.cos(angle), Math.sin(angle))
          .rotate((Math.random() - 0.5) * 0.3)
          .normalize();
        const kw = data[i]?.KeywordMatch?.[0] || "";
        const action = actionForItem(data[i]);
        const txtFull = data[i]?.Text ?? data[i]?.sentence ?? "";
        const focus = currentFocusFor(txtFull, kw);
        const txt = shortenAroundKeyword(txtFull, focus, 120);
        result.push({
          kw,
          action,
          text: txt,
          nodes: [attachPoint.copy()],
          dir0: dirSeed,
          grown: 0,
          sentence: txt,
          pathLength: 0,
          distArr: [0],
          lastPlacedCharIndex: -1,
          maxSteps: Math.ceil(
            (txt.length || 1) * (ltrSpacing / Math.max(segmentLength, 1))
          ),
          finished: false,
          url: data[i]?.URL || "",
          date: data[i]?.ExtractedDate || data[i]?.Date || "",
          title: data[i]?.Title || "",
          renderOffset: 0,
        });
      }
      return result;
    }

    function worldToScreen(wx, wy) {
      const sx = (wx - bufferCenter.x + pan.x) * zoom + p.width / 2;
      const sy = (wy - bufferCenter.y + pan.y) * zoom + p.height / 2;
      return { x: sx, y: sy };
    }

    function screenToWorld(sx, sy) {
      const wx = (sx - p.width / 2) / zoom + bufferCenter.x - pan.x;
      const wy = (sy - p.height / 2) / zoom + bufferCenter.y - pan.y;
      return { x: wx, y: wy };
    }

    p.setup = () => {
      p.createCanvas(window.innerWidth, window.innerHeight);
      p.colorMode(p.HSB);
      p.textAlign(p.CENTER, p.CENTER);
      p.textSize(9 * scale);
      p.frameRate(30);
      if (!data || !data.length) {
        worldBuffer = null;
        letterHitboxes = [];
        return;
      }
      const base = Math.max(window.innerWidth, window.innerHeight);
      const grewByData = Math.min(1.6, 1 + data.length / 40);
      const maxBuffer = isMobile ? 2048 : 4200;
      // const size = Math.min(maxBuffer, Math.floor(base * grewByData));

      const size = Math.min(maxBuffer, Math.floor(base * 2.1));

      bufferCenter = { x: size / 2, y: size / 2 };
      bufferBounds = { left: 0, right: size, top: 0, bottom: size };
      worldBuffer = p.createGraphics(size, size);
      worldBuffer.colorMode(p.HSB);
      worldBuffer.textAlign(p.CENTER, p.CENTER);
      worldBuffer.textFont("courier");
      worldBuffer.textSize(13 * scale);
      worldBuffer.background(0);
      branches = setupBranches(data, size, size);
      pan = { ...initialPan };
      targetPan = { ...initialPan };
      simFrame = 0;
      letterHitboxes = [];
      firstDraw = true;
    };

    p.draw = () => {
      if (!branches.length) {
        p.background(0);
        return;
      }

      const panEase = 0.15;
      pan.x += (targetPan.x - pan.x) * panEase;
      pan.y += (targetPan.y - pan.y) * panEase;
      const zoomEase = 0.12;
      zoom += (targetZoom - zoom) * zoomEase;

      if (simFrame % bucketRebuildStride === 0) {
        globalBuckets.clear();
        branches.forEach((br) => {
          for (let i = 0; i < br.nodes.length; i++) {
            const n = br.nodes[i];
            const bx = Math.floor(n.x / widthBucket);
            const by = Math.floor(n.y / widthBucket);
            const key = `${bx},${by}`;
            if (!globalBuckets.has(key)) {
              globalBuckets.set(key, []);
            }
            globalBuckets.get(key).push(n);
          }
        });
      }
      branches.forEach((br, i) => {
        if (
          br.finished ||
          i % branchUpdateStride !== simFrame % branchUpdateStride
        ) {
          return;
        }
        if (!br.nodes?.length) return;
        const tip = br.nodes[br.nodes.length - 1];
        if (!tip) return;
        let dir = growBranch(br, tip);
        const bx = Math.floor(tip.x / widthBucket);
        const by = Math.floor(tip.y / widthBucket);
        for (let dx = -1; dx <= 1; dx++) {
          for (let dy = -1; dy <= 1; dy++) {
            const arr = globalBuckets.get(`${bx + dx},${by + dy}`) || [];
            for (let j = 0; j < arr.length; j++) {
              const n2 = arr[j];
              const dx2 = tip.x - n2.x;
              const dy2 = tip.y - n2.y;
              const d = Math.hypot(dx2, dy2);
              if (d > 0 && d < repulsionRadius) {
                const inv = 1 / d;
                dir.add(p.createVector(dx2 * inv, dy2 * inv).mult(0.6 * scale));
              }
            }
          }
        }
        dir.normalize();
        const next = tip.copy().add(dir.copy().mult(segmentLength));
        next.x = p.constrain(
          next.x,
          bufferBounds.left + 10 * scale,
          bufferBounds.right - 10 * scale
        );
        next.y = p.constrain(
          next.y,
          bufferBounds.top + 10 * scale,
          bufferBounds.bottom - 10 * scale
        );
        br.nodes.push(next);
        br.grown++;
        const segLen = tip.dist(next);
        br.pathLength += segLen;
        br.distArr.push(br.pathLength);
        const margin = br.renderOffset || 0;
        const usableLength = Math.max(0, br.pathLength - margin);
        let ci = br.lastPlacedCharIndex + 1;
        while (
          ci < br.sentence.length &&
          (ci + 0.5) * ltrSpacing < usableLength
        ) {
          const target = margin + (ci + 0.5) * ltrSpacing;
          const si = br.distArr.findIndex((d) => d >= target);
          if (si > 0) {
            const d0 = br.distArr[si - 1];
            const v0 = br.nodes[si - 1];
            const v1 = br.nodes[si];
            if (!v0 || !v1) break;
            const tnorm = (target - d0) / v1.dist(v0);
            const px = p.lerp(v0.x, v1.x, tnorm);
            const py = p.lerp(v0.y, v1.y, tnorm);
            const ang = p.atan2(v1.y - v0.y, v1.x - v0.x);
            const letter = br.sentence[ci];
            const textSize = repulsionRadius / 1.2;
            const colorKey = br.action || br.kw || "";
            const cached = getCachedLetter(colorKey, letter, textSize);
            if (cached) {
              worldBuffer.push();
              worldBuffer.translate(px, py);
              worldBuffer.rotate(ang);
              worldBuffer.imageMode(p.CENTER);
              worldBuffer.image(cached, 0, -segmentLength);
              worldBuffer.pop();
            }
            if (ci % 3 === 0) {
              letterHitboxes.push({
                worldX: px,
                worldY: py,
                radius: textSize * 2,
                url: br.url || "",
                text: br.sentence,
                keywords: [br.kw],
                date: br.date,
                title: br.title,
              });
              if (letterHitboxes.length > 20000)
                letterHitboxes.splice(0, 20000);
            }
            br.lastPlacedCharIndex = ci;
            ci++;
          } else break;
        }
        if (br.grown >= br.maxSteps) br.finished = true;
      });
      simFrame++;
      p.background(0);
      p.push();
      p.translate(p.width / 2, p.height / 2);
      p.scale(zoom);
      p.translate(pan.x, pan.y);
      p.image(worldBuffer, -bufferCenter.x, -bufferCenter.y);
      p.pop();
      if (firstDraw && letterHitboxes.length > 0) {
        firstDraw = false;
        setTimeout(() => {
          if (typeof p.mouseMoved === "function") p.mouseMoved();
        }, 0);
      }
      if (isRecording && isMobile) {
        isRecording = false;
      }
    };

    p.remove = () => {
      unsub();
    };

    p.mousePressed = () => {
      dragging = true;
      lastX = p.mouseX;
      lastY = p.mouseY;
      if (getHoveredHitbox()?.url) {
        pinTooltip();
      }
    };

    p.mouseReleased = () => {
      dragging = false;
    };

    p.mouseDragged = () => {
      if (noZoom) return;
      if (!dragging) return;
      const dx = (p.mouseX - lastX) / zoom;
      const dy = (p.mouseY - lastY) / zoom;
      targetPan.x += dx;
      targetPan.y += dy;
      lastX = p.mouseX;
      lastY = p.mouseY;
    };

    p.mouseWheel = (e) => {
      if (noZoom || disableScrollZoom) return;
      const f = e.deltaY < 0 ? 1.08 : 1 / 1.08;
      zoomBy(f);
    };

    p.windowResized = () => {
      p.resizeCanvas(window.innerWidth, window.innerHeight);
    };

    p.mouseOut = () => {
      if (!getIsPinned()) {
        setHoveredHitbox(null);
        clearTooltip();
      }
    };

    p.mouseMoved = () => {
      if (getIsPinned()) return;
      const { x: wx, y: wy } = screenToWorld(p.mouseX, p.mouseY);
      let hovered = null;
      for (let hit of letterHitboxes) {
        if (p.dist(wx, wy, hit.worldX, hit.worldY) < hit.radius) {
          const { x, y } = worldToScreen(hit.worldX, hit.worldY);
          const highlightList = activeHighlightTerms.length
            ? activeHighlightTerms
            : hit.keywords || [];
          setTooltip(
            hit.text,
            hit.url,
            x,
            y - 22,
            highlightList,
            hit.date,
            hit.title
          );
          hovered = hit;
          break;
        }
      }
      if (!hovered) {
        clearTooltip();
      }
      setHoveredHitbox(hovered);
    };
  };
}
