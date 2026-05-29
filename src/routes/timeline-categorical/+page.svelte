<script>
  import { onMount } from "svelte";
  import * as d3 from "d3";
  import { articles } from "$lib/stores";
  import { loadArticles } from "$lib/utils/loadArticles";
  import { parseDateLoose } from "$lib/utils/parseDate";
  import { keywordsGroup } from "$lib/constants/keywords";
  import { detectRegion } from "$lib/utils/detectRegion";

  // ── layout constants ──────────────────────────────────────────
  const FONT       = "Courier, monospace";
  const FS         = 10;
  const CHAR_W     = FS * 0.601;
  const LINE_H     = 13;
  const MAX_CHARS  = 36;
  const AXIS_H     = 50;
  const TOP_PAD    = 16;
  const H_PAD      = 20;
  const PX_PER_DAY = 5;

  const CAT_COLORS = ["#c00","#00c","#070","#e07000","#7000b0","#007b7b","#a00060","#444"];

  // ── categories ────────────────────────────────────────────────
  let categories = $state([
    { id: "antisem",    label: "Antisemitismus",       type: "canonical", query: "antisemitismus",           on: true  },
    { id: "rechts",     label: "Rechtsextremismus",     type: "canonical", query: "rechtsextremismus",        on: true  },
    { id: "fremd",      label: "Fremdenfeindlichkeit",  type: "canonical", query: "fremdenfeindlichkeit",     on: false },
    { id: "islam",      label: "Islamfeindlichkeit",    type: "canonical", query: "islamfeindlichkeit",       on: false },
    { id: "vv",         label: "Volksverhetzung",       type: "canonical", query: "volksverhetzung",          on: false },
    { id: "queer",      label: "Queerfeindlichkeit",    type: "canonical", query: "queerfeindlichkeit",       on: false },
    { id: "frauen",     label: "Frauen / Mädchen",      type: "text",      query: "frau,frauen,mädchen",      on: false },
    { id: "palaestina", label: "Palästina / Palestine", type: "text",      query: "palästina,palestine,gaza", on: false },
  ]);

  // ── filter state ──────────────────────────────────────────────
  let showBerlin      = $state(false);
  let showBrandenburg = $state(false);
  let reversed        = $state(false);

  // ── panel ─────────────────────────────────────────────────────
  let newLabel  = $state("");
  let newQuery  = $state("");
  let newType   = $state("text");
  let panelOpen = $state(true);

  function addCategory() {
    if (!newLabel.trim() || !newQuery.trim()) return;
    categories = [...categories, {
      id: crypto.randomUUID(),
      label: newLabel.trim(), type: newType,
      query: newQuery.trim(), on: true,
    }];
    newLabel = ""; newQuery = "";
  }
  function removeCategory(id) { categories = categories.filter(c => c.id !== id); }

  // ── region filter ─────────────────────────────────────────────
  function passesRegion(a) {
    if (!showBerlin && !showBrandenburg) return true;
    const r = detectRegion(a);
    if (showBerlin      && r === "Berlin")      return true;
    if (showBrandenburg && r === "Brandenburg") return true;
    return false;
  }

  // ── keyword matching ──────────────────────────────────────────
  function matchesCategory(a, cat) {
    if (cat.type === "canonical") {
      const kws = Array.isArray(a.KeywordMatch) ? a.KeywordMatch : [];
      return kws.some(k => /** @type {any} */ (keywordsGroup)[String(k).toLowerCase()] === cat.query);
    }
    const hay = `${a.Title || ""} ${a.Text || ""}`.toLowerCase();
    return cat.query.split(",").map(s => s.trim().toLowerCase()).filter(Boolean)
      .some(term => term.split("+").map(s => s.trim()).every(t => hay.includes(t)));
  }

  // ── per-category line-based layout (interval scheduling / Gantt) ─
  // Each row tracks where the last placed item ends.
  // Items sorted by date; each goes in the lowest row where it fits.
  // Dense periods → many rows in use → tall stack.
  // Sparse periods → rows free up → items return to low rows.
  // sequential row assignment: item[0] → row 0, item[1] → row 1, …
  // each item gets its own row (monotonically increasing by date order).
  // dense period = many items close in x = steep staircase.
  // sparse period = few items spread in x = flat staircase.
  function buildCatStack(items, xFn, rev) {
    return [...items]
      .sort((a, b) => rev ? +b.date - +a.date : +a.date - +b.date)
      .map((it, i) => {
        const label = (it.title || it.text || "").slice(0, MAX_CHARS);
        return { ...it, x: xFn(it.date), y: i * LINE_H, label };
      });
  }

  // ── layout state ──────────────────────────────────────────────
  /** @type {any[]} */
  let ticks  = $state([]);
  /** @type {any[]} */
  let placed = $state([]);
  /** @type {Record<string,number>} */
  let counts = $state({});
  let dataSvgW = $state(4000);
  let svgH     = $state(600);

  const baseline = () => svgH - AXIS_H;

  function build() {
    const arts = $articles.filter(passesRegion);
    if (!arts.length) { placed = []; counts = {}; return; }

    const activeCats = categories.filter(c => c.on);
    if (!activeCats.length) { placed = []; return; }

    const parsed = arts.flatMap(a => {
      const d = parseDateLoose(a.ExtractedDate || a.Date);
      if (!d) return [];
      return [{ date: d, title: (a.Title || "").trim(), text: (a.Text || "").trim(), raw: a }];
    });
    if (!parsed.length) return;

    const allDates = parsed.map(p => +p.date);
    const dMin = new Date(Math.min(...allDates));
    const dMax = new Date(Math.max(...allDates));
    const days  = (+dMax - +dMin) / 86400000;
    const span  = +dMax - +dMin;

    const minW = typeof window !== "undefined"
      ? window.innerWidth - (panelOpen ? 252 : 40)
      : 1200;
    const W = Math.max(minW, Math.ceil(days * PX_PER_DAY) + 2 * H_PAD);
    dataSvgW = W;

    const xScale = d3.scaleTime()
      .domain([new Date(+dMin - span * 0.01), new Date(+dMax + span * 0.01)])
      .range(reversed ? [W - H_PAD, H_PAD] : [H_PAD, W - H_PAD]);

    ticks = xScale.ticks(d3.timeMonth.every(3)).map(d => ({
      x: xScale(d), isYear: d.getMonth() === 0, label: d.getFullYear(),
    }));

    const allPlaced = [];
    /** @type {Record<string,number>} */
    const newCounts = {};

    for (const cat of activeCats) {
      const colorIdx = categories.indexOf(cat);
      const catItems = parsed
        .filter(p => matchesCategory(p.raw, cat))
        .map(p => ({ ...p, catId: cat.id, colorIdx }));
      newCounts[cat.id] = catItems.length;
      allPlaced.push(...buildCatStack(catItems, d => xScale(d), reversed));
    }

    counts = newCounts;
    const maxY = allPlaced.reduce((m, p) => Math.max(m, p.y + LINE_H), 0);
    svgH   = TOP_PAD + maxY + AXIS_H;
    placed = allPlaced;
  }

  $effect(() => {
    void categories.map(c => c.on);
    void reversed;
    void showBerlin;
    void showBrandenburg;
    if ($articles.length) build();
  });

  onMount(async () => { await loadArticles(); });

  // ── tooltip ───────────────────────────────────────────────────
  /** @type {{ x:number, y:number, title:string, text:string, date:Date, catLabel:string } | null} */
  let tip = $state(null);
  function showTip(e, item) {
    const cat = categories.find(c => c.id === item.catId);
    tip = { x: e.clientX, y: e.clientY,
      title: item.title || item.label, text: item.text,
      date: item.date, catLabel: cat?.label ?? "" };
  }
  function hideTip() { tip = null; }
  const fmtDate = d => d
    ? new Date(d).toLocaleDateString("de-DE", { day: "2-digit", month: "short", year: "numeric" })
    : "";
