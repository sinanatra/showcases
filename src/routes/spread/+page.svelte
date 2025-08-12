<script>
  import { onMount } from "svelte";
  import * as d3 from "d3";
  import { articles } from "$lib/stores";
  import DataControls from "$lib/components/DataControls.svelte";
  import DataViz from "$lib/components/DataViz.svelte";

  onMount(async () => {
    const raw = await d3.csv("all_merged.csv");
    articles.set(
      raw.map((d) => ({
        ...d,
        KeywordMatch:
          typeof d.KeywordMatch === "string"
            ? d.KeywordMatch.replace(/[\[\]'"]/g, "")
                .split(/[,;]/)
                .map((s) => s.trim())
                .filter(Boolean)
            : [],
        Text: d.Text || "",
        URL: d.URL || "",
        Title: d.Title || "",
      }))
    );
  });
</script>

<DataControls />
<DataViz />

<style>
  :global(body) {
    background: #000;
  }
</style>
