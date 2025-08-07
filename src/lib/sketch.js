import { shortenAroundKeyword } from "$lib/utils/textUtils.js";

export default function createSketch(data, growthParams, growthMode, setTooltip) {
  return (p) => {
    // Sketch logic setup
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
      globalBuckets = new Map(),
      letterHitboxes = [],
      firstDraw = true;

    // Inner helper functions
    const setupBranches = (data, w, h) => {
      // Set up branch logic...
    };

    const growBranch = (br, tip) => {
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
    };

    const screenToWorld = (sx, sy) => ({
      x: (sx - p.width / 2) / zoom - pan.x + bufferCenter.x,
      y: (sy - p.height / 2) / zoom - pan.y + bufferCenter.y,
    });

    const worldToScreen = (wx, wy) => ({
      x: (wx - bufferCenter.x + pan.x) * zoom + p.width / 2,
      y: (wy - bufferCenter.y + pan.y) * zoom + p.height / 2,
    });

    // P5 lifecycle
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
      // Drawing logic for each frame
    };

    p.mouseMoved = () => {
      const { x: wx, y: wy } = screenToWorld(p.mouseX, p.mouseY);
      for (let hit of letterHitboxes) {
        if (p.dist(wx, wy, hit.worldX, hit.worldY) < hit.radius) {
          const { x, y } = worldToScreen(hit.worldX, hit.worldY);
          setTooltip(hit.text, hit.url, x, y - 22, hit.keywords, hit.date);
          return;
        }
      }
      setTooltip("", "", 0, 0, []);
    };

    p.mousePressed = () => {
      dragging = true;
      lastX = p.mouseX;
      lastY = p.mouseY;
    };

    p.mouseDragged = () => {
      if (!dragging) return;
      const dx = (p.mouseX - lastX) / zoom;
      const dy = (p.mouseY - lastY) / zoom;
      pan.x += dx;
      pan.y += dy;
      lastX = p.mouseX;
      lastY = p.mouseY;
    };

    p.mouseReleased = () => {
      dragging = false;
    };

    p.mouseWheel = (e) => {
      const factor = e.deltaY < 0 ? 1.05 : 1 / 1.05;
      zoom = p.constrain(zoom * factor, 0.5, 2);
      return false;
    };

    p.windowResized = () => {
      p.resizeCanvas(window.innerWidth, window.innerHeight);
    };
  };
}
