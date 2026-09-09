<script>
  import { availableDistricts } from "$lib/stores";
  import SelectFilter from "$lib/components/SelectFilter.svelte";
</script>

<SelectFilter filterKey="district" labelKey="filters.district" options={$availableDistricts} />
