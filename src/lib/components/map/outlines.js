import statesGeo from "./berlinBrandenburg.json";
import subdivisionsGeo from "./berlinBrandenburgSubdivisions.json";
import berlinStreetsGeo from "./berlinStreets.json";
import * as d3 from "d3";

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
  const byDistrict = new Map();
  const districtNames = [];

  for (const f of subdivisionsGeo?.features || []) {
    const region = String(f?.properties?.region || "");
    if (!(region in byRegion)) continue;
    const rings = geometryToOuterRings(f?.geometry);
    if (rings.length === 0) continue;
    byRegion[region].push(...rings);
    if (region !== "Berlin") continue;

    const district = String(f?.properties?.name || "").trim();
    if (!district) continue;
    if (!byDistrict.has(district)) {
      byDistrict.set(district, []);
      districtNames.push(district);
    }
    byDistrict.get(district).push(...rings);
  }

  return {
    Berlin: byRegion.Berlin,
    Brandenburg: byRegion.Brandenburg,
    all: [...byRegion.Brandenburg, ...byRegion.Berlin],
    districtNames,
    byDistrict,
  };
})();

export const BERLIN_DISTRICTS = Object.freeze([
  ...BASE_SUBDIVISIONS.districtNames,
]);

const DISTRICT_BOUNDS = (() => {
  const out = new Map();
  for (const district of BERLIN_DISTRICTS) {
    out.set(
      district,
      boundsFromRings(BASE_SUBDIVISIONS.byDistrict.get(district)),
    );
  }
  return out;
})();

function normalizeRegionFilter(regionFilter) {
  return regionFilter === "Berlin" || regionFilter === "Brandenburg"
    ? regionFilter
    : "all";
}

function normalizeDistrictFilter(regionFilter, districtFilter) {
  if (regionFilter !== "Berlin") return "";
  const district = String(districtFilter || "");
  return BASE_SUBDIVISIONS.byDistrict.has(district) ? district : "";
}

function resolveView(regionFilter = "all", districtFilter = "") {
  const region = normalizeRegionFilter(regionFilter);
  const district = normalizeDistrictFilter(region, districtFilter);
  return {
    region,
    district,
    key: district ? `Berlin:${district}` : region,
  };
}

function pickBounds(regionFilter, districtFilter, outlines) {
  const { region, district } = resolveView(regionFilter, districtFilter);
  if (district) {
    return DISTRICT_BOUNDS.get(district) || REGION_BOUNDS.Berlin;
  }
  const rings = outlines?.[region];
  return boundsFromRings(rings) || REGION_BOUNDS[region] || REGION_BOUNDS.all;
}

function ringsToFeature(rings, fallbackBounds) {
  const valid = (rings || []).filter(
    (ring) => Array.isArray(ring) && ring.length >= 4,
  );
  if (valid.length > 0) {
    return {
      type: "Feature",
      properties: {},
      geometry: {
        type: "MultiLineString",
        coordinates: valid,
      },
    };
  }
  const fallbackRing = bboxPolygon(fallbackBounds);
  return {
    type: "Feature",
    properties: {},
    geometry: {
      type: "LineString",
      coordinates: fallbackRing,
    },
  };
}

function viewRings(regionFilter, districtFilter, outlines) {
  const { region, district } = resolveView(regionFilter, districtFilter);
  if (district) return BASE_SUBDIVISIONS.byDistrict.get(district) || [];
  return outlines?.[region] || [];
}

export function createRegionProjector({
  regionFilter = "all",
  districtFilter = "",
  width,
  height,
  padding = 20,
  paddingX,
  paddingY,
  outlines,
}) {
  const w = Math.max(1, Number(width) || 1);
  const h = Math.max(1, Number(height) || 1);
  const p = Math.max(0, Number(padding) || 0);
  const px = Number.isFinite(Number(paddingX))
    ? Math.max(0, Number(paddingX))
    : p;
  const py = Number.isFinite(Number(paddingY))
    ? Math.max(0, Number(paddingY))
    : p;
  const bounds = pickBounds(
    regionFilter,
    districtFilter,
    outlines || BASE_OUTLINES,
  );
  const rings = viewRings(
    regionFilter,
    districtFilter,
    outlines || BASE_OUTLINES,
  );
  const feature = ringsToFeature(rings, bounds);
  const projection = d3.geoMercator();
  projection.fitExtent(
    [
      [px, py],
      [w - px, h - py],
    ],
    feature,
  );

  return (lon, lat) => {
    const xy = projection([Number(lon), Number(lat)]);
    if (!xy) return { x: -1e6, y: -1e6 };
    return {
      x: xy[0],
      y: xy[1],
    };
  };
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
  map.set(key, {
    a: [Number(a[0]), Number(a[1])],
    b: [Number(b[0]), Number(b[1])],
    count: 1,
  });
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
  const district = new Map();
  for (const name of BERLIN_DISTRICTS) {
    const districtMap = buildEdgeMap(BASE_SUBDIVISIONS.byDistrict.get(name));
    district.set(name, edgeMapToList(districtMap));
  }
  return {
    Berlin: {
      all: edgeMapToList(berlinMap),
      internal: edgeMapToList(berlinMap, 2),
    },
    Brandenburg: {
      all: edgeMapToList(brandenburgMap),
    },
    district,
  };
})();

