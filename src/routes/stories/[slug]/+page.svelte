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
  $: caption = datum?.meta?.caption ?? "";
  $: viz = datum?.meta?.viz ?? "";

  onMount(async () => {
    const raw = await d3.csv("/all_merged.csv");
    const normalized = raw.map((d) => ({
      ...d,
      KeywordMatch:
        typeof d.KeywordMatch === "string"
          ? d.KeywordMatch.replace(/[\[\]'"]/g, "")
              .split(/[,;]/)
              .map((s) => s.trim())
              .filter(Boolean)
          : Array.isArray(d.KeywordMatch)
            ? d.KeywordMatch
            : [],
      Text: d.Text || "",
      URL: d.URL || "",
      Title: d.Title || "",
      ExtractedGender: Array.isArray(d.ExtractedGender)
        ? d.ExtractedGender
        : d.ExtractedGender
          ? [d.ExtractedGender]
          : [],
      ExtractedTime: Array.isArray(d.ExtractedTime)
        ? d.ExtractedTime
        : d.ExtractedTime
          ? [d.ExtractedTime]
          : [],
    }));
    articles.set(normalized);
  });
</script>

{#if datum}
  <section class="viz">
    <DataViz {urls} growthMode={viz} noZoom />
  </section>

  <article class="story">
    {#if caption.length > 0}
      <div class="caption">
        <p>
          {caption}
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
    font-family: "Courier New", Courier, monospace;
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
    font-family: "Courier New", Courier, monospace;
    max-width: 400px;
  }
</style>
