<script>
  import { availableKeywordsLabeled } from "$lib/stores";
  import SelectFilter from "$lib/components/SelectFilter.svelte";

  let { showLabel = true } = $props();
</script>

<SelectFilter filterKey="keyword" labelKey="filters.keyword" options={$availableKeywordsLabeled} {showLabel} />
