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
  <DataViz {urls} noZoom />
  <article class="story">{@html datum.text}</article>
{/if}

<style>
  .story {
    font-family: Arial, Helvetica, sans-serif;
    text-rendering: geometricPrecision;
    margin: 2rem auto;
    max-width: 70ch;
    color: #fff;
  }
</style>
