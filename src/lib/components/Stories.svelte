<script>
  export let data;
  const toSlug = (d) => (d?.path || "").replace(/^\/?texts\//, "");
  const isPublic = (d) => d?.meta?.isPublic !== false;
  const titleOf = (d) => d?.meta?.title || "";
  const excerptOf = (d) => d?.meta?.excerpt || "";
  const items = (data?.posts ?? []).filter(isPublic);
  let track;
  let index = 0;
  const total = items.length;
  function goTo(i) {
    if (!track || total === 0) return;
    index = ((i % total) + total) % total;
    const w = track.clientWidth;
    track.scrollTo({ left: index * w, behavior: "smooth" });
  }
  function next() {
    goTo(index + 1);
  }
  function prev() {
    goTo(index - 1);
  }
  function onScroll() {
    if (!track) return;
    const w = track.clientWidth || 1;
    index = Math.round(track.scrollLeft / w);
  }
  function onKeydown(e) {
    if (e.key === "ArrowRight") next();
    if (e.key === "ArrowLeft") prev();
  }
</script>

{#if items.length > 0}
  <div class="carousel" on:keydown={onKeydown} tabindex="0">
    <!-- {#if items.length > 1}
      <button class="nav prev" on:click={prev}>‹</button>
    {/if} -->
    <div class="track" bind:this={track} on:scroll={onScroll}>
      {#each items as d}
        <a class="slide" href={`/stories/${toSlug(d)}`}>
          <div class="content">
            <h2 class="title">{titleOf(d)}</h2>
            {#if excerptOf(d)}
              <p class="excerpt">{excerptOf(d)}</p>{/if}
          </div>
        </a>
      {/each}
    </div>
    <!-- {#if items.length > 1}
      <button class="nav next" on:click={next}>›</button>
    {/if} -->
  </div>
{/if}

<style>
  .carousel {
    font-family: Arial, Helvetica, sans-serif;
    position: relative;
    width: 100%;
    margin: 0 auto;
    /* padding: 0 2rem; */
    z-index: 1000;
    margin-bottom: 100px;
  }

  .track {
    display: grid;
    grid-auto-flow: column;
    /* grid-auto-columns: minmax(0, 320px); */
    justify-content: center;
    gap: 10px;
    margin: 0 auto;
    overflow-x: auto;
    scroll-snap-type: x mandatory;
    scrollbar-width: none;
  }

  .track::-webkit-scrollbar {
    display: none;
  }

  .slide {
    scroll-snap-align: start;
    display: flex;
    margin: 0;
    width: 100%;
    max-width: 320px;

    /* align-items: center; */
    /* justify-content: center; */

    background: black;

    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #fff;
    text-decoration: none;
    /* aspect-ratio: 5 / 2; */
    padding: 10px;
  }
  .slide:hover {
    color: var(--color-1);
  }
  .content {
    display: flex;
    flex-direction: column;
    font-style: italic;
    /* justify-content: center; */
    /* max-width: 60ch; */
  }
  .title {
    font-size: 1.4rem;
    line-height: 1.3;
    margin: 0 0 0.4rem;
  }
  .excerpt {
    font-family: "Courier New", Courier, monospace;
    margin: 0;
    font-size: 1em;
    /* line-height: 1.2rem; */
  }
  .nav {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 2rem;
    background: none;
    color: #fff;
    border: none;
    cursor: pointer;
    font-size: 2rem;
    line-height: 1;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .nav.prev {
    left: 0;
  }
  .nav.next {
    right: 0;
  }
</style>
