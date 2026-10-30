<script>
  // Search box that suggests words which actually occur in the reports (with
  // the number of reports each appears in), in the page language. Picking or
  // typing one filters the timeline. English searches the stored translations;
  // nothing is translated live.
  import { untrack } from "svelte";
  import { filters, articles, applyFilters } from "$lib/stores";
  import { lang, t } from "$lib/i18n";
  import { loadReportTranslations, englishText } from "$lib/utils/reportTranslations";

  let { textLang = null } = $props();

  const MAX_SUGGESTIONS = 12;

  let value = $state($filters.text ?? "");
  let translationsReady = $state(false);
  $effect(() => {
    if ($lang === "en") loadReportTranslations().then(() => (translationsReady = true));
  });
  let english = $derived($lang === "en" && translationsReady);
  let matchLang = $derived(textLang ?? (english ? "en" : ""));

  // the suggestions only change with the other filters, not with every search
  let scope = $derived([$filters.region, $filters.district, $filters.keyword, $filters.year].join("|"));

  let vocabulary = $derived.by(() => {
    scope;
    const list = $articles ?? [];
    const pool = untrack(() => applyFilters(list, { ...$filters, text: "" }));
    const counts = new Map();
    for (const a of pool) {
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
    filters.update((f) => ({ ...f, text, textLang: matchLang }));
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
    const target = matchLang;
    untrack(() => {
      if ($filters.text && $filters.textLang !== target) apply($filters.text);
    });
  });
</script>

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
