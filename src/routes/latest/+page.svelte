<script>
  import { loadArticles } from "$lib/utils/loadArticles";
  import DataControls from "$lib/components/DataControls.svelte";
  import DataViz from "$lib/components/DataViz.svelte";
  import { isMobile } from "$lib/stores";

  let loaded = $state(false);

  $effect(() => {
    if (loaded) return;
    loadArticles()
      .then(() => { loaded = true; })
      .catch((err) => console.error("Failed to load latest data:", err));
  });
</script>

<DataControls />
<DataViz autoCycle={true} startPan={{ x: 0, y: $isMobile ? 300 : 0 }} />

<style>
  :global(body) {
    background: #000;
  }
</style>
