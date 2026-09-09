<script>
  import { availableTimeClustersLabeled } from "$lib/stores";
  import SelectFilter from "$lib/components/SelectFilter.svelte";
</script>

<SelectFilter
  filterKey="timeCluster"
  labelKey="filters.timeOfDay"
  options={$availableTimeClustersLabeled}
/>
