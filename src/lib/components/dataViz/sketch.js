import { parseList } from "$lib/utils/parseList";
import { applyGrowthDirection } from "$lib/components/dataViz/growth";

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
  isMobile,
  setTooltip,
  setHoveredHitbox,
  clearTooltip,
  getIsPinned,
  getHoveredHitbox,
  pinTooltip,
  snippetFor,
  registerControls,
}) {
  return (p) => {
    const data = vizData;
    const params = () => growthParams[growthMode] || growthParams.fungal;
    const scale = 0.75;
    const segmentLength = 10 * scale;
    const ltrSpacing = 10 * scale;
    const glyphCell = 16;
    const keywordColors = {};
    let branches = [];
    const clampPanValue = (val) =>
      typeof val === "number" && Number.isFinite(val) ? val : 0;
    // Narrow screens start further out, to show as much of the drawing as wide ones.
    const widthFit = noZoom ? 1 : Math.min(1, window.innerWidth / 720);
    let initialPan = {
      x: clampPanValue(startPan?.x) / widthFit,
      y: clampPanValue(startPan?.y) / widthFit,
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
    let worldCanvas;
    let worldCtx;
    let worldDensity = 1;
    let glyphs = new Map();
    let glyphSheet;
    let globalBuckets = new Map();
    let pendingNodes = [];
    let letterHitboxes = [];
    let firstDraw = true;
    let needsPaint = true;
    const repulsionRadius = 12 * scale;
    const glyphSize = Math.round(repulsionRadius / 1.2);
    const tileHeight = glyphSize + 4;
    const bucketSize = repulsionRadius;
    const bucketRebuildStride = 3;
    const branchUpdateStride = 2;
    const startMargin = Math.max(0, startGap) * scale;
    const zoomMin = 0.25;
    const zoomMax = 1.5;
    let initialZoomValue = 1;

    let defaultColor;

    function actionForItem(item) {
      const actions = parseList(item?.ExtractedAction);
      const action0 = String(actions?.[0] || "").trim();
      return action0;
    }

    initialZoomValue = noZoom
      ? 1
      : p.constrain((startZoom ?? 0.5) * widthFit, zoomMin, zoomMax);
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

    // All letters live on one sheet, whatever their colour: the tile behind a
    // letter is a plain rectangle, so a colour needs no canvas of its own.
    function buildGlyphs(sentences) {
      const letters = [...new Set(sentences.join("").split(""))];
      const cols = Math.ceil(Math.sqrt(letters.length));
      glyphSheet = document.createElement("canvas");
      glyphSheet.width = glyphSheet.height = Math.ceil(cols * glyphCell * worldDensity);
      const ctx = glyphSheet.getContext("2d");
      ctx.scale(worldDensity, worldDensity);
      ctx.font = `${glyphSize}px courier`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#000";
      glyphs = new Map();
      letters.forEach((letter, i) => {
        const x = (i % cols) * glyphCell;
        const y = Math.floor(i / cols) * glyphCell;
        ctx.fillText(letter, x + glyphCell / 2, y + glyphCell / 2);
        glyphs.set(letter, {
          sx: x * worldDensity,
          sy: y * worldDensity,
          tileWidth: Math.max(ctx.measureText(letter).width, 4) + 4,
        });
      });
    }

    function drawLetter(letter, colorKey, x, y, angle) {
      const glyph = glyphs.get(letter);
      const cos = Math.cos(angle) * worldDensity;
      const sin = Math.sin(angle) * worldDensity;
      const sourceSize = glyphCell * worldDensity;
      worldCtx.setTransform(cos, sin, -sin, cos, x * worldDensity, y * worldDensity);
      worldCtx.fillStyle = keywordColors[colorKey] || defaultColor;
      worldCtx.fillRect(
        -glyph.tileWidth / 2,
        -segmentLength - tileHeight / 2,
        glyph.tileWidth,
        tileHeight
      );
      worldCtx.drawImage(
        glyphSheet,
        glyph.sx,
        glyph.sy,
        sourceSize,
        sourceSize,
        -glyphCell / 2,
        -segmentLength - glyphCell / 2,
        glyphCell,
        glyphCell
      );
    }

    function bucketOf(x, y) {
      return Math.floor(x / bucketSize) * 100000 + Math.floor(y / bucketSize);
    }

    function addToBuckets(node) {
      const key = bucketOf(node.x, node.y);
      const bucket = globalBuckets.get(key);
      if (bucket) bucket.push(node);
      else globalBuckets.set(key, [node]);
    }

    function growBranch(br, tip) {
      return applyGrowthDirection(
        p,
        br.dir0.copy(),
        br,
        tip,
        params(),
        growthMode,
        simFrame,
        scale,
        br.center || { x: 0, y: 0 }
      );
    }

    function setupBranches(data, w, h) {
      const cx = w / 2;
      const cy = h / 2;
      const allColorKeys = Array.from(
        new Set(
          data
            .map((a) => actionForItem(a) || a?.KeywordMatch?.[0] || "")
            .filter(Boolean)
        )
      );
      allColorKeys.forEach((key, i) => {
        keywordColors[key] = p
          .color(0, 0, 55 + (i * 120) / Math.max(allColorKeys.length - 1, 1))
          .toString();
      });
      const result = [];
      if (!data.length) return result;
      const kw0 = data[0]?.KeywordMatch?.[0] || "";
      const action0 = actionForItem(data[0]);
      const snippet0 = snippetFor(data[0], kw0);
      const trunkText = snippet0.text;
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
        title: snippet0.title,
        terms: snippet0.terms,
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
        const snippet = snippetFor(data[i], kw);
        const txt = snippet.text;
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
          title: snippet.title,
          terms: snippet.terms,
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
      p.pixelDensity(Math.min(window.devicePixelRatio || 1, 2));
      p.createCanvas(window.innerWidth, window.innerHeight);
      p.colorMode(p.HSB);
      p.textAlign(p.CENTER, p.CENTER);
      p.textSize(9 * scale);
      p.frameRate(30);
      defaultColor = p.color(0, 0, 75).toString();
      if (!data || !data.length) {
        letterHitboxes = [];
        return;
      }
      const base = Math.max(window.innerWidth, window.innerHeight);
      // Room for the longest reports whatever the screen. Phones differ only in
      // the buffer's resolution: iOS leaves a canvas above 4096² blank.
      const size = Math.min(4200, Math.max(2100, Math.floor(base * 2.1)));
      const maxSide = isMobile ? 4096 : 8400;
      worldDensity = Math.min(window.devicePixelRatio || 1, maxSide / size);

      bufferCenter = { x: size / 2, y: size / 2 };
      bufferBounds = { left: 0, right: size, top: 0, bottom: size };
      worldCanvas = document.createElement("canvas");
      worldCanvas.width = worldCanvas.height = Math.floor(size * worldDensity);
      worldCtx = worldCanvas.getContext("2d");
      worldCtx.fillStyle = "#000";
      worldCtx.fillRect(0, 0, worldCanvas.width, worldCanvas.height);
      branches = setupBranches(data, size, size);
      buildGlyphs(branches.map((br) => br.sentence));
      branches.forEach((br) => br.nodes.forEach(addToBuckets));
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

      const growing = branches.some((br) => !br.finished);
      const moving =
        Math.abs(targetPan.x - pan.x) > 0.01 ||
        Math.abs(targetPan.y - pan.y) > 0.01 ||
        Math.abs(targetZoom - zoom) > 0.0005;
      if (!growing && !moving && !needsPaint) return;
      needsPaint = false;

      const panEase = 0.15;
      pan.x += (targetPan.x - pan.x) * panEase;
      pan.y += (targetPan.y - pan.y) * panEase;
      const zoomEase = 0.12;
      zoom += (targetZoom - zoom) * zoomEase;

      if (simFrame % bucketRebuildStride === 0) {
        pendingNodes.forEach(addToBuckets);
        pendingNodes = [];
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
        const tipBucket = bucketOf(tip.x, tip.y);
        for (let dx = -1; dx <= 1; dx++) {
          for (let dy = -1; dy <= 1; dy++) {
            const arr = globalBuckets.get(tipBucket + dx * 100000 + dy);
            if (!arr) continue;
            for (let j = 0; j < arr.length; j++) {
              const n2 = arr[j];
              const dx2 = tip.x - n2.x;
              const dy2 = tip.y - n2.y;
              const d = Math.hypot(dx2, dy2);
              if (d > 0 && d < repulsionRadius) {
                const push = (0.6 * scale) / d;
                dir.x += dx2 * push;
                dir.y += dy2 * push;
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
        pendingNodes.push(next);
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
            drawLetter(br.sentence[ci], br.action || br.kw || "", px, py, ang);
            if (ci % 3 === 0) {
              letterHitboxes.push({
                worldX: px,
                worldY: py,
                radius: (repulsionRadius / 1.2) * 2,
                url: br.url || "",
                text: br.sentence,
                keywords: br.terms?.length ? br.terms : [br.kw],
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
      p.drawingContext.drawImage(
        worldCanvas,
        -bufferCenter.x,
        -bufferCenter.y,
        bufferBounds.right,
        bufferBounds.bottom
      );
      p.pop();
      if (firstDraw && letterHitboxes.length > 0) {
        firstDraw = false;
        setTimeout(() => {
          if (typeof p.mouseMoved === "function") p.mouseMoved();
        }, 0);
      }
    };

    // Release the buffers now: phones run out of canvas memory before the garbage collector comes.
    p.registerMethod("remove", () => {
      if (worldCanvas) worldCanvas.width = 0;
      if (glyphSheet) glyphSheet.width = 0;
    });

    p.mousePressed = () => {
      dragging = true;
      lastX = p.mouseX;
      lastY = p.mouseY;
      p.mouseMoved(); // a tap has no hover before it
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
      needsPaint = true;
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
