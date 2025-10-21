<script>
  export let data;
  //   console.log(data);
</script>

<main>
  {#each data.posts as d}
    {#if d?.meta?.isPublic == false}
      <span class="story disabled" aria-disabled="true">{d.meta.title}</span>
    {:else}
      <a class="story" href={`/stories/${d.path.replace(/^\/?texts\//, "")}`}
        >{d.meta.title}</a
      >
    {/if}
  {/each}
</main>

<style>
  main {
    font-family: Arial, Helvetica, sans-serif;
    max-width: 600px;
    /* margin: auto; */
    display: flex;
    flex-direction: column;
    gap: 1em;
    padding: 1em;
    /* text-align: center; */
  }

  a {
    font-size: 2rem;
    margin-bottom: 1rem;
    color: white;
    text-decoration: none;
  }

  .story {
    font-size: 3rem;
    /* margin-bottom: 2rem; */
    color: white;
    text-decoration: none;
  }

  .story:not(.disabled):hover {
    text-decoration: underline;
  }

  .story.disabled {
    color: #7a7a7a;
    pointer-events: none;
    cursor: not-allowed;
    text-decoration: none;
  }

  a:hover {
    text-decoration: underline;
  }
</style>
