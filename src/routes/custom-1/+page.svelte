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
      }))
    );
  });

  const urls = [
    "https://www.berlin.de/polizei/polizeimeldungen/2025/pressemitteilung.1604726.php",
    "https://www.berlin.de/polizei/polizeimeldungen/2025/pressemitteilung.1604492.php",
    "https://polizei.brandenburg.de/pressemeldung/baum-besudelt/5689227",
  ];
</script>

<DataViz {urls} />

<style>
  :global(body) {
    background: #000;
  }
</style>
