<script>
  import { untrack } from "svelte";
  import { articles, applyFilters, filters, parseDateLoose } from "$lib/stores";
  import { loadArticles } from "$lib/utils/loadArticles";
  import { loadReportTranslations } from "$lib/utils/reportTranslations";
  import { lang, setLang, availableLangs, t as tr } from "$lib/i18n";
  import Sheet from "./Sheet.svelte";
  import Curated from "./Curated.svelte";
  import Query from "$lib/components/Query.svelte";
  import { toSheet } from "./report.js";

  const W = 500; // sheet width in layout px, A4 ratio (the on-screen size comes from FILL)
  const H = W * Math.SQRT2;
  const STEP = 0.9; // viewport heights of scroll per report
  const GAP = 8; // px between stacked sheets
  const STRIPS = 12; // the flying sheet is cut into strips so it can curve
  const TILT_X = 54; // deg, how far the sheet tips back (54.7 = isometric)
  const TILT_Z = -45; // deg, how far it is turned sideways
  const FILL = 0.95; // how much of the screen the stack fills

  let scrollY = $state(0);
  let innerWidth = $state(1200);
  let innerHeight = $state(800);
  let introHeight = $state(0);

  let translations = $state(null);
  let Graph = $state.raw(null); // only loaded with ?graph=true
  let open = $state(false); // the filters, on a phone
  let view = $state.raw(null); // the curated view that is on; it replaces the filters

  $effect(() => {
    loadArticles();
    loadReportTranslations().then((map) => (translations = map));
    if (new URLSearchParams(location.search).get("graph") === "true")
      import("./Graph.svelte").then((module) => (Graph = module.default));
  });
  const map = $derived($lang === "en" ? translations : null);

  // newest first
  const date = (d) => parseDateLoose(d.Date)?.getTime() ?? 0;
  const all = $derived([...$articles].sort((a, b) => date(b) - date(a)));
  const search = $derived(
    (view ? ((map && view.highlightEn) ?? view.filters.text ?? "") : $filters.text).trim(),
  );
  const q = $derived(search.length >= 3 ? search : "");
  const reports = $derived.by(() => {
    translations; // re-run once the English texts are in
    return applyFilters(all, {
      ...(view?.filters ?? $filters),
      textLang: "both",
    });
  });

  // back to the top of the stack when the filters change
  let lastFilters = null;
  $effect(() => {
    const current = `${view?.id ?? q}|${$filters.keyword}|${$filters.year}`;
    if (lastFilters !== null && current !== lastFilters)
      window.scrollTo(
        0,
        untrack(() => introHeight),
      );
    lastFilters = current;
  });

  const progress = $derived(
    Math.max(
      0,
      Math.min(
        (scrollY - introHeight) / (innerHeight * STEP),
        reports.length - 1,
      ),
    ),
  );
  const top = $derived(Math.floor(progress));
  const t = $derived(progress - top); // 0 = on the stack, 1 = blown away

  // one sheet per report under the top one; the stack thins out as you scroll
  const layers = $derived(reports.length - top - 1);
  // the tilted sheet's size on screen before scaling
  const box = $derived.by(() => {
    const x = (TILT_X * Math.PI) / 180;
    const z = (Math.abs(TILT_Z) * Math.PI) / 180;
    return {
      w: W * Math.cos(z) + H * Math.sin(z),
      h: (W * Math.sin(z) + H * Math.cos(z)) * Math.cos(x),
    };
  });
  // fit the tilted sheet on screen (the stack below doesn't change its size)
  const scale = $derived(
    FILL * Math.min(innerWidth / box.w, innerHeight / box.h),
  );
  // every sheet of the stack as its outline on screen, relative to the centre
  const tiltX = (TILT_X * Math.PI) / 180;
  const tiltZ = (TILT_Z * Math.PI) / 180;
  const outline = $derived(
    [
      [-W, -H],
      [W, -H],
      [W, H],
      [-W, H],
    ]
      .map(([x, y]) => {
        const sx = (x / 2) * Math.cos(tiltZ) - (y / 2) * Math.sin(tiltZ);
        const sy = (x / 2) * Math.sin(tiltZ) + (y / 2) * Math.cos(tiltZ);
        return `${sx * scale},${sy * Math.cos(tiltX) * scale}`;
      })
      .join(" "),
  );
  const drop = $derived(GAP * Math.sin(tiltX) * scale); // on-screen distance between sheets
  // only the sheets that reach the screen, lowest first
  const depths = $derived.by(() => {
    const onScreen = Math.ceil((innerHeight + box.h * scale) / 2 / drop) + 1;
    const lowest = Math.min(layers, onScreen);
    return Array.from(
      { length: Math.max(0, lowest - 1) },
      (_, k) => lowest - k,
    );
  });

  const clamp = (v) => Math.max(0, Math.min(1, v));
  const ease = (v) => v * v * (3 - 2 * v);

  // each sheet sweeps out to the top left or top right, 50-70 degrees from straight up
  const random = (n) => (Math.sin(n * 12.9898) * 43758.5453) % 1;
  const angle = $derived.by(() => {
    const r = Math.abs(random(top + 1));
    const side = (r * 10) % 2 < 1 ? -1 : 1;
    return side * (50 + r * 20);
  });

  // linear with the scroll: at t = 1 the sheet has just left the top of the screen
  function fly(t) {
    const a = (angle * Math.PI) / 180;
    // distance from the centre until the whole sheet is past the top or a side
    const up = (innerHeight + box.h * scale) / 2;
    const side = (innerWidth + box.w * scale) / 2;
    const out = Math.min(up / Math.cos(a), side / Math.abs(Math.sin(a)));
    const d = t * out;
    return `translate(${Math.sin(a) * d}px, ${-Math.cos(a) * d}px)`;
  }

  // on the sheet itself: lift, spin and flutter
  function lift(t) {
    const z = t * 40;
    return `translateZ(${z}px) rotateZ(${angle * t * 1.5}deg) rotateY(${Math.sin(t * 6) * 18 * t}deg)`;
  }

  // angle of each strip relative to the one above: the first one lifts the
  // sheet at its top edge, the rest bend more towards the free edge (curl)
  function bend(i, t) {
    if (i === 0) return t * 8 + Math.sin(t * 9) * 3 * t;
    const curl = t * 17 + Math.sin(t * 14) * 2 * t; // up to ~40° across the sheet
    return curl * (i / STRIPS);
  }
  const world = $derived(
    `scale(${scale}) rotateX(${TILT_X}deg) rotateZ(${TILT_Z}deg)`,
  );
