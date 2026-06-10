<script>
  import { onMount } from 'svelte';
  import * as d3 from 'd3';
  import subdivisionsGeo from '$lib/components/map/berlinBrandenburgSubdivisions.json';
  import streetsGeo from '$lib/components/map/berlinStreets.json';
  import { DEFAULT_CATEGORIES } from '../timeline-categorical/config.js';
  import { matchesCategory } from '../timeline-categorical/catTimeline.js';
  import { parseList } from '$lib/utils/parseList';
  import { translateDE_EN } from '$lib/utils/translate';

  // ── tile config ───────────────────────────────────────────────
  const BOUNDS     = { minLon: 13.088, maxLon: 13.761, minLat: 52.338, maxLat: 52.677 };
  const ZOOM       = 14;
  const TILE_SCALE = 256;
  const CELL_PX    = 75;
  const tileUrl    = (z, x, y) =>
    `https://tiles.codefor.de/berlin/geoportal/luftbilder/2025-dop20rgb/${z}/${x}/${y}.png`;

  // ── Mercator ──────────────────────────────────────────────────
  function tileFracX(lon) { return (lon + 180) / 360 * 2 ** ZOOM; }
  function tileFracY(lat) {
    const r = lat * Math.PI / 180;
    return (1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * 2 ** ZOOM;
  }

  const TX0 = Math.floor(tileFracX(BOUNDS.minLon));
  const TX1 = Math.floor(tileFracX(BOUNDS.maxLon));
  const TY0 = Math.floor(tileFracY(BOUNDS.maxLat));
  const TY1 = Math.floor(tileFracY(BOUNDS.minLat));
  const CW  = (TX1 - TX0 + 1) * TILE_SCALE;
  const CH  = (TY1 - TY0 + 1) * TILE_SCALE;

  function toCanvas(lon, lat) {
    return [
      (tileFracX(lon) - TX0) * TILE_SCALE,
      (tileFracY(lat) - TY0) * TILE_SCALE,
    ];
  }
  function cellKey(x, y) { return `${Math.floor(x / CELL_PX)},${Math.floor(y / CELL_PX)}`; }
  function cellRect(key) {
    const [cx, cy] = key.split(',').map(Number);
    return [cx * CELL_PX, cy * CELL_PX, CELL_PX, CELL_PX];
  }

  // ── districts ─────────────────────────────────────────────────
  const berlinFeatures = subdivisionsGeo.features.filter(f => f.properties?.region === 'Berlin');

  function pipRing(ring, lon, lat) {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i], [xj, yj] = ring[j];
      if (((yi > lat) !== (yj > lat)) && (lon < (xj - xi) * (lat - yi) / (yj - yi) + xi))
        inside = !inside;
    }
    return inside;
  }
  function inBerlin(lon, lat) {
    return berlinFeatures.some(f => {
      const g = f.geometry;
      if (g.type === 'Polygon') return pipRing(g.coordinates[0], lon, lat);
      if (g.type === 'MultiPolygon') return g.coordinates.some(p => pipRing(p[0], lon, lat));
      return false;
    });
  }
  const projection = d3.geoTransform({
    point(lon, lat) { const [x, y] = toCanvas(lon, lat); this.stream.point(x, y); },
  });
  const geoPath       = d3.geoPath(projection);
  const districtPaths = berlinFeatures.map(f => ({
    name:     f.properties.name,
    d:        geoPath(f),
    centroid: geoPath.centroid(f),
  }));
  const MAJOR_ROADS = new Set(['motorway','motorway_link','trunk','trunk_link','primary','primary_link','secondary','secondary_link','tertiary','tertiary_link']);
  const streetPaths = streetsGeo.features
    .filter(f => MAJOR_ROADS.has(f.properties?.highway))
    .map(f => geoPath(f)).filter(Boolean);

  // ── tile caching via Cache API ────────────────────────────────
  const CACHE_NAME = 'map-tiles-berlin-2025-v1';

  async function fetchTileCached(url) {
    try {
      if (!('caches' in window)) return url;
      const cache = await caches.open(CACHE_NAME);
      const hit = await cache.match(url);
      if (hit) return URL.createObjectURL(await hit.blob());
      const resp = await fetch(url, { mode: 'cors' });
      if (resp.ok) cache.put(url, resp.clone());
      return URL.createObjectURL(await resp.blob());
    } catch {
      return null;
    }
  }

  async function loadTile(octx, url, dx, dy) {
    const src = await fetchTileCached(url);
    if (!src) return;
    await new Promise(res => {
      const img = new Image();
      img.onload  = () => { octx.drawImage(img, dx, dy, TILE_SCALE, TILE_SCALE); if (src.startsWith('blob:')) URL.revokeObjectURL(src); res(null); };
      img.onerror = () => { if (src.startsWith('blob:')) URL.revokeObjectURL(src); res(null); };
      img.src = src;
    });
  }

  // ── categories ───────────────────────────────────────────────
  let categories = $state(DEFAULT_CATEGORIES.map(c => ({ ...c })));

  // ── state ─────────────────────────────────────────────────────
  let canvasEl     = $state(null);
  let viewportEl   = $state(null);
  let isPlaying    = $state(false);
  let progress     = $state(0);
  let currentDate  = $state('');
  let loaded       = $state(false);
  let tileProgress = $state(0);
  let zoomT        = $state(d3.zoomIdentity);

  let mapOffscreen  = null;
  let allEvents     = [];
  let cellEventsMap = new Map();
  let revealedCells = new Set();
  let eventIdx      = 0;
  let rafId         = null;
  let zoomBehavior  = null;

  // ── HD tile overlay ──────────────────────────────────────────
  let hdOverlayEl  = $state(/** @type {HTMLCanvasElement|null} */ (null));
  let hdRafId      = null;
  const hdCache    = new Map(); // url → ImageBitmap | null

  function renderHdOverlay() {
    const oc = hdOverlayEl;
    if (!oc || !loaded) return;
    const vw = window.innerWidth, vh = window.innerHeight;
    oc.width = vw; oc.height = vh;
    const ctx = oc.getContext('2d');
    if (!ctx) return;

    const k = zoomT.k;
    const targetZ = k >= 4 ? 16 : k >= 2 ? 15 : 0;
    if (!targetZ || !revealedCells.size) return;

    // clip to revealed cells only — never show the full map
    ctx.beginPath();
    for (const key of revealedCells) {
      const [rx, ry, rw, rh] = cellRect(key);
      ctx.rect(zoomT.x + rx * k, zoomT.y + ry * k, rw * k, rh * k);
    }
    ctx.clip();

    const scale = 2 ** (14 - targetZ); // main-canvas pixels per HD tile
    const screenTileSize = scale * TILE_SCALE * k;

    const canvasLeft   = -zoomT.x / k, canvasRight  = (vw - zoomT.x) / k;
    const canvasTop    = -zoomT.y / k, canvasBottom = (vh - zoomT.y) / k;

    const txMin = Math.floor((canvasLeft  / TILE_SCALE + TX0) / scale);
    const txMax = Math.floor((canvasRight / TILE_SCALE + TX0) / scale);
    const tyMin = Math.floor((canvasTop   / TILE_SCALE + TY0) / scale);
    const tyMax = Math.floor((canvasBottom/ TILE_SCALE + TY0) / scale);

    for (let ty = tyMin; ty <= tyMax; ty++) {
      for (let tx = txMin; tx <= txMax; tx++) {
        const screenX = zoomT.x + (tx * scale - TX0) * TILE_SCALE * k;
        const screenY = zoomT.y + (ty * scale - TY0) * TILE_SCALE * k;
        const url = tileUrl(targetZ, tx, ty);
        const bmp = hdCache.get(url);
        if (bmp === null) continue;
        if (bmp) {
          ctx.drawImage(bmp, screenX, screenY, screenTileSize, screenTileSize);
        } else {
          hdCache.set(url, null);
          fetchTileCached(url).then(async src => {
            if (!src) return;
            const img = new Image();
            img.src = src;
            try {
              await img.decode();
              const b = await createImageBitmap(img);
              hdCache.set(url, b);
            } catch { return; } finally {
              if (src.startsWith('blob:')) URL.revokeObjectURL(src);
            }
            if (hdOverlayEl) renderHdOverlay();
          });
        }
      }
    }
  }

  $effect(() => {
    void zoomT.x; void zoomT.y; void zoomT.k; void loaded;
    if (!hdOverlayEl) return;
    if (hdRafId) cancelAnimationFrame(hdRafId);
    hdRafId = requestAnimationFrame(renderHdOverlay);
  });

  // ── article panel ─────────────────────────────────────────────
  let selectedEvents = $state(/** @type {any[]} */ ([]));
  let panelLang      = $state('en');
  let translations   = $state(/** @type {Record<string,string>} */ ({}));

  $effect(() => {
    if (panelLang !== 'en' || !selectedEvents.length) return;
    for (const ev of selectedEvents) {
      const strings = [ev.title, ev.text.slice(0, 900)].filter(Boolean);
      for (const s of strings) {
        if (!(s in translations)) {
          translateDE_EN(s).then(t => { translations = { ...translations, [s]: t }; });
        }
      }
    }
  });

  function tr(s) { return panelLang === 'en' ? (translations[s] ?? s) : s; }

  const transformCss = $derived(`translate(${zoomT.x}px,${zoomT.y}px) scale(${zoomT.k})`);
  const enabledIds   = $derived(new Set(categories.filter(c => c.on).map(c => c.id)));

  // ── draw a single cell ────────────────────────────────────────
  function drawCell(ctx, key, ev) {
    if (revealedCells.has(key)) return;
    revealedCells.add(key);
    const [rx, ry, rw, rh] = cellRect(key);
    ctx.drawImage(mapOffscreen, rx, ry, rw, rh, rx, ry, rw, rh);
    if (ev.primaryCat) {
      ctx.globalAlpha = 0.28;
      ctx.fillStyle = ev.primaryCat.color;
      ctx.fillRect(rx, ry, rw, rh);
      ctx.globalAlpha = 1;
    }
  }

  // ── redraw with active category filter — no restart ───────────
  function redrawWithFilter() {
    const ctx = canvasEl?.getContext('2d');
    if (!ctx || !mapOffscreen) return;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, CW, CH);
    revealedCells.clear();
    for (let i = 0; i < eventIdx; i++) {
      const ev = allEvents[i];
      if (!ev.cats.some(c => enabledIds.has(c.id))) continue;
      const [cx, cy] = toCanvas(ev.lon, ev.lat);
      drawCell(ctx, cellKey(cx, cy), ev);
    }
  }

  // ── animation ────────────────────────────────────────────────
  function step() {
    if (!isPlaying) return;
    const ctx = canvasEl?.getContext('2d');
    if (!ctx || !mapOffscreen) return;
    for (let i = 0; i < 3 && eventIdx < allEvents.length; i++) {
      const ev = allEvents[eventIdx++];
      currentDate = ev.date;
      if (!ev.cats.some(c => enabledIds.has(c.id))) continue;
      const [cx, cy] = toCanvas(ev.lon, ev.lat);
      drawCell(ctx, cellKey(cx, cy), ev);
    }
    progress = allEvents.length ? eventIdx / allEvents.length : 0;
    if (eventIdx >= allEvents.length) { isPlaying = false; return; }
    rafId = requestAnimationFrame(step);
  }

  function play()   { if (isPlaying || !loaded || !mapOffscreen) return; isPlaying = true; rafId = requestAnimationFrame(step); }
  function pause()  { isPlaying = false; if (rafId) { cancelAnimationFrame(rafId); rafId = null; } }
  function toggle() { isPlaying ? pause() : play(); }

  function restart() {
    if (!loaded) return;
    pause();
    revealedCells.clear();
    eventIdx = 0; progress = 0; currentDate = '';
    if (canvasEl) { const ctx = canvasEl.getContext('2d'); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, CW, CH); }
    play();
  }

  function seekTo(ratio) {
    const wasPlaying = isPlaying;
    pause();
    revealedCells.clear();
    const ctx = canvasEl?.getContext('2d');
    if (ctx) { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, CW, CH); }
    eventIdx = Math.round(ratio * allEvents.length);
    if (ctx && mapOffscreen) {
      for (let i = 0; i < eventIdx; i++) {
        const ev = allEvents[i];
        if (!ev.cats.some(c => enabledIds.has(c.id))) continue;
        const [cx, cy] = toCanvas(ev.lon, ev.lat);
        drawCell(ctx, cellKey(cx, cy), ev);
      }
    }
    currentDate = allEvents[Math.max(0, eventIdx - 1)]?.date || '';
    progress = allEvents.length ? eventIdx / allEvents.length : 0;
    if (wasPlaying) play();
  }

  function toggleCat(id) {
    const cat = categories.find(c => c.id === id);
    if (cat) cat.on = !cat.on;
    if (loaded) redrawWithFilter();
  }

  // ── click → show article panel ───────────────────────────────
  let dragStart = null;
  function onPD(e) { dragStart = { x: e.clientX, y: e.clientY }; }
  function onPU(e) {
    if (!dragStart || !loaded) return;
    const moved = Math.hypot(e.clientX - dragStart.x, e.clientY - dragStart.y);
    dragStart = null;
    if (moved > 5) return;

    const rect = viewportEl.getBoundingClientRect();
    const cx = (e.clientX - rect.left - zoomT.x) / zoomT.k;
    const cy = (e.clientY - rect.top  - zoomT.y) / zoomT.k;
    const key = cellKey(cx, cy);
    if (!revealedCells.has(key)) return;

    const evs = (cellEventsMap.get(key) || []).filter(ev => ev.cats.some(c => enabledIds.has(c.id)));
    if (evs.length) selectedEvents = evs;
  }

  // ── zoom ─────────────────────────────────────────────────────
  function fitView() {
    if (!viewportEl || !zoomBehavior) return;
    const vw = viewportEl.clientWidth, vh = viewportEl.clientHeight;
    const k = Math.min(vw / CW, vh / CH) * 0.96;
    d3.select(viewportEl).call(
      zoomBehavior.transform,
      d3.zoomIdentity.translate((vw - CW*k)/2, (vh - CH*k)/2).scale(k)
    );
  }

  $effect(() => {
    if (!viewportEl || !loaded) return;
    zoomBehavior = d3.zoom().scaleExtent([0.05, 8]).on('zoom', e => { zoomT = e.transform; });
    d3.select(viewportEl).call(zoomBehavior);
    fitView();
    return () => d3.select(viewportEl).on('.zoom', null);
  });

  // ── init ─────────────────────────────────────────────────────
  onMount(async () => {
    const totalTiles = (TX1-TX0+1) * (TY1-TY0+1);
    let done = 0;

    const off = document.createElement('canvas');
    off.width = CW; off.height = CH;
    const octx = off.getContext('2d');
    octx.fillStyle = '#111';
    octx.fillRect(0, 0, CW, CH);

    const tileLoads = [];
    for (let ty = TY0; ty <= TY1; ty++) {
      for (let tx = TX0; tx <= TX1; tx++) {
        const dx = (tx - TX0) * TILE_SCALE, dy = (ty - TY0) * TILE_SCALE;
        tileLoads.push(
          loadTile(octx, tileUrl(ZOOM, tx, ty), dx, dy)
            .then(() => { tileProgress = ++done / totalTiles; })
        );
      }
    }

    const csvLoad = d3.csv('/geocoded_data.csv').then(rows => {
      allEvents = rows.map(r => {
        const lat = parseFloat(r.latitude), lon = parseFloat(r.longitude);
        if (!lat || !lon) return null;
        if (!inBerlin(lon, lat)) return null;
        const s = r.ExtractedDate || r.Date || '';
        const m = s.match(/(\d{2})\.(\d{2})\.(\d{4})/);
        if (!m) return null;
        const parsed     = { ...r, KeywordMatch: parseList(r.KeywordMatch) };
        const hay        = `${r.Title || ''} ${r.Text || ''}`.toLowerCase();
        const cats       = DEFAULT_CATEGORIES.filter(c => {
          if (matchesCategory(parsed, c)) return true;
          if (c.type === 'canonical' && Array.isArray(c.terms))
            return c.terms.some(t => hay.includes(t.toLowerCase()));
          return false;
        });
        const primaryCat = cats[0] || null;
        const ev = {
          lon, lat,
          date:  `${m[1]}.${m[2]}.${m[3]}`,
          ts:    new Date(+m[3], +m[2]-1, +m[1]).getTime(),
          url:   r.URL || '',
          title: r.Title || '',
          text:  r.Text  || '',
          cats, primaryCat,
        };
        const [cx, cy] = toCanvas(lon, lat);
        const key = cellKey(cx, cy);
        if (!cellEventsMap.has(key)) cellEventsMap.set(key, []);
        cellEventsMap.get(key).push(ev);
        return ev;
      }).filter(Boolean).sort((a, b) => a.ts - b.ts);
    });

    await Promise.all([Promise.all(tileLoads), csvLoad]);
    mapOffscreen = off;
    loaded = true;
    if (canvasEl) { const ctx = canvasEl.getContext('2d'); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, CW, CH); }
    play();
  });
