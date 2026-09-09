<script>
  import { availableRegions } from "$lib/stores";
  import SelectFilter from "$lib/components/SelectFilter.svelte";

  const labels = { berlin: "Berlin", brandenburg: "Brandenburg" };
</script>

<SelectFilter
  filterKey="region"
  labelKey="filters.region"
  options={$availableRegions}
  getLabel={(r) => labels[r] ?? r}
/>
