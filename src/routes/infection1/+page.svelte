<script>
  import P5 from "p5-svelte";

  let sketch = (p) => {
    const SCALE = 0.6;

    let branches = [];
    let pan = { x: 0, y: 0 };
    let zoom = 1;
    let dragging = false;
    let lastX = 0,
      lastY = 0;
    let simFrame = 0;
    let multi = 4;

    const segmentLength = 8 * SCALE;
    const repulsionRadius = 20 * SCALE;
    const repulsionStrength = 0.3 * SCALE;
    const widthBucket = 100 * SCALE;
    const noiseScale = 0.01 * SCALE;
    const noiseSpeed = 0.005;
    const growthInterval = 1;
    const ltrSpacing = 7 * SCALE;
    const timelineFrames = 1200;

    let worldBuffer;
    const globalBuckets = new Map();
    let bufferCenter = { x: 0, y: 0 };
    let bufferBounds = { left: 0, right: 0, top: 0, bottom: 0 };

    p.preload = () => {
      p.dataTable = p.loadTable("parsed.csv", "csv", "header");
    };

    p.setup = () => {
      p.createCanvas(p.windowWidth, p.windowHeight);
      p.colorMode(p.HSB);
      p.textAlign(p.CENTER, p.CENTER);
      p.textFont("monospace");
      p.textSize(12 * SCALE);
      p.noFill();

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
            const rx = new RegExp(`([^\\.]*${kw}[^\\.]*)`, "i");
            const m0 = txt.match(rx);
            if (m0) sents.push({ kw, s: m0[1].trim() });
          });
          return { date, sents };
        })
        .sort((a, b) => a.date - b.date);

      if (!rows.length) return;

      const keywords = [
        ...new Set(rows.flatMap((r) => r.sents.map((s) => s.kw))),
      ];
      const minDate = rows[0].date;
      const maxDate = rows[rows.length - 1].date;
      const span = maxDate - minDate;

      const marginX = 60 * SCALE;
      const marginY = 70 * SCALE;
      const w = p.width * multi;
      const h = p.height;
      bufferCenter = { x: w / multi - marginX * multi, y: h / 2 };
      bufferBounds = { left: 0, right: w, top: 0, bottom: h };

      worldBuffer = p.createGraphics(w, h);
      worldBuffer.colorMode(p.HSB);
      worldBuffer.textAlign(p.CENTER, p.CENTER);
      worldBuffer.textFont("monospace");
      worldBuffer.textSize(13 * SCALE);
      worldBuffer.background(0);

      const verticalSpread = h - 2 * marginY;
      branches = [];
      rows.forEach((row, i) => {
        const t = (row.date - minDate) / span;
        const x0 = marginX + t * (w - 2 * marginX);
        const y0 =
          marginY +
          (i / rows.length) * verticalSpread +
          p.random(-100, 100) * SCALE;

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
          const dir0 = p.createVector(1, p.random(-0.15, 0.15)).normalize();
          branches.push({
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
          });
        });
      });
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

      worldBuffer.noStroke();
      worldBuffer.fill(0, 0, 0, 0.01);
      worldBuffer.rect(0, 0, worldBuffer.width, worldBuffer.height);

      branches.forEach((br) => {
        br.frameCount++;
        if (
          simFrame >= br.startFrame &&
          br.frameCount % growthInterval === 0 &&
          br.grown < br.maxSteps
        ) {
          const tip = br.nodes[br.nodes.length - 1];
          let dir = br.dir0.copy();
          const nv = p.noise(
            tip.x * noiseScale,
            tip.y * noiseScale,
            simFrame * noiseSpeed
          );
          dir.rotate(p.map(nv, 0, 1, -p.QUARTER_PI, p.QUARTER_PI) * 0.6);
          const [bx, by] = getBucketKey(tip).split(",").map(Number);
          for (let dx = -1; dx <= 1; dx++)
            for (let dy = -1; dy <= 1; dy++) {
              (globalBuckets.get(`${bx + dx},${by + dy}`) || []).forEach(
                (n2) => {
                  const d = tip.dist(n2);
                  if (d > 0 && d < repulsionRadius) {
                    dir.add(
                      p
                        .createVector(tip.x - n2.x, tip.y - n2.y)
                        .normalize()
                        .mult(repulsionStrength)
                    );
                  }
                }
              );
            }
          dir.normalize();

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
              const grey = p.map(br.hue, 0, 360, 10, 200);

              worldBuffer.push();
              worldBuffer.stroke(grey, 0, grey);
              worldBuffer.strokeWeight(repulsionRadius / 2);
              worldBuffer.noFill();
              worldBuffer.translate(px, py);
              worldBuffer.rotate(ang);

              worldBuffer.pop();

              worldBuffer.push();
              worldBuffer.noStroke();
              worldBuffer.fill(grey, 0, grey);
              worldBuffer.textAlign(p.CENTER, p.CENTER);
              worldBuffer.textFont("monospace");
              worldBuffer.textSize(repulsionRadius / 2);
              worldBuffer.translate(px, py);
              worldBuffer.rotate(ang);
              worldBuffer.text(br.sentence[ci], 0, -segmentLength);
              worldBuffer.pop();

              br.lastPlacedCharIndex = ci;
              ci++;
            } else break;
          }
        }
      });

      simFrame++;

      const allFinished =
        branches.length && branches.every((br) => br.grown >= br.maxSteps);

      if (allFinished || simFrame % 2000 === 0) {
        resetSketch();
        return;
      }

      p.background(0);
      p.push();
      p.translate(p.width / 2 + pan.x, p.height / 2 + pan.y);
      p.scale(zoom);
      p.image(worldBuffer, -bufferCenter.x, -bufferCenter.y);
      p.pop();
    };

    function getBucketKey(v) {
      return `${Math.floor(v.x / widthBucket)},${Math.floor(v.y / widthBucket)}`;
    }

    function resetSketch() {
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
