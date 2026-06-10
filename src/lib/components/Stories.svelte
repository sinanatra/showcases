<script>
  let { data } = $props();
  const toSlug = (d) => (d?.path || "").replace(/^\/?texts\//, "");
  const isPublic = (d) => d?.meta?.isPublic !== false;
  const titleOf = (d) => d?.meta?.title || "";
  const excerptOf = (d) => d?.meta?.excerpt || "";
  const items = (data?.posts ?? []).filter(isPublic);
</script>

{#if items.length > 0}
  <ul class="list">
    {#each items as d}
      <li>
        <a href={`/stories/${toSlug(d)}`}>
          <span class="arrow">→</span>
          <span class="title">{titleOf(d)}</span>
          <!-- {#if excerptOf(d)}
            <span class="excerpt">{excerptOf(d)}</span>
          {/if} -->
        </a>
      </li>
    {/each}
  </ul>
{/if}

<style>
  .list {
    list-style: none;
    margin: 0 auto;
    padding: 0 1rem;
    display: flex;
    flex-direction: column;
    max-height: 70vh;
    max-width: 480px;
    overflow-y: auto;
    margin-top: -15rem;
  }

  .arrow {
    color: var(--color-1, #fff);
    font-weight: bold;
    flex-shrink: 0;
  }

  .list a {
    width: fit-content;
    display: flex;
    gap: 1rem;
    align-items: baseline;
    color: #fff;
    background: black;
    text-decoration: none;
    padding: 0.4rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    overflow: hidden;
  }

  .list a:hover {
    color: var(--color-1);
  }

  .title {
    font-size: 1.1rem;
    font-style: italic;
    flex-shrink: 0;
  }

  .excerpt {
    max-width: 240px;
    font-family: var(--font-mono);
    font-size: 0.85em;
    opacity: 0.55;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
