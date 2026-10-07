<script>
  import { filtered, filters, getKeywordVariants } from "$lib/stores";
  import { lang } from "$lib/i18n";
  import { parseDateLoose } from "$lib/utils/parseDate";
  import { shorten, shortenAroundKeyword } from "$lib/utils/textUtils";
  import { splitSentences } from "$lib/utils/sentences";
  import { loadReportTranslations } from "$lib/utils/reportTranslations";

  const FONT_SIZE = 16;
  const LINE_HEIGHT = 22;
  const DATE_FONT_SIZE = 13;
  const SNIPPET_LENGTH = 200;
  const TICK_PX = 300; // one date label every this many pixels
  const RIGHT_PAD = 600; // room for the last rows' text
  const MAX_WIDTH = 10000;

  let translations = $state.raw({});
  $effect(() => {
    if ($lang === "en")
      loadReportTranslations().then((t) => (translations = t));
  });
  let english = $derived(
    $lang === "en" && Object.keys(translations).length > 0,
  );

  let fmtDate = $derived.by(() => {
    const locale = $lang === "de" ? "de-DE" : "en-GB";
    return (/** @type {Date} */ d) =>
      d.toLocaleDateString(locale, {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
  });

  function around(text, term) {
    const i = term ? text.toLowerCase().indexOf(term.toLowerCase()) : -1;
    if (i === -1) return { before: text, hit: "", after: "" };
    let end = i + term.length;
    while (end < text.length && /[\p{L}\p{N}]/u.test(text[end])) end++;
    return {
      before: text.slice(0, i),
      hit: text.slice(i, end),
      after: text.slice(end),
    };
  }

  /** The passage of a report around the word it matched (or the search text), in the page language. */
  function snippet(a) {
    const text = a.Text || "";
    const lower = text.toLowerCase();
    const own = [...(a.KeywordExtracted ?? []), ...(a.KeywordMatch ?? [])].map(
      String,
    );
    const wanted = $filters.keyword
      ? getKeywordVariants($filters.keyword).map((v) => v.toLowerCase())
      : [];
    const candidates = $filters.text
      ? [$filters.text]
      : [
          ...own.filter((k) =>
            wanted.some((v) => k.toLowerCase().startsWith(v)),
          ),
          ...own,
        ];
    const focus =
      candidates.find((c) => c && lower.includes(c.toLowerCase())) || "";

    if (english) {
      const sentences = splitSentences(text);
      if ($filters.text && $filters.textLang === "en") {
        // the search text is English: quote the translated sentence that contains it
        const q = $filters.text.toLowerCase();
        const hit = sentences
          .map((s) => translations[s])
          .find((en) => en && en.toLowerCase().includes(q));
        if (hit)
          return around(
            shortenAroundKeyword(hit, $filters.text, SNIPPET_LENGTH),
            $filters.text,
          );
      }
      const sentence =
        (focus &&
          sentences.find((s) =>
            s.toLowerCase().includes(focus.toLowerCase()),
          )) ||
        sentences[0];
      const en = sentence && translations[sentence];
      if (en) {
        const term = translations[focus.toLowerCase()] || "";
        const found = term && en.toLowerCase().includes(term.toLowerCase());
        return around(
          found
            ? shortenAroundKeyword(en, term, SNIPPET_LENGTH)
            : shorten(en, SNIPPET_LENGTH),
          found ? term : "",
        );
      }
    }
    return around(shortenAroundKeyword(text, focus, SNIPPET_LENGTH), focus);
  }

  let rows = $derived(
    ($filtered ?? [])
      .map((a) => ({ a, date: parseDateLoose(a.ExtractedDate || a.Date) }))
      .filter((r) => r.date && !isNaN(+r.date))
      .sort((x, y) => +y.date - +x.date)
      .map(({ a, date }) => ({ date, url: a.URL, ...snippet(a) })),
  );

  // Time runs left (newest) to right (oldest); the width grows with the time span.
  let scale = $derived.by(() => {
    if (!rows.length) return null;
    const end = +rows[0].date,
      start = +rows[rows.length - 1].date;
    const weeks = Math.max(1, (end - start) / (7 * 24 * 3600 * 1000));
    const viewport = typeof window === "undefined" ? 1200 : window.innerWidth;
    const width = Math.round(
      Math.min(
        MAX_WIDTH,
        Math.max(viewport, Math.min(weeks * 8, rows.length * 40)),
      ),
    );
    const x = (/** @type {Date} */ d) =>
      end === start ? 0 : ((end - +d) / (end - start)) * width;
    const ticks = [];
    for (let px = 0; px <= width; px += TICK_PX) {
      ticks.push({ x: px, date: new Date(end - (px / width) * (end - start)) });
    }
    return { width, x, ticks };
  });
</script>

{#if scale}
  <section style:width="{scale.width + RIGHT_PAD}px">
    <div class="dates" style:font-size="{DATE_FONT_SIZE}px">
      {#each scale.ticks as t}
        <span style:left="{t.x}px">{fmtDate(t.date)}</span>
      {/each}
    </div>

    <div class="rows" style:font-size="{FONT_SIZE}px">
      {#each scale.ticks as t}
        <div class="tickline" style:left="{t.x}px"></div>
      {/each}
      {#each rows as row}
        <a
          class="row"
          href={row.url}
          target="_blank"
          rel="noopener"
          style:margin-left="{scale.x(row.date)}px"
          style:height="{LINE_HEIGHT}px"
          style:line-height="{LINE_HEIGHT}px"
          >{row.before}<span class="highlight">{row.hit}</span>{row.after}<span
            class="date"
            style:font-size="{DATE_FONT_SIZE}px"
          >
            {fmtDate(row.date)} ↗</span
          ></a
        >
      {/each}
    </div>
  </section>
{/if}

<style>
  section {
    color: gainsboro;
    background-color: black;
    min-height: 100vh;
    padding: 0 20px 40px;
    box-sizing: content-box;
  }
  .dates {
    position: sticky;
    top: 0;
    z-index: 2;
    height: 36px;
    line-height: 36px;
    background-color: black;
  }
  .dates span {
    position: absolute;
    white-space: nowrap;
    color: gainsboro;
    opacity: 0.5;
  }
  .rows {
    position: relative;
  }
  .tickline {
    position: absolute;
    top: 0;
    height: 100%;
    border-left: 1px dashed gainsboro;
    opacity: 0.4;
    pointer-events: none;
  }
  .row {
    display: block;
    width: max-content;
    white-space: nowrap;
    font-style: italic;
    text-decoration: none;
    color: gainsboro;
    content-visibility: auto;
    contain-intrinsic-size: auto 600px auto 22px;
  }
  .row:hover {
    color: var(--color-1);
    text-decoration: underline;
  }
  .highlight,
  .date {
    font-style: normal;
    color: var(--color-1);
    padding-left: .5rem;
  }
</style>
