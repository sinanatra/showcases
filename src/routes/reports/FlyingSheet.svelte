<script>
  // the movement is all CSS, driven by --t: 0 = on the pile, 1 = gone
  import Sheet from "./Sheet.svelte";
  import { W, H, STRIPS, TILT_X, TILT_Z, flightOf } from "./pile.js";

  let { sheet, index, t, rise, scale, width, height } = $props();

  const flight = $derived(flightOf(index, scale, width, height));
</script>

{#snippet strip(i)}
  <div class="strip" class:first={i === 0} style:--i={i}>
    <div class="face">
      <div class="slice"><Sheet {sheet} /></div>
    </div>
    <div class="face back"></div>
    {#if i < STRIPS - 1}{@render strip(i + 1)}{/if}
  </div>
{/snippet}

<div
  class="world"
  style:--w="{W}px"
  style:--h="{H}px"
  style:--strips={STRIPS}
  style:--tilt-x="{TILT_X}deg"
  style:--tilt-z="{TILT_Z}deg"
  style:--scale={scale}
  style:--x="{flight.x}px"
  style:--y="{flight.y}px"
  style:--spin="{flight.spin}deg"
  style:--t={t}
  style:--rise="{rise}px"
>
  <div class="flying">{@render strip(0)}</div>
</div>

<style>
  .world,
  .flying,
  .strip {
    transform-style: preserve-3d;
  }

  .world {
    position: absolute;
    left: 50%;
    top: 50%;
    width: var(--w);
    height: var(--h);
    margin: calc(var(--h) / -2) 0 0 calc(var(--w) / -2);
    transform: translate(calc(var(--x) * var(--t)), calc(var(--y) * var(--t)))
      scale(var(--scale)) rotateX(var(--tilt-x)) rotateZ(var(--tilt-z))
      translateZ(var(--rise));
  }

  .flying {
    --curl: calc((var(--t) * 17 + sin(var(--t) * 14) * 2 * var(--t)) * 1deg);
    position: absolute;
    inset: 0;
    transform-origin: 50% 0;
    transform: translateZ(calc(var(--t) * 40px)) rotateZ(calc(var(--spin) * var(--t)))
      rotateY(calc(sin(var(--t) * 6) * 18deg * var(--t)));
  }

  .strip {
    position: absolute;
    top: 100%;
    left: 0;
    width: 100%;
    height: calc(var(--h) / var(--strips));
    transform-origin: 50% 0;
    transform: rotateX(calc(var(--curl) * var(--i) / var(--strips)));
  }
  .strip.first {
    top: 0;
    transform: rotateX(calc((var(--t) * 8 + sin(var(--t) * 9) * 3 * var(--t)) * 1deg));
  }

  .face {
    position: absolute;
    inset: 0 0 -1px; /* no seam between strips */
    overflow: hidden;
    backface-visibility: hidden;
  }
  .back {
    background: #e6e6e6;
    transform: rotateX(180deg);
  }

  .slice {
    position: absolute;
    top: calc(var(--h) / var(--strips) * var(--i) * -1);
    left: 0;
    width: 100%;
    height: var(--h);
    container-type: size;
  }
</style>
