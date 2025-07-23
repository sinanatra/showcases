<script>
  import P5 from "p5-svelte";
  import Record from "$lib/components/Record.svelte";

  import { record } from "$lib/stores.js";

  let isRecording = false;
  $: unsub = record.subscribe((v) => (isRecording = v));

  let savedFrames = 0;
  let framesToSave = 2000;

  let sketch = (p) => {
    const scale = 0.7;
    const segmentLength = 8 * scale;
    const repulsionRadius = 20 * scale;
    const repulsionStrength = 0.2 * scale;
    const widthBucket = 100 * scale;
    const noiseScale = 0.01 * scale;
    const noiseSpeed = 0.05;
    const growthInterval = 1;
    const ltrSpacing = 8 * scale;
    const timelineFrames = 1000;
    const keywordColors = {};
    const charCache = new Map();

    let multi = 2;
    let branches = [];
    let pan = { x: 0, y: 0 };
    let zoom = 1;
    let dragging = false;
    let lastX = 0,
      lastY = 0;
    let simFrame = 0;
    let randomUnit = 1;
    let worldBuffer, timelineLayer;
    const globalBuckets = new Map();
    let bufferCenter = { x: 0, y: 0 };
    let bufferBounds = { left: 0, right: 0, top: 0, bottom: 0 };
    let minDate,
      maxDate,
      span,
      yearLabels = [];

    function getCachedLetter(kw, letter, textSize) {
      const key = `${kw}_${letter}_${textSize}`;
      if (charCache.has(key)) return charCache.get(key);

      const pg = p.createGraphics(40 * scale, 40 * scale);
      pg.colorMode(p.HSB);
      pg.textFont("courier");
      pg.textAlign(p.CENTER, p.CENTER);
      pg.textSize(textSize);

      const w = Math.max(pg.textWidth(letter), 4);
      const bgPadX = 2 * scale;
      const bgPadY = 2 * scale;

      pg.noStroke();
      pg.fill(keywordColors[kw] || p.color(60, 8, 57));
      pg.rectMode(p.CENTER);
      pg.rect(pg.width / 2, pg.height / 2, w + bgPadX, textSize + bgPadY);

      pg.fill(0, 0, 0);
      pg.text(letter, pg.width / 2, pg.height / 2);

      charCache.set(key, pg);
      return pg;
    }

    p.preload = () => {
      p.dataTable = p.loadTable("parsed.csv", "csv", "header");
    };

    p.setup = () => {
      p.createCanvas(p.windowWidth, p.windowHeight);
      p.colorMode(p.HSB);
      p.textAlign(p.CENTER, p.CENTER);
      p.textSize(9 * scale);
      p.frameRate(30);

      const rows = p.dataTable
        .getRows()
        .map((r) => {
          const ds = r.get("ExtractedDate") || r.get("Date");
          const [d, m, y] = ds.split(".");
          const date = new Date(+y, m - 1, +d).getTime();
          const txt = r.get("Text");
          let kws;
          try {
            kws = JSON.parse(r.get("KeywordMatch").replace(/'/g, '"'));
          } catch {
            kws = r.get("KeywordMatch").split(/[,;]\s*/);
          }
          const sents = [];
          kws.forEach((kw) => {
            const m0 = txt.match(new RegExp(`([^\\.]*${kw}[^\\.]*)`, `i`));
            if (m0) sents.push({ kw, s: m0[1].trim() });
          });
          return { date, sents };
        })
        .sort((a, b) => a.date - b.date);

      if (!rows.length) return;

      minDate = rows[1]?.date || rows[0].date;
      maxDate = rows.at(-1).date;
      span = maxDate - minDate;

      const w = Math.max(p.width * multi, 1400);
      const h = Math.max(p.height * multi, 1800);

      console.log(w, h);

      const marginY = (h / 2.4) * scale;
      const rightDataMargin = 800 * scale;
      bufferCenter = { x: w / 2, y: h / 2 };
      bufferBounds = { left: 0, right: w, top: 0, bottom: h };

      worldBuffer = p.createGraphics(w, h);
      worldBuffer.colorMode(p.HSB);
      worldBuffer.textAlign(p.CENTER, p.CENTER);
      worldBuffer.textFont("courier");
      worldBuffer.textSize(13 * scale);
      worldBuffer.background(0);

      timelineLayer = p.createGraphics(w, h);
      timelineLayer.colorMode(p.HSB);
      timelineLayer.textAlign(p.CENTER, p.CENTER);
      timelineLayer.textFont("arial");

      const allYears = [
        ...new Set(rows.map((a) => new Date(a.date).getFullYear())),
      ].sort((a, b) => a - b);

      yearLabels = allYears.map((year) => {
        const yearRows = rows.filter(
          (r) => new Date(r.date).getFullYear() === year
        );
        const avgT =
          yearRows.reduce((sum, r) => sum + (r.date - minDate) / span, 0) /
          yearRows.length;
        return { year, avgT };
      });

      const timelineX0 = 1;
      const timelineX1 = w - rightDataMargin;

      const keywords = [
        ...new Set(rows.flatMap((r) => r.sents.map((s) => s.kw))),
      ];

      keywords.forEach((kw, i) => {
        let hue =
          Math.round((i * 290) / Math.max(keywords.length - 1, 1) + 60) % 360;
        let sat = 0;
        let bri =
          Math.round((i * 290) / Math.max(keywords.length - 1, 1) + 60) % 360;

        keywordColors[kw] = p.color(hue, sat, bri);
      });

      branches = [];
      const yTimeline = marginY + 30 * scale;

      randomUnit = p.random([0.1, 0.2, 0.3, 0.4, 0.5, 0.8, 0.9, 1]);

      rows.forEach((row) => {
        const t = (row.date - minDate) / span;
        const x0 = timelineX0 + t * (timelineX1 - timelineX0);
        const y0 = yTimeline;
        const startFrame = Math.floor(t * timelineFrames);

        row.sents.forEach(({ kw, s }) => {
          const maxSteps = Math.ceil(s.length * (ltrSpacing / segmentLength));
          const dir0 = p
            .createVector(p.random(-randomUnit, randomUnit), 1)
            .normalize();

          branches.push({
            kw,
            nodes: [p.createVector(x0, y0)],
            sentence: s,
            maxSteps,
            grown: 0,
            frameCount: 0,
            startFrame,
            dir0,
            pathLength: 0,
            distArr: [0],
            lastPlacedCharIndex: -1,
            finished: false,
          });
        });
      });

      zoom = (p.height / bufferBounds.bottom) * 1;
      zoom = 1;
      pan = { x: 0, y: 0 };

      sketch.timelineX0 = timelineX0;
      sketch.timelineX1 = timelineX1;
      sketch.yTimeline = yTimeline;
      sketch.rightDataMargin = rightDataMargin;
      sketch.w = w;
      sketch.h = h;
      sketch.marginY = marginY;
    };

    p.draw = () => {
      globalBuckets.clear();

      if (p.frameCount % 60 === 0) {
        worldBuffer.noStroke();
        worldBuffer.fill(0, 0, 0, 0.05);
        worldBuffer.rect(0, 0, worldBuffer.width, worldBuffer.height);
      }

      branches.forEach((br) =>
        br.nodes.forEach((n) => {
          const key = `${Math.floor(n.x / widthBucket)},${Math.floor(n.y / widthBucket)}`;
          if (!globalBuckets.has(key)) globalBuckets.set(key, []);
          globalBuckets.get(key).push(n);
        })
      );

      branches.forEach((br) => {
        if (br.finished || simFrame < br.startFrame) return;
        br.frameCount++;
        if (br.frameCount % growthInterval !== 0 || br.grown >= br.maxSteps)
          return;

        const tip = br.nodes[br.nodes.length - 1];
        let dir = br.dir0.copy();

        const [bx, by] = getBucketKey(tip).split(",").map(Number);
        for (let dx = -1; dx <= 1; dx++)
          for (let dy = -1; dy <= 1; dy++) {
            (globalBuckets.get(`${bx + dx},${by + dy}`) || []).forEach((n2) => {
              const d = tip.dist(n2);
              if (d > 0 && d < repulsionRadius) {
                dir.add(
                  p
                    .createVector(tip.x - n2.x, tip.y - n2.y)
                    .normalize()
                    .mult(repulsionStrength)
                );
              }
            });
          }
        dir.normalize();

        if (dir.y < 0.2) dir.y = 1;
        dir.normalize();

        const nv = p.noise(
          tip.x * noiseScale,
          tip.y * noiseScale,
          simFrame * noiseSpeed
        );

        dir.rotate(p.map(nv, 0, 1, -p.QUARTER_PI * 0.6, p.QUARTER_PI * 0.6));

        const next = p.Vector.add(tip, p.Vector.mult(dir, segmentLength));
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

        let ci = br.lastPlacedCharIndex + 1;
        while (
          ci < br.sentence.length &&
          (ci + 0.5) * ltrSpacing < br.pathLength
        ) {
          const target = (ci + 0.5) * ltrSpacing;
          const si = br.distArr.findIndex((d) => d >= target);
          if (si > 0) {
            const d0 = br.distArr[si - 1];
            const v0 = br.nodes[si - 1];
            const v1 = br.nodes[si];
            const tnorm = (target - d0) / v1.dist(v0);
            const px = p.lerp(v0.x, v1.x, tnorm);
            const py = p.lerp(v0.y, v1.y, tnorm);
            const ang = p.atan2(v1.y - v0.y, v1.x - v0.x);

            const letter = br.sentence[ci];
            const textSize = repulsionRadius / 2;
            const cached = getCachedLetter(br.kw, letter, textSize);

            worldBuffer.push();
            worldBuffer.translate(px, py);
            worldBuffer.rotate(ang);
            worldBuffer.imageMode(p.CENTER);
            worldBuffer.image(cached, 0, -segmentLength);
            worldBuffer.pop();

            br.lastPlacedCharIndex = ci;
            ci++;
          } else break;
        }

        if (br.grown >= br.maxSteps) br.finished = true;
      });

      simFrame++;

      const tCurrent = Math.min(simFrame / timelineFrames, 1);
      const timelineX0 = sketch.timelineX0;
      const timelineX1 = sketch.timelineX1;
      const bufferCenterX = bufferCenter.x;
      const currentX = timelineX0 + tCurrent * (timelineX1 - timelineX0);

      if (!dragging && zoom >= 0.3) {
        pan.x = -(currentX - bufferCenterX) * zoom;
        pan.y = zoom;
      }
      timelineLayer.clear();
      timelineLayer.stroke(0, 0, 255);
      timelineLayer.strokeWeight(2 * scale);
      timelineLayer.line(
        timelineX0,
        sketch.yTimeline,
        timelineX1,
        sketch.yTimeline
      );

      timelineLayer.line(timelineX0, sketch.h, timelineX1, sketch.h);

      yearLabels.forEach(({ year, avgT }) => {
        const x = timelineX0 + avgT * (timelineX1 - timelineX0);
        const labelY = sketch.yTimeline - 32 * scale;

        timelineLayer.noStroke();
        timelineLayer.fill(0, 0, 255);
        timelineLayer.textSize(18 * scale);
        timelineLayer.text(year, x, labelY);

        const tickStartY = labelY + 22 * scale;
        timelineLayer.push();
        timelineLayer.stroke(0, 0, 255);
        timelineLayer.strokeWeight(2 * scale);
        timelineLayer.drawingContext.setLineDash([18 * scale, 10 * scale]);
        timelineLayer.line(x, tickStartY, x, sketch.h);
        timelineLayer.drawingContext.setLineDash([]);
        timelineLayer.pop();
      });

      const xNow = timelineX0 + tCurrent * (timelineX1 - timelineX0);
      timelineLayer.stroke(0, 0, 255);
      timelineLayer.strokeWeight(3 * scale);
      timelineLayer.line(
        timelineX0,
        sketch.yTimeline - 2 * scale,
        xNow,
        sketch.yTimeline - 2 * scale
      );

      const allFinished =
        branches.length && branches.every((br) => br.finished);
      if (allFinished) {
        resetSketch();
        return;
      }

      p.background(0);
      p.push();
      p.translate(p.width / 2, p.height / 2);
      p.scale(zoom);
      p.translate(pan.x, pan.y);
      p.image(worldBuffer, -bufferCenter.x, -bufferCenter.y);
      p.image(timelineLayer, -bufferCenter.x, -bufferCenter.y);
      p.pop();

      if (isRecording) {
        p.frameRate(6);
      } else {
        p.frameRate(30);
      }
      if (isRecording && savedFrames < framesToSave) {
        p.saveCanvas("frame-" + p.nf(savedFrames, 4), "png");
        savedFrames++;
      }
    };

    function getBucketKey(v) {
      return `${Math.floor(v.x / widthBucket)},${Math.floor(v.y / widthBucket)}`;
    }

    function resetSketch() {
      randomUnit = p.random([0.1, 0.2, 0.3, 0.4, 0.5, 1, 2, 3, 4, 5]);

      simFrame = 0;
      worldBuffer.clear();
      worldBuffer.background(0);
      charCache.clear();
      p.setup();
    }

    p.mousePressed = () => {
      dragging = true;
      lastX = p.mouseX;
      lastY = p.mouseY;
    };
    p.mouseReleased = () => {
      dragging = false;
    };
    p.mouseDragged = () => {
      if (dragging) {
        const dx = (p.mouseX - lastX) / zoom,
          dy = (p.mouseY - lastY) / zoom;
        pan.x += dx;
        pan.y += dy;
        lastX = p.mouseX;
        lastY = p.mouseY;
      }
    };

    p.mouseWheel = (e) => {
      const zoomFactor = e.deltaY < 0 ? 1.05 : 1 / 1.05;

      const tCurrent = Math.min(simFrame / timelineFrames, 1);
      const xNow =
        sketch.timelineX0 + tCurrent * (sketch.timelineX1 - sketch.timelineX0);
      const yNow = sketch.yTimeline;

      const screenCenterX = p.width / 2;
      const screenCenterY = p.height / 2;
      const tipScreenX = screenCenterX + (xNow - bufferCenter.x + pan.x) * zoom;
      const tipScreenY = screenCenterY + (yNow - bufferCenter.y + pan.y) * zoom;

      zoom = p.constrain(zoom * zoomFactor, 0.5, 1);

      pan.x = (screenCenterX - tipScreenX) / zoom + pan.x;
      pan.y = (screenCenterY - tipScreenY) / zoom + pan.y;

      return false;
    };

    p.windowResized = () => {
      p.resizeCanvas(p.windowWidth, p.windowHeight);
    };
  };
</script>

<Record />
<div class="viz-container">
  <P5 {sketch} style="position:absolute; top:0; left:0;" />
</div>

<style>
  .viz-container {
    width: 100vw;
    height: 100vh;
    overflow: hidden;
    background: #000;
  }
</style>
