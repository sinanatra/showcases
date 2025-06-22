<script>
  import P5 from "p5-svelte";

  let sketch = (p) => {
    const SCALE = 0.8;
    const segmentLength = 8 * SCALE;
    const repulsionRadius = 20 * SCALE;
    const repulsionStrength = 0.2 * SCALE;
    const widthBucket = 100 * SCALE;
    const noiseScale = 0.01 * SCALE;
    const noiseSpeed = 0.005;
    const growthInterval = 1;
    const ltrSpacing = 8 * SCALE;
    const timelineFrames = 800;
    const keywordColors = {};

    let multi = 4;

    let branches = [];
    let pan = { x: 0, y: 0 };
    let zoom = 1;
    let dragging = false;
    let lastX = 0,
      lastY = 0;
    let simFrame = 0;
    let randomUnit = p.random([0.1, 0.2, 0.5, 1, 2, 3, 4, 5]);
    console.log(randomUnit);

    let worldBuffer, timelineLayer;
    const globalBuckets = new Map();
    let bufferCenter = { x: 0, y: 0 };
    let bufferBounds = { left: 0, right: 0, top: 0, bottom: 0 };

    let minDate,
      maxDate,
      span,
      yearLabels = [];

    p.preload = () => {
      p.dataTable = p.loadTable("parsed.csv", "csv", "header");
    };

    p.setup = () => {
      p.createCanvas(p.windowWidth, p.windowHeight);
      p.colorMode(p.HSB);
      p.textAlign(p.CENTER, p.CENTER);
      p.textSize(12 * SCALE);

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

      minDate = rows[1].date; // test [1] to avoid 2018 ?
      maxDate = rows.at(-1).date;

      span = maxDate - minDate;

      const w = Math.max(p.width * multi, 2200);
      const h = Math.max(p.height * multi, 2000);

      const marginY = (h / 3) * SCALE;
      const rightDataMargin = 800 * SCALE;

      bufferCenter = { x: w / 2, y: h / 2 };
      bufferBounds = { left: 0, right: w, top: 0, bottom: h };

      worldBuffer = p.createGraphics(w, h);
      worldBuffer.colorMode(p.HSB);
      worldBuffer.textAlign(p.CENTER, p.CENTER);
      worldBuffer.textFont("monospace");
      worldBuffer.textSize(13 * SCALE);
      worldBuffer.background(0);

      timelineLayer = p.createGraphics(w, h);
      timelineLayer.colorMode(p.HSB);
      timelineLayer.textAlign(p.CENTER, p.CENTER);
      timelineLayer.textFont("monospace");

      const allYears = [
        ...new Set(rows.map((a) => new Date(a.date).getFullYear())),
      ].sort((a, b) => a - b);

      // console.log(allYears)

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
        let hue = (i * (360 / keywords.length)) % 360;
        let sat = 18;
        let bri = 57;
        keywordColors[kw] = p.color(hue, sat, bri);
      });

      branches = [];
      const yTimeline = marginY + 30 * SCALE;

      rows.forEach((row, i) => {
        const t = (row.date - minDate) / span;

        const x0 = timelineX0 + t * (timelineX1 - timelineX0);
        const y0 = yTimeline;
        const startFrame = Math.floor(t * timelineFrames);

        row.sents.forEach(({ kw, s }) => {
          const maxSteps = Math.ceil(s.length * (ltrSpacing / segmentLength));
          const hue = p.map(
            keywords.indexOf(kw),
            0,
            keywords.length - 1,
            0,
            360
          );

          const dir0 = p
            .createVector(p.random(-randomUnit, randomUnit), 1)
            .normalize();

          branches.push({
            kw,
            nodes: [p.createVector(x0, y0)],
            hue,
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

      zoom = Math.min(
        p.width / bufferBounds.right,
        p.height / bufferBounds.bottom
      );
      pan = { x: 0, y: 0 };

      sketch.timelineX0 = timelineX0;
      sketch.timelineX1 = timelineX1;
      sketch.yTimeline = yTimeline;
      sketch.rightDataMargin = rightDataMargin;
      sketch.w = w;
      sketch.h = h;
    };

    p.draw = () => {
      globalBuckets.clear();
      branches.forEach((br) =>
        br.nodes.forEach((n) => {
          const key = `${Math.floor(n.x / widthBucket)},${Math.floor(n.y / widthBucket)}`;
          if (!globalBuckets.has(key)) globalBuckets.set(key, []);
          globalBuckets.get(key).push(n);
        })
      );

      // worldBuffer.noStroke();
      // worldBuffer.fill(0, 0, 0, 0.01);
      // worldBuffer.rect(0, 0, worldBuffer.width, worldBuffer.height);

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

        const nv = p.noise(
          tip.x * noiseScale,
          tip.y * noiseScale,
          simFrame * noiseSpeed
        );
        dir.rotate(p.map(nv, 0, 1, -p.QUARTER_PI * 0.6, p.QUARTER_PI * 0.6));

        const next = p.Vector.add(tip, p.Vector.mult(dir, segmentLength));
        next.x = p.constrain(
          next.x,
          bufferBounds.left + 10 * SCALE,
          bufferBounds.right - 10 * SCALE
        );
        next.y = p.constrain(
          next.y,
          bufferBounds.top + 10 * SCALE,
          bufferBounds.bottom - 10 * SCALE
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

            worldBuffer.push();
            worldBuffer.translate(px, py);
            worldBuffer.rotate(ang);

            const letter = br.sentence[ci];
            const bgPadX = 2 * SCALE;
            const bgPadY = 2 * SCALE;
            const textSize = repulsionRadius / 2;
            worldBuffer.textSize(textSize);
            const w = worldBuffer.textWidth(letter);

            worldBuffer.noStroke();
            // worldBuffer.fill(0, 0, 80, 1);
            // console.log(br.kw);
            worldBuffer.fill(keywordColors[br.kw]);
            worldBuffer.rectMode(p.CENTER);
            worldBuffer.rect(0, -segmentLength, w + bgPadX, textSize + bgPadY);

            worldBuffer.pop();

            worldBuffer.push();
            worldBuffer.translate(px, py);
            worldBuffer.rotate(ang);
            worldBuffer.textAlign(p.CENTER, p.CENTER);
            worldBuffer.textFont("monospace");
            worldBuffer.textSize(textSize);
            worldBuffer.fill(0, 0, 0);
            worldBuffer.text(letter, 0, -segmentLength);
            worldBuffer.pop();

            br.lastPlacedCharIndex = ci;
            ci++;
          } else break;
        }

        if (br.grown >= br.maxSteps) br.finished = true;
      });

      simFrame++;

      timelineLayer.clear();

      const timelineX0 = sketch.timelineX0;
      const timelineX1 = sketch.timelineX1;
      const yTimeline = sketch.yTimeline;

      timelineLayer.stroke(0, 0, 255);
      timelineLayer.strokeWeight(2 * SCALE);
      timelineLayer.line(timelineX0, yTimeline, timelineX1, yTimeline);

      yearLabels.forEach(({ year, avgT }) => {
        const x = timelineX0 + avgT * (timelineX1 - timelineX0);
        const labelY = yTimeline - 32 * SCALE;

        timelineLayer.noStroke();
        timelineLayer.fill(0, 0, 255);
        timelineLayer.textSize(18 * SCALE);
        timelineLayer.text(year, x, labelY);

        const tickStartY = labelY + 22 * SCALE;
        timelineLayer.push();
        timelineLayer.stroke(0, 0, 255);
        timelineLayer.strokeWeight(2 * SCALE);
        timelineLayer.drawingContext.setLineDash([18 * SCALE, 10 * SCALE]);
        timelineLayer.line(x, tickStartY, x, sketch.h);
        timelineLayer.drawingContext.setLineDash([]);
        timelineLayer.pop();
      });

      const tCurrent = Math.min(simFrame / timelineFrames, 1);
      const xNow = timelineX0 + tCurrent * (timelineX1 - timelineX0);
      timelineLayer.stroke(0, 0, 255);
      timelineLayer.strokeWeight(4.5 * SCALE);
      timelineLayer.line(
        timelineX0,
        yTimeline - 2 * SCALE,
        xNow,
        yTimeline - 2 * SCALE
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
    };

    function getBucketKey(v) {
      return `${Math.floor(v.x / widthBucket)},${Math.floor(v.y / widthBucket)}`;
    }

    function resetSketch() {
      randomUnit = p.random([0.1, 0.2, 0.5, 1, 2, 3, 4, 5]);

      simFrame = 0;
      worldBuffer.clear();
      worldBuffer.background(0);
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
      const mx = p.mouseX - p.width / 2;
      const my = p.mouseY - p.height / 2;
      pan.x -= (mx / zoom) * (zoomFactor - 1);
      pan.y -= (my / zoom) * (zoomFactor - 1);
      zoom = p.constrain(zoom * zoomFactor, 0.2, 8);
      return false;
    };

    p.windowResized = () => {
      p.resizeCanvas(p.windowWidth, p.windowHeight);
    };
  };
</script>

<div class="viz-container">
  <P5 {sketch} style="position:absolute; top:0; left:0;" />
</div>

<style>
  :global(body) {
    margin: 0;
  }
  .viz-container {
    width: 100vw;
    height: 100vh;
    overflow: hidden;
    background: #000;
  }
</style>
