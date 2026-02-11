import statesGeo from "./berlinBrandenburg.json";
import subdivisionsGeo from "./berlinBrandenburgSubdivisions.json";

export const REGION_BOUNDS = {
  all: [
    [9.8, 50.6],
    [16.4, 54.3],
  ],
  Berlin: [
    [13.2, 52.41],
    [13.57, 52.57],
  ],
  Brandenburg: [
    [11.45, 51.45],
    [14.6, 53.45],
  ],
};

function ringBounds(ring) {
  let minLon = Infinity;
  let minLat = Infinity;
  let maxLon = -Infinity;
  let maxLat = -Infinity;
  for (const pt of ring || []) {
    const lon = Number(pt?.[0]);
    const lat = Number(pt?.[1]);
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) continue;
    minLon = Math.min(minLon, lon);
    minLat = Math.min(minLat, lat);
    maxLon = Math.max(maxLon, lon);
    maxLat = Math.max(maxLat, lat);
  }
  if (!Number.isFinite(minLon) || !Number.isFinite(minLat)) return null;
  return [
    [minLon, minLat],
    [maxLon, maxLat],
  ];
}

function mergeBounds(a, b) {
  if (!a) return b || null;
  if (!b) return a || null;
  return [
    [Math.min(a[0][0], b[0][0]), Math.min(a[0][1], b[0][1])],
    [Math.max(a[1][0], b[1][0]), Math.max(a[1][1], b[1][1])],
  ];
}

function boundsFromRings(rings) {
  let acc = null;
  for (const ring of rings || []) {
    acc = mergeBounds(acc, ringBounds(ring));
  }
  return acc;
}

function geometryToOuterRings(geometry) {
  if (!geometry || !Array.isArray(geometry.coordinates)) return [];
  if (geometry.type === "Polygon") {
    const outer = geometry.coordinates[0];
    return Array.isArray(outer) ? [outer] : [];
  }
  if (geometry.type === "MultiPolygon") {
    return geometry.coordinates
      .map((poly) => poly?.[0])
      .filter((outer) => Array.isArray(outer));
  }
  return [];
}

function bboxPolygon(bounds) {
  const [[minLon, minLat], [maxLon, maxLat]] = bounds;
  return [
    [minLon, minLat],
    [maxLon, minLat],
    [maxLon, maxLat],
    [minLon, maxLat],
    [minLon, minLat],
  ];
}

const BASE_OUTLINES = (() => {
  const features = Array.isArray(statesGeo?.features) ? statesGeo.features : [];
  const byName = new Map(
    features
      .map((f) => [
        String(f?.properties?.name || ""),
        geometryToOuterRings(f?.geometry),
      ])
      .filter(([name, rings]) => name && rings.length > 0),
  );

  const berlin = byName.get("Berlin") || [bboxPolygon(REGION_BOUNDS.Berlin)];
  const brandenburg = byName.get("Brandenburg") || [
    bboxPolygon(REGION_BOUNDS.Brandenburg),
  ];

  return {
    Berlin: berlin,
    Brandenburg: brandenburg,
    all: [...brandenburg, ...berlin],
  };
})();

const BASE_SUBDIVISIONS = (() => {
  const byRegion = { Berlin: [], Brandenburg: [] };
  for (const f of subdivisionsGeo?.features || []) {
    const region = String(f?.properties?.region || "");
    if (!(region in byRegion)) continue;
    const rings = geometryToOuterRings(f?.geometry);
    if (rings.length === 0) continue;
    byRegion[region].push(...rings);
  }
  return {
    Berlin: byRegion.Berlin,
    Brandenburg: byRegion.Brandenburg,
    all: [...byRegion.Brandenburg, ...byRegion.Berlin],
  };
})();

function pickBounds(regionFilter, outlines) {
  const key = regionFilter in REGION_BOUNDS ? regionFilter : "all";
  const rings = outlines?.[key];
  return boundsFromRings(rings) || REGION_BOUNDS[key] || REGION_BOUNDS.all;
}

export function createRegionProjector({
  regionFilter = "all",
  width,
  height,
  padding = 20,
  outlines,
}) {
  const bounds = pickBounds(regionFilter, outlines || BASE_OUTLINES);
  const [[minLon, minLat], [maxLon, maxLat]] = bounds;
  const w = Math.max(1, Number(width) || 1);
  const h = Math.max(1, Number(height) || 1);
  const p = Math.max(0, Number(padding) || 0);
  const innerW = Math.max(1, w - p * 2);
  const innerH = Math.max(1, h - p * 2);
  const lonSpan = Math.max(1e-6, maxLon - minLon);
  const latSpan = Math.max(1e-6, maxLat - minLat);
  const scale = Math.min(innerW / lonSpan, innerH / latSpan);
  const usedW = lonSpan * scale;
  const usedH = latSpan * scale;
  const left = (w - usedW) / 2;
  const top = (h - usedH) / 2;

  return (lon, lat) => ({
    x: left + (lon - minLon) * scale,
    y: top + (maxLat - lat) * scale,
  });
}