</script>

<div class="page">

  <!-- scrollable timeline -->
  <div class="data-col">
    <div class="scroll-box">
      {#if !$articles.length}
        <p class="loading">Loading…</p>
      {:else}
        <svg width={dataSvgW} height={svgH}>

          <!-- year bands -->
          {#each ticks.filter(t => t.isYear) as t, i}
            {@const yt = ticks.filter(tt => tt.isYear)}
            <rect
              x={Math.min(t.x, yt[i+1]?.x ?? (reversed ? H_PAD : dataSvgW - H_PAD))}
              y={TOP_PAD}
              width={Math.abs((yt[i+1]?.x ?? (reversed ? H_PAD : dataSvgW - H_PAD)) - t.x)}
              height={baseline() - TOP_PAD}
              fill={i % 2 === 0 ? "rgba(0,0,0,0.025)" : "transparent"}
            />
          {/each}

          <!-- vertical ticks -->
          {#each ticks as t}
            <line x1={t.x} y1={TOP_PAD} x2={t.x} y2={baseline()}
                  stroke={t.isYear ? "#bbb" : "#e8e8e8"} stroke-width="1" />
          {/each}

          <!-- items — N independent stacks, one per category, same baseline -->
          {#each placed as item}
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <text
              x={item.x}
              y={baseline() - item.y - 1}
              font-family={FONT}
              font-size={FS}
              fill={CAT_COLORS[item.colorIdx % CAT_COLORS.length]}
              class="item"
              onmouseenter={e => showTip(e, item)}
              onmouseleave={hideTip}
            >{item.label}</text>
          {/each}

          <!-- baseline -->
          <line x1={0} y1={baseline()} x2={dataSvgW} y2={baseline()}
                stroke="#888" stroke-width="1" />

          <!-- axis -->
          {#each ticks as t}
            <line x1={t.x} y1={baseline()} x2={t.x}
                  y2={baseline() + (t.isYear ? 8 : 4)}
                  stroke={t.isYear ? "#666" : "#bbb"} stroke-width="1" />
            {#if t.isYear}
              <text x={t.x} y={baseline() + 22}
                    text-anchor="middle" font-family={FONT}
                    font-size={FS} fill="#777">{t.label}</text>
            {/if}
          {/each}

        </svg>
      {/if}
    </div>
  </div>

  <!-- right panel -->
  <aside class="panel" class:closed={!panelOpen}>
    <button class="toggle" onclick={() => { panelOpen = !panelOpen; build(); }}>
      {panelOpen ? "✕" : "☰"}
    </button>

    {#if panelOpen}
      <div class="panel-body">

        <div class="section-title">Categorie</div>
        {#each categories as cat}
          {@const color = CAT_COLORS[categories.indexOf(cat) % CAT_COLORS.length]}
          <button class="leg-row" class:off={!cat.on} onclick={() => { cat.on = !cat.on; }}>
            <span class="leg-dot" style:color={cat.on ? color : undefined}>{cat.on ? "●" : "○"}</span>
            <span class="leg-name" style:color={cat.on ? color : undefined}>{cat.label}</span>
            <span class="leg-n">{counts[cat.id] ?? 0}</span>
          </button>
        {/each}

        <div class="section-title" style="margin-top:1rem">Regione</div>
        <label class="check-row">
          <input type="checkbox" bind:checked={showBerlin} />
          Berlin
        </label>
        <label class="check-row">
          <input type="checkbox" bind:checked={showBrandenburg} />
          Brandenburg
        </label>
        {#if showBerlin || showBrandenburg}
          <div class="filter-note">
            {showBerlin && showBrandenburg
              ? "Berlin + Brandenburg"
              : showBerlin ? "Solo Berlin" : "Solo Brandenburg"}
          </div>
        {/if}

        <div class="section-title" style="margin-top:1rem">Ordine</div>
        <button class="ctrl-btn" onclick={() => { reversed = !reversed; }}>
          {reversed ? "new → old" : "old → new"}
        </button>

        <div class="section-title" style="margin-top:1rem">+ Aggiungi</div>
        <input class="inp" placeholder="Nome" bind:value={newLabel} />
        <input class="inp" placeholder='Query: "frau,frauen" (,=OR +=AND)' bind:value={newQuery} />
        <select class="sel" bind:value={newType}>
          <option value="text">Testo libero</option>
          <option value="canonical">Keyword canonico</option>
        </select>
        <button class="add-btn" onclick={addCategory}>Aggiungi</button>

        <div class="section-title" style="margin-top:1rem">Rimuovi</div>
        {#each categories as cat (cat.id)}
          <div class="rm-row">
            <span>{cat.label}</span>
            <button class="rm" onclick={() => removeCategory(cat.id)}>✕</button>
          </div>
        {/each}

      </div>
    {/if}
  </aside>
</div>

{#if tip}
  <div class="tip" style:left="{tip.x + 14}px" style:top="{tip.y - 8}px">
    <div class="tip-cat">{tip.catLabel} · {fmtDate(tip.date)}</div>
    <div class="tip-title">{tip.title}</div>
    {#if tip.text && tip.text !== tip.title}
      <div class="tip-text">{tip.text.slice(0, 200)}</div>
    {/if}
  </div>
{/if}

<style>
  :global(body) { margin: 0; background: #f4f3ef; overflow: hidden; }

  .page { display: flex; width: 100vw; height: 100vh; background: #f4f3ef; overflow: hidden; }

  .data-col  { flex: 1; overflow: hidden; min-width: 0; }
  .scroll-box { width: 100%; height: 100%; overflow-x: auto; overflow-y: auto; }
  svg { display: block; }

  .item { cursor: default; }
  .item:hover { opacity: 0.6; }

  .loading { padding: 2rem; color: #aaa; font-size: 0.8rem; font-family: Courier, monospace; }

  .panel {
    flex-shrink: 0; width: 252px; height: 100vh;
    background: rgba(244,243,239,0.97);
    border-left: 1px solid #ccc;
    display: flex; flex-direction: column;
    overflow: hidden; transition: width 0.15s;
  }
  .panel.closed { width: 36px; }

  .toggle {
    align-self: flex-end; background: none; border: none;
    color: #aaa; font-size: 0.85rem; cursor: pointer;
    padding: 10px 10px 6px; font-family: Courier, monospace; flex-shrink: 0;
  }
  .toggle:hover { color: #111; }

  .panel-body {
    padding: 0 12px 16px; overflow-y: auto; flex: 1;
    font-family: Courier, monospace; font-size: 0.7rem; color: #555;
  }

  .section-title {
    font-size: 0.58rem; text-transform: uppercase;
    letter-spacing: 0.1em; color: #aaa; margin: 6px 0 4px;
  }

  .leg-row {
    display: flex; align-items: center; gap: 5px;
    background: none; border: none; cursor: pointer;
    font-family: Courier, monospace; font-size: 0.68rem;
    color: #333; padding: 2px 0; text-align: left; width: 100%;
  }
  .leg-row.off .leg-name { color: #ccc !important; text-decoration: line-through; }
  .leg-row.off .leg-dot  { color: #ccc !important; }
  .leg-dot  { font-size: 0.7rem; flex-shrink: 0; }
  .leg-name { flex: 1; }
  .leg-n    { color: #bbb; font-size: 0.62rem; min-width: 22px; text-align: right; }

  .check-row {
    display: flex; align-items: center; gap: 6px;
    font-size: 0.68rem; color: #555; padding: 3px 0; cursor: pointer;
  }
  .check-row input { accent-color: #111; cursor: pointer; }

  .filter-note { font-size: 0.6rem; color: #888; margin-top: 2px; font-style: italic; }

  .ctrl-btn {
    width: 100%; background: none; border: 1px solid #ccc;
    font-family: Courier, monospace; font-size: 0.65rem;
    color: #888; cursor: pointer; padding: 4px 6px; text-align: left; margin-bottom: 4px;
  }
  .ctrl-btn:hover { background: #111; color: #f4f3ef; border-color: #111; }

  .inp {
    width: 100%; box-sizing: border-box;
    background: #ebe9e3; border: 1px solid #d8d5ce;
    font-family: Courier, monospace; font-size: 0.68rem;
    padding: 4px 6px; color: #333; margin-bottom: 4px; display: block;
  }
  .sel {
    width: 100%; box-sizing: border-box;
    background: #ebe9e3; border: 1px solid #d8d5ce;
    font-family: Courier, monospace; font-size: 0.68rem;
    padding: 4px 4px; color: #333; margin-bottom: 4px; display: block;
  }
  .add-btn {
    width: 100%; background: #111; color: #f4f3ef;
    border: none; font-family: Courier, monospace; font-size: 0.7rem;
    cursor: pointer; padding: 5px 0; margin-top: 2px;
  }
  .add-btn:hover { background: #000; }

  .rm-row { display: flex; align-items: center; gap: 6px; margin-bottom: 3px; font-size: 0.68rem; color: #888; }
  .rm-row span { flex: 1; }
  .rm { background: none; border: none; color: #ccc; cursor: pointer; font-size: 0.65rem; }
  .rm:hover { color: #c00; }

  .tip {
    position: fixed; z-index: 100;
    background: #fff; border: 1px solid #ddd; border-left: 3px solid #111;
    padding: 8px 12px; font-family: Courier, monospace;
    font-size: 0.7rem; color: #333; max-width: 340px;
    pointer-events: none; line-height: 1.5;
    box-shadow: 2px 2px 8px rgba(0,0,0,0.07);
  }
  .tip-cat   { font-size: 0.6rem; color: #999; margin-bottom: 3px; }
  .tip-title { color: #111; margin-bottom: 3px; }
  .tip-text  { color: #999; font-size: 0.63rem; }
</style>