function viewEdges(viewKey) {
  if (viewKey === "all") {
    return [
      ...SUBDIVISION_EDGES.Brandenburg.all,
      ...SUBDIVISION_EDGES.Berlin.internal,
    ];
  }
  if (viewKey === "Berlin") return SUBDIVISION_EDGES.Berlin.all;
  if (viewKey === "Brandenburg") return SUBDIVISION_EDGES.Brandenburg.all;
  if (viewKey.startsWith("Berlin:")) {
    const district = viewKey.slice("Berlin:".length);
    return SUBDIVISION_EDGES.district.get(district) || [];
  }
  return [];
}

const PROJECTED_EDGE_CACHE = new WeakMap();

function getProjectedEdges(project, viewKey) {
  let byView = PROJECTED_EDGE_CACHE.get(project);
  if (!byView) {
    byView = new Map();
    PROJECTED_EDGE_CACHE.set(project, byView);
  }
  if (byView.has(viewKey)) return byView.get(viewKey);

  const projected = viewEdges(viewKey).map((e) => {
    const a = project(e.a[0], e.a[1]);
    const b = project(e.b[0], e.b[1]);
    return [a.x, a.y, b.x, b.y];
  });
  byView.set(viewKey, projected);
  return projected;
}

const BASE_BERLIN_STREETS = (() => {
  const out = [];
  for (const f of berlinStreetsGeo?.features || []) {
    const c = f?.geometry?.coordinates;
    if (!Array.isArray(c) || c.length < 2) continue;
    const coords = c.filter(
      (pt) =>
        Number.isFinite(Number(pt?.[0])) && Number.isFinite(Number(pt?.[1])),
    );
    if (coords.length < 2) continue;
    out.push({ coords, bounds: ringBounds(coords) });
  }
  return out;
})();

const BASE_BERLIN_STREET_COORDS = BASE_BERLIN_STREETS.map((x) => x.coords);
const STREET_CLIP_CACHE = new Map();

function pointInRing(lon, lat, ring) {
  if (!Array.isArray(ring) || ring.length < 3) return false;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = Number(ring[i][0]);
    const yi = Number(ring[i][1]);
    const xj = Number(ring[j][0]);
    const yj = Number(ring[j][1]);
    if (!Number.isFinite(xi) || !Number.isFinite(yi)) continue;
    if (!Number.isFinite(xj) || !Number.isFinite(yj)) continue;
    const crosses = yi > lat !== yj > lat;
    if (!crosses) continue;
    const atLon = ((xj - xi) * (lat - yi)) / (yj - yi + 1e-12) + xi;
    if (lon < atLon) inside = !inside;
  }
  return inside;
}

function pointInRings(lon, lat, rings) {
  for (const ring of rings || []) {
    if (pointInRing(lon, lat, ring)) return true;
  }
  return false;
}

function boundsIntersect(a, b) {
  if (!a || !b) return true;
  return !(
    a[1][0] < b[0][0] ||
    a[0][0] > b[1][0] ||
    a[1][1] < b[0][1] ||
    a[0][1] > b[1][1]
  );
}

function clipLineToRings(coords, rings) {
  if (!Array.isArray(coords) || coords.length < 2 || !Array.isArray(rings)) {
    return [];
  }
  const out = [];
  let current = [];
  const step = 0.0004;

  for (let i = 1; i < coords.length; i++) {
    const a = coords[i - 1];
    const b = coords[i];
    const ax = Number(a[0]);
    const ay = Number(a[1]);
    const bx = Number(b[0]);
    const by = Number(b[1]);
    if (
      !Number.isFinite(ax) ||
      !Number.isFinite(ay) ||
      !Number.isFinite(bx) ||
      !Number.isFinite(by)
    ) {
      if (current.length > 1) out.push(current);
      current = [];
      continue;
    }

    const dx = bx - ax;
    const dy = by - ay;
    const slices = Math.max(
      1,
      Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / step),
    );

    for (let s = 0; s <= slices; s++) {
      const t = s / slices;
      const lon = ax + dx * t;
      const lat = ay + dy * t;
      if (pointInRings(lon, lat, rings)) {
        const pt = [lon, lat];
        if (!current.length || !samePoint(current[current.length - 1], pt)) {
          current.push(pt);
        }
      } else if (current.length > 1) {
        out.push(current);
        current = [];
      } else {
        current = [];
      }
    }
  }

  if (current.length > 1) out.push(current);
  return out;
}

