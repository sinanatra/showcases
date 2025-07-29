<script>
  import P5 from "p5-svelte";
  import { onMount } from "svelte";
  import * as d3 from "d3";

  const growthParams = {
    fungal: {
      branchingChance: 0.29,
      directionRandomness: 2,
      branchAngle: Math.PI / 1.4,
      downwardBias: 0.01,
    },

    leaf: {
      branchingChance: 0.2,
      directionRandomness: 0.2,
      branchAngle: Math.PI / 1.4,
      downwardBias: 0.01,
    },

    chaos: {
      branchingChance: 2,
      directionRandomness: 7,
      branchAngle: Math.PI / 1.4,
      downwardBias: 0.01,
    },
    covid: {
      branchingChance: 9,
      directionRandomness: 200,
      branchAngle: Math.PI / 1.4,
      downwardBias: 0.01,
    },
    root: {
      branchingChance: 6,
      directionRandomness: 1,
      branchAngle: Math.PI / 1.5,
      downwardBias: 10,
    },
  };

  let allData = [];
  onMount(async () => {
    const raw = await d3.csv("parsed.csv");
    allData = raw.map((d) => ({
      ...d,
      KeywordMatch:
        typeof d.KeywordMatch === "string"
          ? d.KeywordMatch.replace(/[\[\]'"]/g, "")
              .split(/[,;]/)
              .map((s) => s.trim())
              .filter(Boolean)
          : [],
      Text: d.Text || "",
    }));
  });

  let keywordFilter = "";
  let textFilter = "";
  let growthMode = "chaos";
  $: sketchKey = `${keywordFilter}|${textFilter}|${growthMode}|${filteredData.length}`;

  $: allKeywords = Array.from(
    new Set(
      allData.flatMap((d) =>
        Array.isArray(d.KeywordMatch) ? d.KeywordMatch : []
      )
    )
  ).sort();

  $: filteredData = allData
    .filter((d) => {
      if (keywordFilter && !(d.KeywordMatch || []).includes(keywordFilter))
        return false;
      if (
        textFilter &&
        !(d.Text || "").toLowerCase().includes(textFilter.toLowerCase())
      )
        return false;
      return true;
    })
    .reverse()
    .slice(0, 200);

  function resetSketch() {
    sketchKey += 1;
  }
  $: resetSketch();

  function getGrowthParams() {
    return growthParams[growthMode] || growthParams.fungal;
  }

  let sketch = (p) => {
    const scale = 0.75,
      segmentLength = 8 * scale,
      repulsionRadius = 12 * scale,
      repulsionStrength = 0.6 * scale,
      widthBucket = 100 * scale;

    const noiseScale = 0.01 * scale,
      noiseSpeed = 0.05,
      growthInterval = 1,
      ltrSpacing = 8 * scale;

    const charCache = new Map(),
      keywordColors = {};

    let branches = [],
      pan = { x: 0, y: 0 },
      zoom = 1,
      dragging = false,
      lastX = 0,
      lastY = 0,
      simFrame = 0;
    let bufferCenter = { x: 0, y: 0 },
      bufferBounds = { left: 0, right: 0, top: 0, bottom: 0 };
    let worldBuffer,
      globalBuckets = new Map(),
      randomUnit = 1;

    function growBranch(br, tip, simFrame, p) {
      const params = getGrowthParams();
      let dir = br.dir0.copy();
      dir.y += params.downwardBias;
      dir.normalize();
      let nv = p.noise(
        tip.x * noiseScale,
        tip.y * noiseScale,
        simFrame * noiseSpeed
      );
      dir.rotate(
        p.map(nv, 0, 1, -params.directionRandomness, params.directionRandomness)
      );
      return dir;
    }

    function getCachedLetter(kw, letter, textSize) {
      const key = `${kw}_${letter}_${textSize}`;
      if (charCache.has(key)) return charCache.get(key);
      const pg = p.createGraphics(40 * scale, 40 * scale);
      pg.colorMode(p.HSB);
      pg.textFont("courier");
      pg.textAlign(p.CENTER, p.CENTER);
      pg.textSize(textSize);

      const w = Math.max(pg.textWidth(letter), 4);
      pg.noStroke();
      pg.fill(keywordColors[kw] || p.color(0, 0, 60));
      pg.rectMode(p.CENTER);
      pg.rect(pg.width / 2, pg.height / 2, w + 4, textSize + 4);

      pg.fill(0, 0, 0);
      pg.text(letter, pg.width / 2, pg.height / 2);

      charCache.set(key, pg);
      return pg;
    }

    function setupBranches(filteredData, w, h) {
      const cx = w / 2,
        cy = h / 2;
      const allKws = Array.from(
        new Set(
          filteredData
            .flatMap((a) =>
              Array.isArray(a.KeywordMatch) ? a.KeywordMatch : []
            )
            .filter(Boolean)
        )
      );
      allKws.forEach((kw, i) => {
        let bri = 60 + (i * 180) / Math.max(allKws.length - 1, 1);
        keywordColors[kw] = p.color(0, 0, bri);
      });

      let result = [];
      if (!filteredData.length) return result;

      function shorten(text, maxLen = 300) {
        if (!text) return "";
        if (text.length <= maxLen) return text;
        let cut = text.lastIndexOf(" ", maxLen);
        if (cut === -1) cut = maxLen;
        return text.slice(0, cut) + "…";
      }

      function shortenAroundKeyword(text, keyword, maxLen = 200) {
        if (!text || !keyword) return shorten(text, maxLen);
        const i = text.toLowerCase().indexOf(keyword.toLowerCase());
        if (i === -1) return shorten(text, maxLen);

        let start = Math.max(0, i - Math.floor((maxLen - keyword.length) / 2));
        let end = start + maxLen;

        if (end > text.length) {
          end = text.length;
          start = Math.max(0, end - maxLen);
        }

        if (start > 0) {
          const spaceBefore = text.lastIndexOf(" ", start);
          if (spaceBefore !== -1) start = spaceBefore + 1;
        }
        if (end < text.length) {
          const spaceAfter = text.indexOf(" ", end);
          if (spaceAfter !== -1) end = spaceAfter;
        }

        let result = text.slice(start, end);
        if (start > 0) result = "…" + result;
        if (end < text.length) result = result + "…";
        return result;
      }

      let kw = filteredData[0]?.KeywordMatch?.[0] || "";
      let trunkText = shortenAroundKeyword(
        filteredData[0]?.Text ?? filteredData[0]?.sentence ?? "",
        kw
      );

      result.push({
        kw: filteredData[0]?.KeywordMatch?.[0] || "",
        nodes: [p.createVector(cx, cy)],
        sentence: trunkText,
        maxSteps: Math.ceil(trunkText.length * (ltrSpacing / segmentLength)),
        grown: 0,
        frameCount: 0,
        dir0: p.createVector(0, -1).normalize(),
        pathLength: 0,
        distArr: [0],
        lastPlacedCharIndex: -1,
        finished: false,
        parent: null,
        attachAt: 0,
      });

      for (let i = 1; i < filteredData.length; i++) {
        let parentIndex = Math.floor(Math.random() * Math.max(1, i));
        let parentBranch = result[parentIndex];

        let parentAttachIdx = Math.floor(
          2 + Math.random() * Math.max(1, parentBranch.nodes.length - 8)
        );
        parentAttachIdx = Math.max(
          1,
          Math.min(parentAttachIdx, parentBranch.nodes.length - 3)
        );

        let attachPoint =
          parentBranch.nodes[parentAttachIdx] ||
          parentBranch.nodes[parentBranch.nodes.length - 1];

        let direction = parentBranch.nodes[parentAttachIdx + 1]
          ? p
              .createVector(
                parentBranch.nodes[parentAttachIdx + 1].x -
                  parentBranch.nodes[parentAttachIdx].x,
                parentBranch.nodes[parentAttachIdx + 1].y -
                  parentBranch.nodes[parentAttachIdx].y
              )
              .normalize()
          : p.createVector(0, -1);

        let branchAngle = ((Math.random() - 0.5) * Math.PI) / 1.2;
        direction.rotate(branchAngle);

        let kw = filteredData[i]?.KeywordMatch?.[0] || "";
        let text = shortenAroundKeyword(
          filteredData[i]?.Text ?? filteredData[i]?.sentence ?? "",
          kw
        );

        result.push({
          kw: filteredData[i].KeywordMatch?.[0] || "",
          nodes: [attachPoint.copy()],
          sentence: text,
          maxSteps: Math.ceil(text.length * (ltrSpacing / segmentLength)),
          grown: 0,
          frameCount: 0,
          dir0: direction,
          pathLength: 0,
          distArr: [0],
          lastPlacedCharIndex: -1,
          finished: false,
          parent: parentIndex,
          attachAt: parentAttachIdx,
        });
      }
      return result;
    }

    p.setup = () => {
      p.createCanvas(window.innerWidth, window.innerHeight);

      p.colorMode(p.HSB);
      p.textAlign(p.CENTER, p.CENTER);
      p.textSize(9 * scale);
      p.frameRate(30);
      if (!filteredData || !filteredData.length) {
        worldBuffer = null;
        return;
      }
      const w = 4200 * scale,
        h = 4200 * scale;

      bufferCenter = { x: w / 2, y: h / 2 };
      bufferBounds = { left: 0, right: w, top: 0, bottom: h };
      worldBuffer = p.createGraphics(w, h);
      worldBuffer.colorMode(p.HSB);
      worldBuffer.textAlign(p.CENTER, p.CENTER);
      worldBuffer.textFont("courier");
      worldBuffer.textSize(13 * scale);

      branches = setupBranches(filteredData, w, h);

      zoom = 1;
      pan = { x: 0, y: 0 };
      simFrame = 0;
      randomUnit = p.random([0.1, 0.2, 0.3, 0.4, 0.5, 1]);
    };

    p.draw = () => {
      if (!worldBuffer) {
        p.background(0);
        return;
      }
      globalBuckets = new Map();

      branches.forEach((br) =>
        br.nodes.forEach((n) => {
          if (!n) return;
          const key = `${Math.floor(n.x / widthBucket)},${Math.floor(n.y / widthBucket)}`;
          if (!globalBuckets.has(key)) globalBuckets.set(key, []);
          globalBuckets.get(key).push(n);
        })
      );
      const params = getGrowthParams();
      branches.forEach((br) => {
        if (br.finished) return;
        br.frameCount++;
        if (br.frameCount % growthInterval !== 0 || br.grown >= br.maxSteps)
          return;
        const tip = br.nodes && br.nodes[br.nodes.length - 1];
        if (!tip) return;
        let dir = growBranch(br, tip, simFrame, p);

        const [bx, by] = [
          Math.floor(tip.x / widthBucket),
          Math.floor(tip.y / widthBucket),
        ];
        for (let dx = -1; dx <= 1; dx++)
          for (let dy = -1; dy <= 1; dy++)
            (globalBuckets.get(`${bx + dx},${by + dy}`) || []).forEach((n2) => {
              if (!n2) return;
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
        dir.normalize();

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
            const v0 = br.nodes[si - 1],
              v1 = br.nodes[si];
            if (!v0 || !v1) break;
            const tnorm = (target - d0) / v1.dist(v0);
            const px = p.lerp(v0.x, v1.x, tnorm),
              py = p.lerp(v0.y, v1.y, tnorm);
            const ang = p.atan2(v1.y - v0.y, v1.x - v0.x);

            const letter = br.sentence[ci];
            const textSize = repulsionRadius / 1.2;
            const cached = getCachedLetter(br.kw, letter, textSize);
            if (cached) {
              worldBuffer.push();
              worldBuffer.translate(px, py);
              worldBuffer.rotate(ang);
              worldBuffer.imageMode(p.CENTER);
              worldBuffer.image(cached, 0, -segmentLength);
              worldBuffer.pop();
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
      if (worldBuffer) p.image(worldBuffer, -bufferCenter.x, -bufferCenter.y);
      p.pop();
    };

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
      zoom = p.constrain(zoom * zoomFactor, 0.5, 2);
      return false;
    };
    p.windowResized = () => {
      p.resizeCanvas(window.innerWidth, window.innerHeight);
    };
  };
</script>

<div class="pattern-ui">
  <label>
    Pattern:
    <select bind:value={growthMode}>
      <option value="fungal">Fungal</option>
      <option value="leaf">Leaf</option>
      <option value="root">Root</option>
      <option value="chaos">Chaos</option>
      <option value="covid">COVID</option>
    </select>
  </label>
  <label>
    Keyword:
    <select bind:value={keywordFilter}>
      <option value="">(Alle)</option>
      {#each allKeywords as kw}
        <option value={kw}>{kw}</option>
      {/each}
    </select>
  </label>
  <label>
    Text:
    <input type="text" bind:value={textFilter} placeholder="Suche im Text..." />
  </label>
  <span>({filteredData.length} angezeigt)</span>
</div>

<div class="viz-container">
  {#key sketchKey}
    <P5 {sketch} style="position:absolute; top:0; left:0;" />
  {/key}
</div>

<style>
  .viz-container {
    width: 100vw;
    height: 100vh;
    overflow: hidden;
    background: #000;
  }
  .viz-container canvas {
    position: fixed !important;
    top: 0;
    left: 0;
    width: 100vw !important;
    height: 100vh !important;
    display: block;
    pointer-events: auto;
    z-index: 1;
  }
  .pattern-ui {
    position: absolute;
    top: 1em;
    left: 1em;
    z-index: 10;
    color: #fff;
    background: rgba(0, 0, 0, 0.7);
    padding: 0.7em 1.2em;
    border-radius: 13px;
    font-size: 1.1em;
    font-family: inherit;
    display: flex;
    gap: 1.2em;
    align-items: center;
  }
  select,
  option,
  input[type="text"] {
    color: #111;
    font-size: 1em;
    margin-left: 0.6em;
    border-radius: 6px;
    border: 1px solid #ccc;
  }
  input[type="text"] {
    padding: 0.2em 0.6em;
  }
  label {
    font-weight: 500;
  }
</style>
