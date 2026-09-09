<script>
  import { availableGendersLabeled } from "$lib/stores";
  import SelectFilter from "$lib/components/SelectFilter.svelte";
</script>

<SelectFilter filterKey="gender" labelKey="filters.gender" options={$availableGendersLabeled} />
