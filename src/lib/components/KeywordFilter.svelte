<script>
  import { availableKeywordsLabeled } from "$lib/stores";
  import SelectFilter from "$lib/components/SelectFilter.svelte";
</script>

<SelectFilter filterKey="keyword" labelKey="filters.keyword" options={$availableKeywordsLabeled} />