function streetLinesForView(viewKey) {
  if (viewKey === "all" || viewKey === "Brandenburg") return [];
  if (viewKey === "Berlin") return BASE_BERLIN_STREET_COORDS;
  if (!viewKey.startsWith("Berlin:")) return [];

  if (STREET_CLIP_CACHE.has(viewKey)) return STREET_CLIP_CACHE.get(viewKey);

  const district = viewKey.slice("Berlin:".length);
  const rings = BASE_SUBDIVISIONS.byDistrict.get(district) || [];
  const districtBounds = DISTRICT_BOUNDS.get(district);
  const clipped = [];
  for (const line of BASE_BERLIN_STREETS) {
    if (!boundsIntersect(line.bounds, districtBounds)) continue;
    clipped.push(...clipLineToRings(line.coords, rings));
  }
  STREET_CLIP_CACHE.set(viewKey, clipped);
  return clipped;
}

const PROJECTED_STREET_CACHE = new WeakMap();

function getProjectedStreets(project, viewKey) {
  let byView = PROJECTED_STREET_CACHE.get(project);
  if (!byView) {
    byView = new Map();
    PROJECTED_STREET_CACHE.set(project, byView);
  }
  if (byView.has(viewKey)) return byView.get(viewKey);

  const projected = streetLinesForView(viewKey).map((line) =>
    line.map((pt) => {
      const p = project(pt[0], pt[1]);
      return [p.x, p.y];
    }),
  );
  byView.set(viewKey, projected);
  return projected;
}

export function isPointInBerlinDistrict(lon, lat, districtName) {
  const district = String(districtName || "");
  const rings = BASE_SUBDIVISIONS.byDistrict.get(district);
  if (!rings || !rings.length) return false;
  if (!Number.isFinite(Number(lon)) || !Number.isFinite(Number(lat)))
    return false;
  return pointInRings(Number(lon), Number(lat), rings);
}

export function findBerlinDistrict(lon, lat) {
  const x = Number(lon);
  const y = Number(lat);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return "";
  for (let i = 0; i < BERLIN_DISTRICTS.length; i++) {
    const district = BERLIN_DISTRICTS[i];
    const rings = BASE_SUBDIVISIONS.byDistrict.get(district);
    if (rings && pointInRings(x, y, rings)) return district;
  }
  return "";
}

export function classifyMapRegion(lon, lat) {
  const x = Number(lon);
  const y = Number(lat);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return "";
  if (pointInRings(x, y, BASE_OUTLINES.Berlin)) return "Berlin";
  if (pointInRings(x, y, BASE_OUTLINES.Brandenburg)) return "Brandenburg";
  return "";
}

export function drawRegionStreets(
  p,
  { project, regionFilter = "all", districtFilter = "" },
) {
  const { key } = resolveView(regionFilter, districtFilter);
  const projected = getProjectedStreets(project, key);
  if (!projected.length) return;

  p.push();
  p.noFill();
  p.strokeJoin(p.ROUND);
  p.strokeCap(p.ROUND);
  p.stroke("#444");
  p.strokeWeight(key.startsWith("Berlin:") ? 0.62 : 0.42);

  for (let i = 0; i < projected.length; i++) {
    const line = projected[i];
    for (let j = 1; j < line.length; j++) {
      p.line(line[j - 1][0], line[j - 1][1], line[j][0], line[j][1]);
    }
  }

  p.pop();
}

export function drawRegionOutlines(
  p,
  { project, regionFilter = "all", districtFilter = "" },
) {
  const { key } = resolveView(regionFilter, districtFilter);
  p.push();
  p.noFill();
  p.strokeJoin(p.ROUND);
  p.strokeCap(p.ROUND);
  p.stroke("white");
  p.strokeWeight(0.5);

  const projected = getProjectedEdges(project, key);
  for (let i = 0; i < projected.length; i++) {
    const e = projected[i];
    p.line(e[0], e[1], e[2], e[3]);
  }

  p.pop();
}
