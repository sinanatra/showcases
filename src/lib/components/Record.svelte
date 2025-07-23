<script>
  import { record } from "$lib/stores.js";
</script>

<button on:click={() => record.update((v) => !v)}>
  {$record ? "Stop Recording" : "Start Recording"}
</button>

<style>
  button {
    position: fixed;
    top: 10px;
    left: 10px;
  }
</style>
