<script>
  let { data } = $props();
  const toSlug = (d) => (d?.path || "").replace(/^\/?texts\//, "");
  const isPublic = (d) => d?.meta?.isPublic !== false;
  const titleOf = (d) => d?.meta?.title || "";
  const excerptOf = (d) => d?.meta?.excerpt || "";
</script>

<main>
  {#each data?.posts ?? [] as d}
    {#if isPublic(d)}
      <a class="card" href={`/stories/${toSlug(d)}`}>
        <h2 class="title">{titleOf(d)}</h2>
        {#if excerptOf(d)}<p class="excerpt">{excerptOf(d)}</p>{/if}
      </a>
    {:else}
      <div class="card disabled" aria-disabled="true">
        <h2 class="title">{titleOf(d)}</h2>
        {#if excerptOf(d)}<p class="excerpt">{excerptOf(d)}</p>{/if}
      </div>
    {/if}
  {/each}
</main>

<style>
  main {
    font-family: Arial, Helvetica, sans-serif;
    max-width: 720px;
    display: grid;
    gap: 1rem;
    padding: 1rem;
  }
  .card {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 1.25rem;
    background: rgba(255, 255, 255, 0.05);
    color: #fff;
    text-decoration: none;
  }
  .card:hover {
    /* background: var(--color-1); */
    color: var(--color-1);
  }
  .card.disabled {
    opacity: 0.6;
    cursor: not-allowed;
    pointer-events: none;
    background: rgba(255, 255, 255, 0.05);
  }
  .title {
    font-size: 1.8rem;
    line-height: 1.2;
    margin: 0;
  }
  .excerpt {
    margin: 0;
    font-size: 1rem;
    line-height: 1.4;
    max-width: 60ch;
  }
</style>
