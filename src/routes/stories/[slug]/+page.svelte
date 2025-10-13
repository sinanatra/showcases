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
    max-width: 70ch;
    padding: 1rem;
    color: #fff;
    font-family: Arial, Helvetica, sans-serif;
    text-rendering: geometricPrecision;
    background-color: black;
  }
</style>
