<script>
  let { posts = [], currentSlug = "" } = $props();

  const toSlug = (d) => (d?.path || "").replace(/^\/?texts\//, "");
  const isPublic = (d) => d?.meta?.isPublic !== false;
  const titleOf = (d) => d?.meta?.title || "";

  let related = $derived.by(() => {
    return posts
      .filter((d) => isPublic(d) && toSlug(d) !== currentSlug)
      .slice(0, 3);
  });
</script>

{#if related.length > 0}
  <section class="related">
    <div class="related-list">
      {#each related as story}
        <a
          class="related-item"
          data-sveltekit-reload
          href={`/stories/${toSlug(story)}`}
        >
          <span class="arrow">→</span>
          <span class="title">{titleOf(story)}</span>
        </a>
      {/each}
    </div>
  </section>
{/if}

<style>
  .related {
    margin-top: 1.5rem;
    padding-top: 1rem;
    border-top: 1px solid #444;
  }

  .related-list {
    display: flex;
    flex-direction: column;
    gap: .5rem;
  }

  .related-item {
    display: flex;
    align-items: center;
    gap: .5rem;
    padding: .5rem;
    background: rgba(255, 255, 255, 0.05);
    color: #fff;
    text-decoration: none;
  }

  .related-item:hover {
    /* background: rgba(255, 255, 255, 0.1); */
    color: var(--color-1, #fff);
  }

  .arrow {
    color: var(--color-1, #fff);
    font-weight: bold;
    flex-shrink: 0;
  }

  .title {
    flex: 1;
    font-size: 1.1rem;
  }
</style>