</script>

<main>

  <!-- HD tile overlay: fixed, not inside CSS transform, drawn in screen space -->
  <canvas bind:this={hdOverlayEl} style="position:fixed;top:0;left:0;pointer-events:none;z-index:1;"></canvas>

  <!-- zoom/pan layer: d3.zoom is bound here, isolated from UI overlays -->
  <div class="map-layer" bind:this={viewportEl} onpointerdown={onPD} onpointerup={onPU}>
    <canvas
      bind:this={canvasEl}
      width={CW}
      height={CH}
      style="transform-origin:0 0; transform:{transformCss}; position:absolute; top:0; left:0;"
    ></canvas>

    <svg
      width={CW}
      height={CH}
      style="transform-origin:0 0; transform:{transformCss}; position:absolute; top:0; left:0; pointer-events:none; overflow:visible;"
    >
      {#each streetPaths as d}
        <path {d} fill="none" stroke="#222" stroke-width={(0.6/zoomT.k)} stroke-linecap="round" stroke-linejoin="round" />
      {/each}
      {#each districtPaths as dp}
        {#if dp.d}
          <path d={dp.d} fill="none" stroke="#222" stroke-width={(1/zoomT.k)} />
        {/if}
        {#if dp.centroid?.[0]}
          <text
            x={dp.centroid[0]} y={dp.centroid[1]}
            style="font-family: var(--font-mono)"
            font-size={(11/zoomT.k)}
            fill="rgba(255,255,255,0.8)"
            text-anchor="middle" dominant-baseline="middle"
            paint-order="stroke" stroke="#000" stroke-width={(4/zoomT.k)}
          >{dp.name}</text>
        {/if}
      {/each}
    </svg>
  </div>

  {#if !loaded}
    <div class="loading">
      <span>loading Berlin aerial 2025</span>
      <div class="tile-bar"><div class="tile-fill" style:width="{tileProgress*100}%"></div></div>
      <span class="tile-n">{Math.round(tileProgress*(TX1-TX0+1)*(TY1-TY0+1))} / {(TX1-TX0+1)*(TY1-TY0+1)} tiles</span>
    </div>
  {/if}

  {#if loaded}
    <div class="cat-bar">
      {#each categories as cat}
        {@const count = allEvents.filter(ev => ev.cats.some(c => c.id === cat.id)).length}
        <button
          class="chip"
          class:off={!cat.on}
          style:--cc={cat.color}
          onclick={() => toggleCat(cat.id)}
          title="{cat.label} — {count}"
        >{cat.label}<span class="chip-n">{count}</span></button>
      {/each}
    </div>
  {/if}

  <div class="hud">
    <span class="date">{currentDate || '—'}</span>
    <button onclick={toggle}  disabled={!loaded}>{isPlaying ? '⏸' : '▶'}</button>
    <button onclick={restart} disabled={!loaded}>↺</button>
    <button onclick={fitView} disabled={!loaded}>fit</button>
    <input
      class="scrubber"
      type="range" min="0" max="1" step="0.001"
      value={progress}
      disabled={!loaded}
      oninput={e => seekTo(parseFloat(/** @type {HTMLInputElement} */(e.target).value))}
    />
    <span class="pct">{Math.round(progress*100)}%</span>
  </div>

  {#if selectedEvents.length}
    <aside class="article-panel">
      <div class="panel-header">
        <div class="lang-toggle">
          <button class:active={panelLang === 'de'} onclick={() => panelLang = 'de'}>DE</button>
          <button class:active={panelLang === 'en'} onclick={() => panelLang = 'en'}>EN</button>
        </div>
        <button class="panel-close" onclick={() => selectedEvents = []}>✕</button>
      </div>

      {#each selectedEvents as ev}
        {@const catColor = ev.primaryCat?.color ?? '#888'}
        <div class="article-card">
          <div class="article-meta">
            <span class="article-date">{ev.date}</span>
            <span class="article-cat" style:background={catColor}>{ev.primaryCat?.label ?? ''}</span>
          </div>
          <p class="article-title">{tr(ev.title)}</p>
          {#if ev.text}
            <p class="article-text">{tr(ev.text.slice(0, 900))}{ev.text.length > 900 ? '…' : ''}</p>
          {/if}
          {#if ev.url}
            <a class="article-link" href={ev.url} target="_blank" rel="noreferrer">source ↗</a>
          {/if}
        </div>
      {/each}
    </aside>
  {/if}

</main>

<style>
  :global(body) { margin: 0; background: #000; overflow: hidden; }

  main {
    width: 100vw;
    height: 100vh;
    position: relative;
    overflow: hidden;
  }

  .map-layer {
    position: absolute;
    inset: 0;
    overflow: hidden;
    cursor: crosshair;
  }
  canvas { display: block; }

  .loading {
    position: fixed; inset: 0;
    display: flex; flex-direction: column;
    align-items: center; justify-content: center; gap: 12px;
    color: rgba(255,255,255,0.45);
    font-family: var(--font-mono); font-size: 12px;
    pointer-events: none; z-index: 20;
  }
  .tile-bar  { width: 200px; height: 2px; background: rgba(255,255,255,0.1); }
  .tile-fill { height: 100%; background: rgba(255,255,255,0.45); transition: width 60ms; }
  .tile-n    { font-size: 10px; opacity: 0.4; }

  .cat-bar {
    position: fixed; top: 12px; left: 50%; transform: translateX(-50%);
    display: flex; flex-wrap: wrap; gap: 5px;
    z-index: 10; max-width: 95vw; justify-content: center;
  }
  .chip {
    background: var(--cc); border: none; cursor: pointer;
    font-family: var(--font-mono); font-size: 9px;
    padding: 3px 7px; color: #111;
    display: flex; align-items: center; gap: 4px;
    transition: opacity 0.12s;
  }
  .chip.off { opacity: 0.18; }
  .chip:hover { opacity: 0.8 !important; }
  .chip-n { font-size: 8px; opacity: 0.55; }

  .hud {
    position: fixed; bottom: 16px; left: 50%; transform: translateX(-50%);
    display: flex; align-items: center; gap: 10px;
    color: #fff; font-family: var(--font-mono); font-size: 12px;
    background: rgba(0,0,0,0.72); padding: 7px 14px;
    border: 1px solid rgba(255,255,255,0.1);
    white-space: nowrap; z-index: 10;
  }
  .date { min-width: 72px; opacity: 0.6; }
  .pct  { font-size: 10px; opacity: 0.4; min-width: 28px; text-align: right; }

  button {
    background: none; border: 1px solid rgba(255,255,255,0.18);
    color: inherit; font-family: inherit; font-size: 12px;
    cursor: pointer; padding: 2px 8px; line-height: 1.4;
  }
  button:hover:not(:disabled) { background: rgba(255,255,255,0.08); }
  button:disabled { opacity: 0.25; cursor: default; }

  .scrubber {
    width: 220px; accent-color: rgba(255,255,255,0.5); cursor: pointer;
  }
  .scrubber:disabled { opacity: 0.25; cursor: default; }

  /* ── article panel ──────────────────────────────────────────── */
  .article-panel {
    position: fixed; right: 0; top: 0; bottom: 0;
    width: 300px;
    background: rgba(8,8,8,0.94);
    border-left: 1px solid rgba(255,255,255,0.1);
    display: flex; flex-direction: column;
    overflow-y: auto;
    z-index: 20;
    font-family: var(--font-mono);
  }

  .panel-header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 10px 12px 8px;
    border-bottom: 1px solid rgba(255,255,255,0.08);
    position: sticky; top: 0;
    background: rgba(8,8,8,0.97);
    flex-shrink: 0;
  }

  .lang-toggle { display: flex; gap: 4px; }
  .lang-toggle button {
    font-size: 10px; padding: 2px 7px;
    border-color: rgba(255,255,255,0.15);
    color: rgba(255,255,255,0.4);
  }
  .lang-toggle button.active {
    background: rgba(255,255,255,0.12);
    color: rgba(255,255,255,0.9);
    border-color: rgba(255,255,255,0.3);
  }

  .panel-close {
    background: none; border: none;
    color: rgba(255,255,255,0.3); font-size: 14px;
    cursor: pointer; padding: 2px 6px; line-height: 1;
  }
  .panel-close:hover { color: rgba(255,255,255,0.8); }

  .article-card {
    padding: 14px 12px;
    border-bottom: 1px solid rgba(255,255,255,0.06);
  }
  .article-card:last-child { border-bottom: none; }

  .article-meta {
    display: flex; align-items: center; gap: 7px; margin-bottom: 7px;
  }
  .article-date { font-size: 9px; color: rgba(255,255,255,0.35); letter-spacing: 0.05em; }
  .article-cat  { font-size: 8px; padding: 1px 5px; color: #111; }

  .article-title {
    font-size: 11px; color: rgba(255,255,255,0.85);
    line-height: 1.5; margin: 0 0 8px;
  }
  .article-text {
    font-size: 10px; color: rgba(255,255,255,0.45);
    line-height: 1.6; margin: 0 0 10px;
  }
  .article-link {
    font-size: 9px; color: rgba(255,255,255,0.35);
    text-decoration: none; letter-spacing: 0.05em;
  }
  .article-link:hover { color: rgba(255,255,255,0.7); }
</style>
