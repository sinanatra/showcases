<script>
  import P5 from "p5-svelte";

  let sketch = (p) => {
    const scale = 0.8;
    const segmentLength = 8 * scale;
    const repulsionRadius = 20 * scale;
    const repulsionStrength = 0.1;
    const widthBucket = 90 * scale;
    const ltrSpacing = 7 * scale;
    const noisescale = 0.015;
    const timelineFrames = 600;
    const keywordColors = {};

    let branches = [];
    let pan = { x: 0, y: 0 };
    let zoom = 1;
    let dragging = false;
    let lastX = 0,
      lastY = 0;
    let simFrame = 0;
    let worldBuffer, arcLayer;
    const globalBuckets = new Map();
    let bufferCenter,
      bufferBounds,
      attractors = [];
    let minDate, maxDate, timelineRadius, span, w, h;
    let yearLabels = [];
    let randomUnit = 1;

    p.preload = () => {
      p.dataTable = p.loadTable("parsed.csv", "csv", "header");
    };

    p.setup = () => {
      p.createCanvas(p.windowWidth, p.windowHeight);
      p.colorMode(p.HSB);
      p.textFont("monospace");
      p.textSize(13 * scale);
      p.textAlign(p.CENTER, p.CENTER);
      randomUnit = p.random([0.1, 0.2, 0.3, 0.4, 0.5, 0.8, 0.9, 1]);

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

      minDate = rows[0].date;
      maxDate = rows.at(-1).date;
      span = maxDate - minDate;

      timelineRadius = Math.max(p.width, p.height) * 0.8 * scale;
      w = Math.max(p.width * 2, timelineRadius * 2 + 40 * scale);
      h = Math.max(p.height * 2, timelineRadius * 2 + 40 * scale);
      //   bufferCenter = { x: w / 2, y: 0 };
      bufferCenter = { x: w / 2, y: h / 2 };
      bufferBounds = { left: 0, right: w, top: 0, bottom: h };

      worldBuffer = p.createGraphics(w, h);
      worldBuffer.colorMode(p.HSB);
      worldBuffer.textFont("monospace");
      worldBuffer.textSize(13 * scale);
      worldBuffer.background(0);

      attractors = rows.map((row, i) => {
        const t = (row.date - minDate) / span;
        // const radius = t * timelineRadius + 120;
        const INNER_OFFSET = 1 * scale;
        const radius = t * timelineRadius + INNER_OFFSET;

        const angle = p.random(p.TWO_PI); // full 360
        return {
          x: bufferCenter.x + Math.cos(angle) * radius,
          y: bufferCenter.y + Math.sin(angle) * radius,
          row,
          angle,
          radius,
          t,
        };
      });

      const allYears = [
        ...new Set(attractors.map((a) => new Date(a.row.date).getFullYear())),
      ].sort((a, b) => a - b);
      yearLabels = allYears.map((year) => {
        const yearAttractors = attractors.filter(
          (a) => new Date(a.row.date).getFullYear() === year
        );
        const avgAngle =
          yearAttractors.reduce((sum, a) => sum + a.angle, 0) /
          yearAttractors.length;
        const avgRadius =
          yearAttractors.reduce((sum, a) => sum + a.radius, 0) /
          yearAttractors.length;
        return { year, avgAngle, avgRadius };
      });

      arcLayer = p.createGraphics(w, h);

      branches = attractors.map((a, i) => ({
        nodes: [p.createVector(a.x, a.y)],
        hue: p.map(i, 0, attractors.length - 1, 0, 360),
        sentence: a.row.sents.length ? a.row.sents[0].s : "",
        maxSteps: Math.ceil(
          (a.row.sents[0]?.s.length || 20) * (ltrSpacing / segmentLength)
        ),
        grown: 0,
        attractor: a,
        pathLength: 0,
        distArr: [0],
        lastPlacedCharIndex: -1,
        finished: false,
        startFrame: Math.floor(a.t * timelineFrames),
        frameCount: 0,
        direction: p
          .createVector(Math.cos(a.angle), Math.sin(a.angle))
          .rotate(p.random(-randomUnit, randomUnit)),
        keyword: a.row.sents.length ? a.row.sents[0].kw : null,
      }));

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

      branches.forEach((br, i) => {
        if (br.finished || simFrame < br.startFrame) return;
        if (br.frameCount++ % 1) return;
        const tip = br.nodes[br.nodes.length - 1];
        let dir = br.direction.copy();

        branches.forEach((other, j) => {
          if (i !== j && !other.finished) {
            const otherTip = other.nodes[other.nodes.length - 1];
            const d = tip.dist(otherTip);
            if (d > 0 && d < repulsionRadius) {
              dir.add(
                p.Vector.sub(tip, otherTip).normalize().mult(repulsionStrength)
              );
            }
          }
        });

        const nv = p.noise(
          tip.x * noisescale,
          tip.y * noisescale,
          simFrame * 0.006
        );
        dir.rotate(p.map(nv, 0, 1, -p.QUARTER_PI / 2, p.QUARTER_PI / 2));
        dir.normalize();
        const next = p.Vector.add(tip, p.Vector.mult(dir, segmentLength));
        next.x = p.constrain(
          next.x,
          24 * scale,
          bufferBounds.right - 24 * scale
        );
        next.y = p.constrain(
          next.y,
          24 * scale,
          bufferBounds.bottom - 24 * scale
        );

        if (
          next.x < bufferBounds.left + 10 * scale ||
          next.x > bufferBounds.right - 10 * scale ||
          next.y < bufferBounds.top + 10 * scale ||
          next.y > bufferBounds.bottom - 10 * scale
        ) {
          br.finished = true;
          return;
        }

        br.nodes.push(next);
        br.grown++;
        br.pathLength += segmentLength;
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

            worldBuffer.textSize(repulsionRadius / 2);
            // measure the text
            const glyphW = Math.max(worldBuffer.textWidth(br.sentence[ci]), 4);
            const glyphH = worldBuffer.textAscent() + worldBuffer.textDescent();
            const PAD = 0.4 * scale;

            worldBuffer.noStroke();

            worldBuffer.fill(keywordColors[br.keyword] || p.color(60, 8, 57));

            worldBuffer.rectMode(p.CENTER);
            worldBuffer.rect(
              0,
              -segmentLength,
              glyphW + PAD * 2,
              glyphH + PAD * 2
            );

            worldBuffer.pop();

            worldBuffer.push();
            worldBuffer.translate(px, py);
            worldBuffer.rotate(ang);
            worldBuffer.textAlign(p.CENTER, p.CENTER);
            worldBuffer.textFont("monospace");
            worldBuffer.textSize(repulsionRadius / 2);
            worldBuffer.fill(0);

            const jx = p.map(p.noise(px * 0.01, ci), 0, 1, -0.9, 0.9);
            const jy = p.map(p.noise(py * 0.01, ci + 100), 0, 1, -0.9, 0.9);
            worldBuffer.text(br.sentence[ci], jx, -segmentLength + jy);

            worldBuffer.pop();

            br.lastPlacedCharIndex = ci;
            ci++;
          } else break;
        }
      });

      simFrame++;

      const currentTime = minDate + (simFrame / timelineFrames) * span;
      const currentYear = new Date(currentTime).getFullYear();

      arcLayer.clear();
      arcLayer.textFont("monospace");

      const LABEL_Y = bufferCenter.y;
      const PADDING = 10 * scale;
      arcLayer.textAlign(arcLayer.RIGHT, arcLayer.RIGHT);

      yearLabels.forEach(({ year, avgRadius }) => {
        const isCurrent = year === currentYear;

        arcLayer.stroke(255, isCurrent ? 255 : 100);
        arcLayer.strokeWeight(isCurrent ? 1 : 0.5);
        arcLayer.noFill();
        arcLayer.ellipse(
          bufferCenter.x,
          bufferCenter.y,
          avgRadius * 2,
          avgRadius * 2
        );

        const labelX = bufferCenter.x - avgRadius - PADDING;

        arcLayer.noStroke();
        arcLayer.fill(isCurrent ? 255 : 200);
        arcLayer.textSize(isCurrent ? 12 * scale : 7 * scale);
        arcLayer.text(year, labelX, LABEL_Y);
      });

      const allFinished =
        branches.length && branches.every((br) => br.finished);
      if (allFinished || simFrame % 600 === 0) {
        resetSketch();
        return;
      }

      p.background(0);

      p.push();
      //   p.translate(p.width / 2, 0);
      p.translate(p.width / 2, p.height / 2);
      p.scale(zoom);
      p.translate(pan.x, pan.y);
      p.image(worldBuffer, -bufferCenter.x, -bufferCenter.y);
      p.image(arcLayer, -bufferCenter.x, -bufferCenter.y);
      p.pop();
    };

    function resetSketch() {
      simFrame = 0;
      worldBuffer.clear();
      worldBuffer.background(0);
      branches = attractors.map((a, i) => ({
        nodes: [p.createVector(a.x, a.y)],
        hue: p.map(i, 0, attractors.length - 1, 0, 360),
        sentence: a.row.sents.length ? a.row.sents[0].s : "",
        maxSteps: Math.ceil(
          (a.row.sents[0]?.s.length || 20) * (ltrSpacing / segmentLength)
        ),
        grown: 0,
        attractor: a,
        pathLength: 0,
        distArr: [0],
        lastPlacedCharIndex: -1,
        finished: false,
        startFrame: Math.floor(a.t * timelineFrames),
        frameCount: 0,
        direction: p
          .createVector(Math.cos(a.angle), Math.sin(a.angle))
          .rotate(p.random(-randomUnit, randomUnit)),
        keyword: a.row.sents.length ? a.row.sents[0].kw : null,
      }));
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
      const zf = e.deltaY < 0 ? 1.05 : 1 / 1.05;
      const mx = p.mouseX - p.width / 2;
      pan.x -= (mx / zoom) * (zf - 1);
      zoom = p.constrain(zoom * zf, 0.2, 8);
      return false;
    };
    p.windowResized = () => p.resizeCanvas(p.windowWidth, p.windowHeight);
  };
</script>

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
