<script>
  import { loadArticles } from "$lib/utils/loadArticles";
  import DataControls from "$lib/components/DataControls.svelte";
  import DataViz from "$lib/components/DataViz.svelte";

  let loaded = $state(false);

  $effect(() => {
    if (loaded) return;
    loadArticles()
      .then(() => { loaded = true; })
      .catch((err) => console.error("Failed to load latest data:", err));
  });
</script>

<DataControls />
<DataViz autoCycle={true} />

<style>
  :global(body) {
    background: #000;
  }
</style>
