<script>
  import P5 from "p5-svelte";
  import { onMount } from "svelte";
  import * as d3 from "d3";

  import PatternMenu from "$lib/components/PatternMenu.svelte";
  import KeywordTooltip from "$lib/components/KeywordTooltip.svelte";
  import {
    filters,
    availableKeywords,
    filteredData,
    articles,
    CANONICAL_KEYWORDS,
  } from "$lib/stores.js";

  onMount(async () => {
    const raw = await d3.csv("/all_merged.csv");
    articles.set(
      raw.map((d) => ({
        ...d,
        KeywordMatch:
          typeof d.KeywordMatch === "string"
            ? d.KeywordMatch.replace(/[\[\]'"]/g, "")
                .split(/[,;]/)
                .map((s) => s.trim())
                .filter(Boolean)
            : [],
        Text: d.Text || "",
        URL: d.URL || "",
      }))
    );
  });

  const growthParams = {
    fungal: {
      branchingChance: 0.29,
      directionRandomness: 2,
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
      branchingChance: 10,
      directionRandomness: 200,
      branchAngle: Math.PI / 1.4,
      downwardBias: 0.01,
    },
  };
  const growthModes = Object.keys(growthParams);

  let growthMode = "chaos";
  let sketchKey = "";

  $: inputsKey = `${$filters.keyword}|${$filters.text}|${$filters.showOnlyLatest ? "1" : "0"}|${$filteredData.length}`;

  $: if (inputsKey) {
    growthMode = growthModes[Math.floor(Math.random() * growthModes.length)];

    const token = Math.random().toString(36).slice(2, 8);
    sketchKey = `${inputsKey}|${growthMode}|${token}`;
  }

  let hoveredText = "";
  let hoveredUrl = "";
  let tooltipX = 0,
    tooltipY = 0;
  let hoveredHitbox = null;

  function setTooltip(text, url, x, y, keywords = [], date = "") {
    hoveredText = text;
    hoveredUrl = url;
    tooltipX = x;
    tooltipY = y;
    hoveredHitbox = { keywords, date };
  }

  function setGrowthMode(val) {
    growthMode =
      val; /* no remount unless you want to: update sketchKey if needed */
  }
  function setKeywordFilter(val) {
    filters.set({ ...$filters, keyword: val });
  }
  function setTextFilter(val) {
    filters.set({ ...$filters, text: val });
  }
  function setShowOnlyLatest(val) {
    filters.set({ ...$filters, showOnlyLatest: val });
  }

  function shorten(text, maxLen = 300) {
    if (!text) return "";
    if (text.length <= maxLen) return text;
    let cut = text.lastIndexOf(" ", maxLen);
    if (cut === -1) cut = maxLen;
    return text.slice(0, cut) + "…";
  }

  function shortenAroundKeyword(text, keyword, maxLen = 200) {
    if (!text || !keyword) return shorten(text, maxLen);
    const i = text.toLowerCase().indexOf(String(keyword).toLowerCase());
    if (i === -1) return shorten(text, maxLen);
    let start = Math.max(0, i - Math.floor((maxLen - keyword.length) / 2));
    let end = start + maxLen;
    if (end > text.length) {
      end = text.length;
      start = Math.max(0, end - maxLen);
    }
    if (start > 0) {
      const s = text.lastIndexOf(" ", start);
      if (s !== -1) start = s + 1;
    }
    if (end < text.length) {
      const s = text.indexOf(" ", end);
      if (s !== -1) end = s;
    }
    let result = text.slice(start, end);
    if (start > 0) result = "…" + result;
    if (end < text.length) result = result + "…";
    return result;
  }

  let sketch = (p) => {
    const data = $filteredData;
    const params = () => growthParams[growthMode] || growthParams.fungal;

    const scale = 0.75,
      segmentLength = 8 * scale,
      repulsionRadius = 12 * scale,
      widthBucket = 100 * scale,
      ltrSpacing = 8 * scale;

    const charCache = new Map();
    const keywordColors = {};

    let branches = [],
      pan = { x: 0, y: 0 },
      zoom = 0.8,
      dragging = false,
      lastX = 0,
      lastY = 0,
      simFrame = 0;

    let bufferCenter = { x: 0, y: 0 },
      bufferBounds = { left: 0, right: 0, top: 0, bottom: 0 };

    let worldBuffer,
      globalBuckets = new Map();

    let letterHitboxes = [];
    let firstDraw = true;

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
      pg.fill(keywordColors[kw] || p.color(0, 0, 75));
      pg.rectMode(p.CENTER);
      pg.rect(pg.width / 2, pg.height / 2, w + 4, textSize + 4);
      pg.fill(0, 0, 0);
      pg.text(letter, pg.width / 2, pg.height / 2);
      charCache.set(key, pg);
      return pg;
    }

    function growBranch(br, tip) {
      const gp = params();
      let dir = br.dir0.copy();
      dir.y += gp.downwardBias;
      dir.normalize();
      let nv = p.noise(
        tip.x * 0.01 * scale,
        tip.y * 0.01 * scale,
        simFrame * 0.05
      );
      const ramp = 1;
      dir.rotate(
        p.map(
          nv,
          0,
          1,
          -gp.directionRandomness * ramp,
          gp.directionRandomness * ramp
        )
      );
      return dir;
    }

    function setupBranches(data, w, h) {
      const cx = w / 2,
        cy = h / 2;

      const allKws = Array.from(
        new Set(
          data.flatMap((a) =>
            Array.isArray(a.KeywordMatch) ? a.KeywordMatch : []
          )
        )
      );

      allKws.forEach(
        (kw, i) =>
          (keywordColors[kw] = p.color(
            0,
            0,
            55 + (i * 120) / Math.max(allKws.length - 1, 1)
          ))
      );

      const result = [];
      if (!data.length) return result;

      let kw0 = data[0]?.KeywordMatch?.[0] || "";
      let trunkText = shortenAroundKeyword(
        data[0]?.Text ?? data[0]?.sentence ?? "",
        kw0
      );

      result.push({
        kw: kw0,
        nodes: [p.createVector(cx, cy)],
        sentence: trunkText,
        url: data[0]?.URL || "",
        date: data[0]?.ExtractedDate || data[0]?.Date || "",
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

      for (let i = 1; i < data.length; i++) {
        let parentIndex = Math.floor(Math.random() * Math.max(1, i));
        let parentBranch = result[parentIndex];

        const attachMax = Math.max(3, parentBranch.nodes.length - 3);
        let parentAttachIdx = Math.max(
          1,
          Math.min(
            Math.floor(2 + Math.random() * (attachMax - 2)),
            attachMax - 1
          )
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

        let kw = data[i]?.KeywordMatch?.[0] || "";
        let text = shortenAroundKeyword(
          data[i]?.Text ?? data[i]?.sentence ?? "",
          kw
        );

        result.push({
          kw,
          nodes: [attachPoint.copy()],
          sentence: text,
          url: data[i]?.URL || "",
          date: data[i]?.ExtractedDate || data[i]?.Date || "",
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

    function screenToWorld(sx, sy) {
      return {
        x: (sx - p.width / 2) / zoom - pan.x + bufferCenter.x,
        y: (sy - p.height / 2) / zoom - pan.y + bufferCenter.y,
      };
    }
    function worldToScreen(wx, wy) {
      return {
        x: (wx - bufferCenter.x + pan.x) * zoom + p.width / 2,
        y: (wy - bufferCenter.y + pan.y) * zoom + p.height / 2,
      };
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

      const w = 4200 * scale,
        h = 4200 * scale;
      bufferCenter = { x: w / 2, y: h / 2 };
      bufferBounds = { left: 0, right: w, top: 0, bottom: h };

      worldBuffer = p.createGraphics(w, h);
      worldBuffer.colorMode(p.HSB);
      worldBuffer.textAlign(p.CENTER, p.CENTER);
      worldBuffer.textFont("courier");
      worldBuffer.textSize(13 * scale);

      branches = setupBranches(data, w, h);
      pan = { x: 0, y: 0 };
      simFrame = 0;
      letterHitboxes = [];
      firstDraw = true;
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

      branches.forEach((br) => {
        if (br.finished) return;
        br.frameCount++;
        if (br.frameCount % 1 !== 0 || br.grown >= br.maxSteps) return;

        const tip = br.nodes && br.nodes[br.nodes.length - 1];
        if (!tip) return;

        let dir = growBranch(br, tip);

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
                    .mult(0.6 * scale)
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
            if (br.lastPlacedCharIndex < ci) {
              letterHitboxes.push({
                worldX: px,
                worldY: py,
                radius: textSize * 2,
                url: br.url || "",
                text: br.sentence,
                keywords: [br.kw],
                date: br.date,
              });
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
      if (!dragging) return;
      const dx = (p.mouseX - lastX) / zoom,
        dy = (p.mouseY - lastY) / zoom;
      pan.x += dx;
      pan.y += dy;
      lastX = p.mouseX;
      lastY = p.mouseY;
    };
    p.mouseWheel = (e) => {
      const f = e.deltaY < 0 ? 1.05 : 1 / 1.05;
      zoom = p.constrain(zoom * f, 0.5, 2);
      return false;
    };
    p.windowResized = () => {
      p.resizeCanvas(window.innerWidth, window.innerHeight);
    };
    p.mouseOut = () => setTooltip("", "", 0, 0, []);
    p.mouseMoved = () => {
      const { x: wx, y: wy } = screenToWorld(p.mouseX, p.mouseY);
      hoveredHitbox = null;
      for (let hit of letterHitboxes) {
        if (p.dist(wx, wy, hit.worldX, hit.worldY) < hit.radius) {
          const { x, y } = worldToScreen(hit.worldX, hit.worldY);
          setTooltip(hit.text, hit.url, x, y - 22, hit.keywords, hit.date);
          hoveredHitbox = hit;
          break;
        }
      }
      if (!hoveredHitbox) setTooltip("", "", 0, 0, []);
    };
    p.keyPressed = () => {
      if ((p.key === " " || p.keyCode === 32) && hoveredHitbox?.url) {
        window.open(hoveredHitbox.url, "_blank");
        return false;
      }
    };
  };
</script>

<div class="controls">
  <label>
    Keyword:
    <select
      bind:value={$filters.keyword}
      on:change={(e) => setKeywordFilter(e.target.value)}
    >
      <option value="">All</option>
      {#each $availableKeywords as canon}
        <option value={canon}>{canon}</option>
      {/each}
    </select>
  </label>

  <label>
    Text:
    <input
      type="text"
      bind:value={$filters.text}
      on:input={(e) => setTextFilter(e.target.value)}
      placeholder="search text…"
    />
  </label>

  <label class="checkbox">
    <input
      type="checkbox"
      bind:checked={$filters.showOnlyLatest}
      on:change={(e) => setShowOnlyLatest(e.target.checked)}
    />
    Show only the latest
  </label>

  <span class="count"
    >{$filteredData.length} result{$filteredData.length === 1 ? "" : "s"}</span
  >
</div>

<PatternMenu
  {growthMode}
  keywordFilter={$filters.keyword}
  textFilter={$filters.text}
  {setGrowthMode}
  {setKeywordFilter}
  {setTextFilter}
  showOnlyLatest={$filters.showOnlyLatest}
  {setShowOnlyLatest}
  canonicalKeywords={CANONICAL_KEYWORDS}
  count={$filteredData.length}
/>

<div class="viz-container">
  {#if $filteredData.length}
    {#key sketchKey}
      <P5 {sketch} style="position:absolute; top:0; left:0;" />
    {/key}
  {:else}
    <div class="empty-state">...</div>
  {/if}
</div>

<KeywordTooltip
  {hoveredText}
  {hoveredUrl}
  {tooltipX}
  {tooltipY}
  keywords={hoveredHitbox?.keywords || []}
  date={hoveredHitbox?.date || ""}
/>

<style>
  .controls {
    position: absolute;
    top: 1rem;
    left: 1rem;
    z-index: 10;
    color: #eee;
    background: #000;
    padding: 0.7rem 1rem;
    border-radius: 10px;
    display: flex;
    gap: 0.6rem 1rem;
    flex-wrap: wrap;
    align-items: center;
    box-shadow: 0 2px 24px #0005;
    font-size: 0.95rem;
  }
  .controls select,
  .controls input[type="text"] {
    background: #fff;
    color: #111;
    border: 1px solid #444;
    border-radius: 6px;
    padding: 0.2rem 0.5rem;
    font-size: inherit;
  }
  .controls .checkbox {
    display: inline-flex;
    gap: 0.4rem;
    align-items: center;
  }
  .controls .count {
    opacity: 0.8;
  }

  .viz-container {
    width: 100vw;
    height: 100vh;
    overflow: hidden;
    background: #000;
    cursor: cell;
  }
  .empty-state {
    color: #888;
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
  }
  :global(.viz-container canvas) {
    top: 0;
    left: 0;
    width: 100vw !important;
    height: 100vh !important;
    display: block;
    pointer-events: auto;
    z-index: 1;
    cursor: cell;
  }
  :global(canvas:not(#defaultCanvas0)) {
    display: none !important;
  }
</style>
