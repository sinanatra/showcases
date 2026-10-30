<script>
  import { untrack } from "svelte";
  import { articles, applyFilters, filters, parseDateLoose } from "$lib/stores";
  import { loadArticles } from "$lib/utils/loadArticles";
  import { loadReportTranslations } from "$lib/utils/reportTranslations";
  import { lang, setLang, availableLangs, t as tr } from "$lib/i18n";
  import Sheet from "./Sheet.svelte";
  import Curated from "./Curated.svelte";
  import TimeBar from "./TimeBar.svelte";
  import Query from "$lib/components/Query.svelte";
  import { toSheet } from "./report.js";

  const W = 500; // sheet width in layout px, A4 ratio (the on-screen size comes from FILL)
  const H = W * Math.SQRT2;
  const STEP = 0.6; // viewport heights of scroll from one report to the next
  const FLIGHT = 1.5; // how many of those a flight takes, so the next one starts before it has left
  const GAP = 8; // px between stacked sheets
  const STRIPS = 12; // the flying sheet is cut into strips so it can curve
  const TILT_X = 54; // deg, how far the sheet tips back (54.7 = isometric)
  const TILT_Z = -45; // deg, how far it is turned sideways
  const FILL = 0.95; // how much of the screen the stack fills
  const EXIT = 0.9; // the curl takes the sheet off the screen a bit sooner than its flat shape

  let scrollY = $state(0);
  let innerWidth = $state(1200);
  let innerHeight = $state(800);
  let introHeight = $state(0);

  let translations = $state(null);
  let open = $state(false); // the filters, on a phone
  let view = $state.raw(null); // the curated view that is on; it replaces the filters

  $effect(() => {
    loadArticles();
    loadReportTranslations().then((map) => (translations = map));
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
        reports.length + FLIGHT - 2,
      ),
    ),
  );
  const top = $derived(Math.min(Math.floor(progress), reports.length - 1));
  const t = $derived(Math.min(1, progress - top)); // from one report to the next
  const flown = (i) => (i < reports.length - 1 ? clamp((progress - i) / FLIGHT) : 0);

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

  // each sheet flies off somewhere across the top half, with a spin of its own
  const random = (n) => (Math.sin(n * 12.9898) * 43758.5453) % 1;
  const angleOf = (i) => Math.abs(random(i + 1)) * 170 - 85; // degrees from straight up
  const spinOf = (i) => Math.abs(random(i + 1.5)) * 240 - 120; // degrees over a flight

  // the corners of the sheet on screen once it has spun, relative to the centre
  const cornersOf = (i) => {
    const spin = (spinOf(i) * Math.PI) / 180 + tiltZ;
    return [
      [-W / 2, 0],
      [W / 2, 0],
      [W / 2, H],
      [-W / 2, H],
    ].map(([x, y]) => [
      (x * Math.cos(spin) - y * Math.sin(spin) - (H / 2) * -Math.sin(tiltZ)) * scale,
      (x * Math.sin(spin) + y * Math.cos(spin) - (H / 2) * Math.cos(tiltZ)) *
        Math.cos(tiltX) *
        scale,
    ]);
  };

  const clearOf = (corners, direction) => {
    const edges = corners.map(([x, y], i) => {
      const [nx, ny] = corners[(i + 1) % 4];
      return [ny - y, x - nx];
    });
    const normals = [[1, 0], [0, 1], ...edges].flatMap(([x, y]) => {
      const length = Math.hypot(x, y);
      return [[x / length, y / length], [-x / length, -y / length]];
    });
    const distances = normals.map(([x, y]) => {
      const towards = direction[0] * x + direction[1] * y;
      if (towards <= 0.001) return Infinity;
      const screen = (innerWidth / 2) * Math.abs(x) + (innerHeight / 2) * Math.abs(y);
      return (screen + Math.max(...corners.map(([a, b]) => -a * x - b * y))) / towards;
    });
    return Math.min(...distances);
  };

  // linear with the scroll: at t = 1 the sheet has just left the screen
  function fly(i, t) {
    const a = (angleOf(i) * Math.PI) / 180;
    const d = t * EXIT * clearOf(cornersOf(i), [Math.sin(a), -Math.cos(a)]);
    return `translate(${Math.sin(a) * d}px, ${-Math.cos(a) * d}px)`;
  }

  // on the sheet itself: lift, spin and flutter
  function lift(i, t) {
    const z = t * 40;
    return `translateZ(${z}px) rotateZ(${spinOf(i) * t}deg) rotateY(${Math.sin(t * 6) * 18 * t}deg)`;
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

<TimeBar
  {all}
  {reports}
  time={date}
  current={reports[top] ? date(reports[top]) : 0}
  onpick={(i) => window.scrollTo(0, introHeight + i * innerHeight * STEP + 1)}
/>

{#if reports[top + 2]}
  <div class="scout" style:width="{W}px" style:height="{H}px" aria-hidden="true">
    <Sheet sheet={toSheet(reports[top + 2], q, map)} />
  </div>
{/if}

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

<div
  style:height="{(reports.length + FLIGHT - 2) * innerHeight * STEP + innerHeight}px"
>
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

      <!-- the sheets still flying away, and the next one already built underneath
           them, so nothing has to be drawn from scratch when it starts moving -->
      {#each [top + 1, top, top - 1].filter((i) => reports[i] && flown(i) < 1) as i (i)}
        {@const flying = i <= top}
        {@const f = flown(i)}
        <div
          class="world"
          style:width="{W}px"
          style:height="{H}px"
          style:margin="{-H / 2}px 0 0 {-W / 2}px"
          style:transform={flying
            ? `${fly(i, f)} ${world}`
            : `${world} translateZ(${(t - 1) * GAP}px)`}
        >
          <div class="flying" style:transform={lift(i, f)}>
            {@render strip(0, toSheet(reports[i], q, map), f)}
          </div>
        </div>
      {/each}
    {/if}
  </div>
</div>

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
    padding: 60px 40px 40px;
    display: flex;
    flex-direction: column;
    /* gap: 20px; */
    color: #000;
    text-align: center;
  }
  /* no room beside the language buttons: start below them */
  @media (max-width: 900px) {
    .intro {
      padding-top: 76px;
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
  .scout {
    position: fixed;
    top: 0;
    left: 0;
    container-type: size;
    visibility: hidden;
    pointer-events: none;
  }
  .langs {
    position: fixed;
    top: 32px;
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
      padding: 76px 16px 16px;
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