function samePoint(a, b) {
  return (
    Math.abs(Number(a?.[0]) - Number(b?.[0])) < 1e-9 &&
    Math.abs(Number(a?.[1]) - Number(b?.[1])) < 1e-9
  );
}

function pointKey(pt) {
  return `${Number(pt[0]).toFixed(6)},${Number(pt[1]).toFixed(6)}`;
}

function edgeKey(a, b) {
  const ka = pointKey(a);
  const kb = pointKey(b);
  return ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
}

function pushEdge(map, a, b) {
  if (
    !Number.isFinite(Number(a?.[0])) ||
    !Number.isFinite(Number(a?.[1])) ||
    !Number.isFinite(Number(b?.[0])) ||
    !Number.isFinite(Number(b?.[1]))
  ) {
    return;
  }
  if (samePoint(a, b)) return;
  const key = edgeKey(a, b);
  const found = map.get(key);
  if (found) {
    found.count += 1;
    return;
  }
  map.set(key, { a: [Number(a[0]), Number(a[1])], b: [Number(b[0]), Number(b[1])], count: 1 });
}

function buildEdgeMap(rings) {
  const map = new Map();
  for (const ring of rings || []) {
    if (!Array.isArray(ring) || ring.length < 2) continue;
    for (let i = 1; i < ring.length; i++) {
      pushEdge(map, ring[i - 1], ring[i]);
    }
    if (!samePoint(ring[0], ring[ring.length - 1])) {
      pushEdge(map, ring[ring.length - 1], ring[0]);
    }
  }
  return map;
}

function edgeMapToList(map, minCount = 1, maxCount = Infinity) {
  const out = [];
  for (const item of map.values()) {
    if (item.count < minCount || item.count > maxCount) continue;
    out.push({ a: item.a, b: item.b });
  }
  return out;
}

const SUBDIVISION_EDGES = (() => {
  const berlinMap = buildEdgeMap(BASE_SUBDIVISIONS.Berlin);
  const brandenburgMap = buildEdgeMap(BASE_SUBDIVISIONS.Brandenburg);
  return {
    Berlin: {
      all: edgeMapToList(berlinMap),
      internal: edgeMapToList(berlinMap, 2),
    },
    Brandenburg: {
      all: edgeMapToList(brandenburgMap),
    },
  };
})();

const PROJECTED_EDGE_CACHE = new WeakMap();

function regionEdges(regionFilter) {
  if (regionFilter === "all") {
    return [
      ...SUBDIVISION_EDGES.Brandenburg.all,
      ...SUBDIVISION_EDGES.Berlin.internal,
    ];
  }
  if (regionFilter === "Berlin") return SUBDIVISION_EDGES.Berlin.all;
  if (regionFilter === "Brandenburg") return SUBDIVISION_EDGES.Brandenburg.all;
  return [];
}

function getProjectedEdges(project, regionFilter) {
  const key = regionFilter === "Berlin" || regionFilter === "Brandenburg"
    ? regionFilter
    : "all";
  let byRegion = PROJECTED_EDGE_CACHE.get(project);
  if (!byRegion) {
    byRegion = new Map();
    PROJECTED_EDGE_CACHE.set(project, byRegion);
  }
  if (byRegion.has(key)) return byRegion.get(key);

  const projected = regionEdges(key).map((e) => {
    const a = project(e.a[0], e.a[1]);
    const b = project(e.b[0], e.b[1]);
    return [a.x, a.y, b.x, b.y];
  });
  byRegion.set(key, projected);
  return projected;
}

export function drawRegionOutlines(p, { project, regionFilter = "all" }) {
  p.push();
  p.noFill();
  p.strokeJoin(p.ROUND);
  p.strokeCap(p.ROUND);
  p.stroke("#333");
  p.strokeWeight(0.72);

  const projected = getProjectedEdges(project, regionFilter);
  for (let i = 0; i < projected.length; i++) {
    const e = projected[i];
    p.line(e[0], e[1], e[2], e[3]);
  }

  p.pop();
}
