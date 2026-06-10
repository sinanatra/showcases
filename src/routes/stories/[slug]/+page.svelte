<script>
  import { loadArticles } from "$lib/utils/loadArticles";
  import DataViz from "$lib/components/DataViz.svelte";
  import RelatedArticles from "$lib/components/RelatedArticles.svelte";
  import { page } from "$app/stores";

  let { data } = $props();

  let markdownComponent = $state(null);

  let slug = $derived($page.params.slug);
  let datum = $derived(data?.posts?.find((d) => d.path?.includes(slug)) ?? null);

  $effect(() => {
    if (datum) {
      import(`../../texts/${slug}.md`).then((module) => {
        markdownComponent = module.default;
      }).catch((err) => {
        console.warn(`Could not load markdown component for ${slug}:`, err);
        markdownComponent = null;
      });
    }
  });
  let urls = $derived(datum?.meta?.urls ?? []);
  let caption = $derived(datum?.meta?.caption ?? "");
  let viz = $derived(datum?.meta?.viz ?? "");
  let loop = $derived(datum?.meta?.loop ?? false);

  let storyDataLoaded = $state(false);

  $effect(() => {
    if (storyDataLoaded) return;
    loadArticles()
      .then(() => { storyDataLoaded = true; })
      .catch((err) => console.error("Failed to load story data:", err));
  });
</script>

{#if datum}
  <section class="viz">
    {#if viz}
      <DataViz
        {urls}
        growthMode={viz}
        noZoom
        autoCycle={loop}
        growthModeFixed="true"
      />
    {/if}
  </section>

  <article class="story">
    {#if caption.length > 0}
      <div class="caption">
        <p>
          {caption}
        </p>
      </div>
    {/if}
    {#if markdownComponent}
      <svelte:component this={markdownComponent} />
    {/if}

    <RelatedArticles posts={data?.posts ?? []} currentSlug={slug} />
  </article>
{/if}

<style>
  .viz {
    position: sticky;
    top: 0;
    height: 50vh;
    width: 100%;
    z-index: 0;
  }

  .story {
    position: relative;
    z-index: 1;
    margin: 0 auto;
    max-width: 650px;
    padding: 10px;
    color: #fff;
    font-family: Arial, Helvetica, sans-serif;
    text-rendering: geometricPrecision;
    background-color: black;
    font-size: 1rem;
    line-height: 1.2rem;
  }

  :global(.story h1),
  :global(.story h2),
  :global(.story h3),
  :global(.story h4),
  :global(.story h5),
  :global(.story p) {
    margin-bottom: 1rem;
    font-weight: 400;
  }
  :global(.story p) {
    text-indent: 2em;
  }

  :global(.story h1) {
    font-size: 3em;
    margin-bottom: 0.5em;
  }

  :global(.story a) {
    color: var(--color-1);
  }

  :global(.story blockquote) {
    font-family: var(--font-mono);
  }

  .caption {
    display: flex;
    justify-content: flex-end;
    color: #aaa;
    font-size: 0.8rem;
    line-height: 0.8rem;
    text-align: right;
    font-style: italic;
  }

  .caption p {
    font-family: var(--font-mono);
    max-width: 400px;
  }
</style>
