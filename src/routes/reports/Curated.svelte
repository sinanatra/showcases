<script>
  // {n} and {total} in curated.json are counted from the data
  import { articles, applyFilters } from "$lib/stores";
  import { lang } from "$lib/i18n";
  import views from "./curated.json";

  let { active = $bindable(null) } = $props();

  const note = $derived.by(() => {
    if (!active) return "";
    const n = applyFilters($articles, { ...active.filters, textLang: "both" }).length;
    return ($lang === "de" ? active.textDe : active.text)
      .replace("{n}", n.toLocaleString($lang))
      .replace("{total}", $articles.length.toLocaleString($lang));
  });

</script>

<div class="views">
  {#each views as view (view.id)}
    <button class:active={view === active} onclick={() => (active = view === active ? null : view)}>
      {$lang === "de" ? view.labelDe : view.label}
    </button>
  {/each}
</div>
{#if note}
  <p><span class="line-bg">{note}</span></p>
{/if}

<style>
  .views {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 5px;
  }
  button {
    padding: 5px 10px;
    font-family: Arial, Helvetica, sans-serif;
    font-size: 16px;
    background: #fff;
    color: #000;
    border: 1px solid #000;
    border-radius: 0;
    cursor: pointer;
  }
  .active {
    background: #000;
    color: #fff;
  }
  p {
    max-width: 680px;
    font-family: Arial, Helvetica, sans-serif;
    font-size: 16px;
    line-height: 1.4;
  }
  @media (max-width: 700px) {
    .views {
      flex-wrap: nowrap;
      justify-content: flex-start;
      overflow-x: auto;
      scrollbar-width: none;
    }
    button {
      flex: none;
    }
    p {
      font-size: 14px;
    }
  }
</style>
