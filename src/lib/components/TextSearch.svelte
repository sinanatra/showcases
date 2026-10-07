<script>
  // Search box that suggests words which actually occur in the reports (with
  // the number of reports each appears in), in the page language. Picking or
  // typing one filters the timeline. English searches the stored translations;
  // nothing is translated live.
  import { untrack } from "svelte";
  import { filters, articles } from "$lib/stores";
  import { lang, t } from "$lib/i18n";
  import { loadReportTranslations, englishText } from "$lib/utils/reportTranslations";

  const MAX_SUGGESTIONS = 12;

  let { showLabel = true } = $props();

  let value = $state($filters.text ?? "");
  let translationsReady = $state(false);
  $effect(() => {
    if ($lang === "en") loadReportTranslations().then(() => (translationsReady = true));
  });
  let english = $derived($lang === "en" && translationsReady);

  // every word of the material -> in how many reports it appears
  let vocabulary = $derived.by(() => {
    const counts = new Map();
    for (const a of $articles ?? []) {
      const text = english ? englishText(a) : `${a.Title || ""} ${a.Text || ""}`.toLowerCase();
      for (const word of new Set(text.match(/\p{L}[\p{L}-]{3,}/gu) ?? [])) {
        counts.set(word, (counts.get(word) ?? 0) + 1);
      }
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  });

  let suggestions = $derived.by(() => {
    const q = value.trim().toLowerCase();
    if (q.length < 2) return [];
    const starts = [], contains = [];
    for (const entry of vocabulary) {
      if (entry[0] === q) continue;
      if (entry[0].startsWith(q)) starts.push(entry);
      else if (contains.length < MAX_SUGGESTIONS && entry[0].includes(q)) contains.push(entry);
      if (starts.length >= MAX_SUGGESTIONS) break;
    }
    return [...starts, ...contains].slice(0, MAX_SUGGESTIONS);
  });

  let timer;
  function apply(text) {
    clearTimeout(timer);
    filters.update((f) => ({ ...f, text, textLang: english ? "en" : "" }));
  }
  function onInput(e) {
    value = e.target.value;
    clearTimeout(timer);
    timer = setTimeout(() => apply(value), 300);
  }
  // Something else reset the filters (e.g. "only the latest"): empty the box too.
  $effect(() => {
    if (!$filters.text) untrack(() => { if (value.trim()) value = ""; });
  });
  // Switching language changes what the text is matched against.
  $effect(() => {
    const textLang = english ? "en" : "";
    untrack(() => {
      if ($filters.text && $filters.textLang !== textLang) apply($filters.text);
    });
  });
</script>

<label>
  {#if showLabel}{$t("filters.search")}{/if}
  <input
    type="search"
    list="search-words"
    placeholder={$t("filters.searchPlaceholder")}
    {value}
    oninput={onInput}
    onchange={(e) => { value = e.currentTarget.value; apply(value); }}
    aria-label={$t("filters.search")}
    autocomplete="off"
  />
  <datalist id="search-words">
    {#each suggestions as [word, count]}
      <option value={word} label={String(count)}></option>
    {/each}
  </datalist>
</label>

<style>
  label {
    display: flex;
    gap: 0.2rem;
    align-items: center;
    font-family: Arial, sans-serif;
  }
  input[type="search"] {
    max-width: 100%;
    margin: 10px 0;
  }
</style>