</script>

<svelte:window bind:scrollY bind:innerWidth bind:innerHeight />

<!-- one strip of a sheet, with the next strip hanging from its bottom edge -->
{#snippet strip(i, sheet, t)}
  <div
    class="strip"
    class:first={i === 0}
    style:height="{H / STRIPS}px"
    style:transform="rotateX({bend(i, t)}deg)"
  >
    <div class="face">
      <div class="slice" style:height="{H}px" style:top="{(-i * H) / STRIPS}px">
        <Sheet {sheet} />
      </div>
    </div>
    <div
      class="face back"
      class:top-edge={i === 0}
      class:bottom-edge={i === STRIPS - 1}
    ></div>
    {#if i < STRIPS - 1}{@render strip(i + 1, sheet, t)}{/if}
  </div>
{/snippet}

<div class="langs">
  {#each availableLangs as l}
    <button class:active={$lang === l} onclick={() => setLang(l)}
      >{l.toUpperCase()}</button
    >
  {/each}
</div>

<section class="intro" bind:offsetHeight={introHeight}>
  <!-- <h1>{$tr("reports.title")}</h1> -->
  {#if all.length}
    <p>
      <span class="line-bg">
        {$tr("reports.intro")
          .replace("{n}", all.length.toLocaleString($lang))
          .replace("{year}", String(all.at(-1).Date).slice(-4))}
      </span>
    </p>
    <br />
    <p>
      <span class="line-bg">
        {$tr("reports.how")
          .replace("{n}", all.length.toLocaleString($lang))
          .replace("{year}", String(all.at(-1).Date).slice(-4))}
      </span>
    </p>
  {/if}
  <!-- <small>{$tr("reports.note")}</small> -->
</section>

<div class="filters" class:hidden={scrollY <= introHeight / 2} class:open>
  <button class="toggle" class:active={view} onclick={() => (open = !open)}>
    {$tr("filters.toggle")}
  </button>
  <div class="panel">
    {#if !view}
      <Query fields={["keyword", "year", "search"]} textLang="both" />
    {/if}
    <Curated bind:active={view} />
  </div>
</div>

<div style:height="{(reports.length - 1) * innerHeight * STEP + innerHeight}px">
  <div class="stage">
    {#if reports.length}
      <!-- the stack, rising one sheet per report so the next one ends up where the last one was -->
      <svg
        class="stack"
        aria-hidden="true"
        style:transform="translateY({-t * drop}px)"
      >
        {#each depths as depth (depth)}
          <polygon points={outline} transform="translate(0 {depth * drop})" />
        {/each}
      </svg>

      <!-- the top sheet flying away, and the next one already built underneath it,
           so nothing has to be drawn from scratch when it starts moving -->
      {#each [top + 1, top].filter((i) => reports[i]) as i (i)}
        {@const flying = i === top}
        <div
          class="world"
          style:width="{W}px"
          style:height="{H}px"
          style:margin="{-H / 2}px 0 0 {-W / 2}px"
          style:transform={flying
            ? `${fly(t)} ${world}`
            : `${world} translateZ(${(t - 1) * GAP}px)`}
        >
          <div class="flying" style:transform={lift(flying ? t : 0)}>
            {@render strip(0, toSheet(reports[i], q, map), flying ? t : 0)}
          </div>
        </div>
      {/each}
    {/if}
  </div>
</div>

{#if Graph}
  <Graph {reports} current={reports[top]} />
{/if}

<style>
  :global(html body) {
    background: gainsboro;
    font-family: Arial, Helvetica, sans-serif;
  }
  .intro {
    position: sticky;
    top: 0;
    font-family: Arial, Helvetica, sans-serif;
    box-sizing: border-box;
    min-height: 20vh;
    max-width: 680px;
    margin: 0 auto;
    padding: 40px;
    display: flex;
    flex-direction: column;
    /* gap: 20px; */
    color: #000;
    text-align: center;
  }
  /* no room beside the language buttons: start below them */
  @media (max-width: 900px) {
    .intro {
      padding-top: 56px;
    }
  }
  .intro h1 {
    font-family: inherit;
    font-size: 48px;
    font-weight: 400;
    line-height: 1.1;
  }
  .intro p {
    font-family: inherit;
    font-size: 22px;
    line-height: 1.22;
  }
  .intro small {
    color: #555;
    font-size: 14px;
  }
  .langs {
    position: fixed;
    top: 16px;
    left: 16px;
    z-index: 1;
    display: flex;
    gap: 4px;
  }
  .filters {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 1;
    box-sizing: border-box;
    padding: 64px 16px 16px;
    background: linear-gradient(to top, #fff calc(100% - 64px), transparent);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    color: #000;
    transition: opacity 0.2s;
  }
  .filters.hidden {
    opacity: 0;
    pointer-events: none;
  }
  /* the fade lets clicks and scrolling through */
  .filters {
    pointer-events: none;
  }
  .filters:not(.hidden) > * {
    pointer-events: auto;
  }
  .panel {
    display: contents;
  }
  .toggle {
    display: none;
    padding: 5px 10px;
    font-family: Arial, Helvetica, sans-serif;
    font-size: 16px;
    background: #fff;
    color: #000;
    border: 1px solid #000;
    border-radius: 0;
  }
  .toggle.active {
    background: #000;
    color: #fff;
  }
  /* on a phone: one button, and the filters open from it */
  @media (max-width: 700px) {
    .intro {
      position: static;
      padding: 56px 16px 16px;
    }
    .intro p {
      font-size: 18px;
    }
    .filters {
      --query-search-label: none;
      --query-field: 1 1 40%;
      --query-width: 100%;
      align-items: center;
      gap: 6px;
      padding: 12px;
      background: none;
    }
    .filters.open {
      align-items: stretch;
      padding-top: 40px;
      background: linear-gradient(to top, #fff calc(100% - 40px), transparent);
    }
    .toggle {
      display: block;
      align-self: center;
    }
    .panel {
      display: none;
    }
    .open .panel {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
  }
  .langs button {
    padding: 5px 10px;
    font-family: Arial, Helvetica, sans-serif;
    font-size: 16px;
    background: #fff;
    color: #000;
    border: 1px solid #ccc;
    border-radius: 0;
  }
  .langs .active {
    background: #000;
    color: #fff;
  }
  .stage {
    position: sticky;
    top: 0;
    height: 100vh;
    box-sizing: border-box;
    overflow: hidden;
  }
  .world,
  .flying,
  .strip {
    transform-style: preserve-3d;
  }
  .world {
    position: absolute;
    left: 50%;
    top: 50%;
  }
  .flying,
  .face {
    position: absolute;
    inset: 0;
  }
  .flying {
    transform-origin: 50% 0;
  }
  .strip {
    position: absolute;
    left: 0;
    width: 100%;
    top: 100%;
    transform-origin: 50% 0;
  }
  .strip.first {
    top: 0;
  }
  .face {
    bottom: -1px;
    overflow: hidden;
    backface-visibility: hidden;
  }
  .slice {
    position: absolute;
    left: 0;
    width: 100%;
    container-type: size;
  }
  .back {
    background: #e6e6e6;
    border: 1id black;
    border-width: 1px;
    transform: rotateX(180deg);
  }
  .back.top-edge {
    border-bottom-width: 1px;
  }
  .back.bottom-edge {
    border-top-width: 1px;
  }

  /* zero-size at the centre of the screen, so the outlines are relative to it */
  .stack {
    position: absolute;
    left: 50%;
    top: 50%;
    width: 1px;
    height: 1px;
    overflow: visible;
    will-change: transform; /* moves as one layer, without redrawing the outlines */
  }
  .stack polygon {
    fill: #fff;
    stroke: #ccc;
    stroke-width: 1;
    stroke-linejoin: round;
  }
</style>
