<script>
  import { filtered } from "$lib/stores";
  import ArticleItem from "./ArticleItem.svelte";

  function parseDate(str) {
    if (!str) return new Date(0);
    const [d, m, y] = str.split(".");
    return new Date(+y, +m - 1, +d);
  }

  let minDateStr = "01.01.2024"; 
  let minDate = parseDate(minDateStr);

  $: filteredByDate = $filtered.filter(a => parseDate(a.Date) >= minDate);

//   $: console.log(filteredByDate);
</script>

{#if filteredByDate.length === 0}
  <p>No articles match the selected filters.</p>
{:else}
  {#each filteredByDate.sort((a, b) => parseDate(b.Date) - parseDate(a.Date)) as article}
    <ArticleItem {article} />
  {/each}
{/if}