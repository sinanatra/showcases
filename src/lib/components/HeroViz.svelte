<script>
  import { createEventDispatcher } from "svelte";
  import DataViz from "$lib/components/DataViz.svelte";

  let { 
    scene = {},
    index = 0,
    infoInteractive = true,
    scrollHintLabel = "Scroll to explore",
    autoCycle = false,
    noZoom = false,
    startZoom = 0.8,
    startPan = { x: 0, y: 300 },
    showScrollHint = true,
    showText = true,
    textFaded = 0,
    showControls = 0
  } = $props();

  let textOpacity = $derived(Math.max(0, Math.min(1, 1 - textFaded)));
  let controlsOpacity = $derived(Math.max(0, Math.min(1, showControls)));

  const dispatch = createEventDispatcher();
  let vizRef;

  let heading = $derived(scene?._heading || "");
  let subtitle = $derived(scene?._subtitle || "");
  let body = $derived(scene?._body || "");
  let links = $derived(Array.isArray(scene?._cta) ? scene._cta : []);

  function scrollNext() {
    dispatch("scrollhint");
  }
  function handleInfoClick(event) {
    if (!infoInteractive) return;
    if (event?.target?.closest("a")) return;
    scrollNext();
  }
  function handleInfoKey(event) {
    if (!infoInteractive) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleInfoClick(event);
    }
  }
</script>

<section class="step hero-step" aria-label={"section-" + index}>
  <div class="hero-viz-wrapper">
    <DataViz
      bind:this={vizRef}
      {autoCycle}
      {noZoom}
      growthMode={"fungal"}
      growthModeFixed="true"
      {startZoom}
      {startPan}
      disableScrollZoom={true}
    />
    <div class="hero-controls-slot">
      <slot name="controls" />
    </div>
    <article class="hero-info" style={`opacity:${textOpacity}`}>
      {#if heading}<h1>
          <span class="line-bg">{heading}</span>
        </h1>{/if}
      {#if subtitle}<h2>
          <span class="line-bg">{subtitle}</span>
        </h2>{/if}
      {#if body}<p><span class="line-bg">{body}</span></p>{/if}
      {#if links.length}
        <div class="links">
          {#each links as link}
            <a
              href={link.href}
              sveltekit:prefetch
              class:disabled={link.visible === false}
              aria-disabled={link.visible === false}
            >
              <span class="line-bg">{link._label}</span>
            </a>
          {/each}
        </div>
      {/if}
    </article>
    <div
      class="hero-inline-controls"
      style={`opacity:${controlsOpacity};transform:translate(-50%, ${
        20 - 16 * controlsOpacity
      }rem);pointer-events:${controlsOpacity > 0.9 ? "auto" : "none"};`}
    >
      <slot name="controls-inline" />
    </div>
    <div class="hero-zoom-controls" aria-label="Zoom controls">
      <button
        type="button"
        on:click={() => vizRef?.zoomIn?.()}
        aria-label="Zoom in"
      >
        +
      </button>
      <button
        type="button"
        on:click={() => vizRef?.zoomOut?.()}
        aria-label="Zoom out"
      >
        −
      </button>
    </div>
    {#if showScrollHint}
      <button
        type="button"
        class="scroll-hint"
        on:click={() => {
          if (showText) scrollNext();
        }}
        aria-disabled={!showText}
      >
        ↓ {scrollHintLabel}
      </button>
    {/if}
  </div>
</section>

<style>
  .hero-step {
    position: relative;
    align-items: center;
    padding: 0;
    margin: 0;

    overflow: visible;
    min-height: 150vh;
    margin-bottom: -35vh;
    padding-bottom: 35vh;
    display: block !important;
    z-index: 100;
    user-select: none;
  }
  .line-bg {
    background: #000;
    color: #fff;
    padding: 0.1ch 0.5ch;
    display: inline;
    box-decoration-break: clone;
    -webkit-box-decoration-break: clone;
  }
  h1 {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 3em;
    font-weight: 400;
    margin: 0;
  }
  h2 {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 1.5em;
    font-weight: 400;
    margin: 0;
    font-style: italic;
  }
  p {
    font-size: 1em;
    margin: 1rem 0 0;
  }
  .links {
    margin-top: 1rem;
    display: flex;
    gap: 0.8rem;
    flex-wrap: wrap;
    justify-content: center;
  }
  .links a {
    color: #fff;
    text-decoration: none;
    border-bottom: 1px solid transparent;
  }
  .links a span:hover {
    background: var(--color-1);
    color: #000;
  }
  .hero-viz-wrapper {
    background-color: black;
    position: relative;
    width: 100%;
    height: 100vh;
    position: sticky;
    top: 0;
    overflow: hidden;
    box-shadow: -2px 4px 6px 0px black;
  }
  .hero-zoom-controls {
    position: absolute;
    top: 1rem;
    right: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    z-index: 3;
  }
  .hero-zoom-controls button {
    width: 25px;
    height: 25px;
    font-size: 1rem;
    /* border-radius: 50%; */
    border: none;
    background: white;
    color: black;
    cursor: pointer;
  }
  .hero-info {
    position: absolute;
    bottom: 20rem;
    left: 50%;
    transform: translateX(-50%);
    text-align: center;
    width: 100%;
    padding: 10px;
    max-width: min(100vw, 720px);
    z-index: 1000;
  }
  .hero-inline-controls {
    position: absolute;
    bottom: 5rem;
    left: 50%;
    transform: translate(-50%, 20rem);
    width: 100%;
    display: flex;
    justify-content: center;
    z-index: 2;
  }

  .scroll-hint {
    position: absolute;
    bottom: 0.5rem;
    left: 50%;
    transform: translateX(-50%);
    background: black;
    color: rgb(126, 126, 126);
    border: none;
    padding: 0.2rem .5rem;
    font-size: 0.8rem;
    z-index: 2;
  }
</style>
