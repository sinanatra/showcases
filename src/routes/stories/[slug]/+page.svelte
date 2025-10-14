<script>
  import { onMount } from "svelte";
  import * as d3 from "d3";
  import { articles } from "$lib/stores";
  import DataViz from "$lib/components/DataViz.svelte";
  import { page } from "$app/stores";

  export let data;

  let datum = data.posts.find((d) => d.path.includes($page.params.slug));

  $: slug = $page.params.slug;
  $: datum = data?.posts?.find((d) => d.path?.includes(slug)) ?? null;
  $: urls = datum?.meta?.urls ?? [];
  $: excerpt = datum?.meta?.excerpt ?? "";

  //   console.log(datum);
  onMount(async () => {
    const raw = await d3.csv("/all_merged.csv");
    articles.set(raw);
  });
</script>

{#if datum}
  <section class="viz">
    <DataViz {urls} noZoom />
  </section>

  <article class="story">
    {#if excerpt.length > 0}
      <div class="excerpt">
        <p>
          {excerpt}
        </p>
      </div>
    {/if}
    {@html datum.text}
  </article>
{/if}

<style>
  .viz {
    position: sticky;
    top: 0;
    height: 80vh;
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
  }

  .excerpt {
    display: flex;
    justify-content: flex-end;
    color: #aaa;
    font-size: 0.75rem;
    line-height: 0.75rem;
    text-align: right;
  }

  .excerpt p {
    font-family: "Courier New", Courier, monospace;
    max-width: 400px;
  }
</style>
