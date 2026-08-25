<script>
  import { filtered, filters } from "$lib/stores";
  import { onMount, onDestroy, tick } from "svelte";
  import { browser } from "$app/environment";
  import { lang } from "$lib/i18n";
  import { translateDE_EN } from "$lib/utils/translate";
  import { shortenAroundKeyword } from "$lib/utils/textUtils";

  function typescale(size) {
    return { fontSize: size, lineHeight: Math.round(size * 1.4), dateFontSize: Math.round(size * 0.8) };
  }
  const { fontSize, lineHeight, dateFontSize } = typescale(16);
  const yOffset = 0;
  const leftPad = 0;
  const rightPad = 600;
  const tickPx = 300;
  const bufferRows = 60;

  let sectionEl;
  let timelineContainer;
  let datesBar;
  let sectionTop = 0;
  let rafId = null;

  function measureSectionTop() {
    if (!sectionEl) return;
    sectionTop = sectionEl.getBoundingClientRect().top + window.scrollY;
  }

  function parseDate(dStr, tStr = "00:00") {
    if (!dStr) return null;
    const [d, m, y] = String(dStr).split(".");
    const [hh = "00", mm = "00"] = String(tStr || "00:00").split(":");
    const dt = new Date(+y, (+m || 1) - 1, +d, +hh, +mm);
    return isNaN(+dt) ? null : dt;
  }

  let fmtDate;
  $: {
    const locale = $lang === "de" ? "de-DE" : "en-GB";
    fmtDate = (d) =>
      d.toLocaleDateString(locale, {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
  }

  // Translation
  let translatedMap = {};
  function snippetKey(item) { return item.before + item.match + item.after; }
  function origKey(item) { return item.origBefore + item.origMatch + item.origAfter; }
  function splitAround(text, term) {
    if (!term || !text) return null;
    const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    // try exact, then progressively shorter prefixes down to 4 chars
    const minLen = Math.min(4, term.length);
    for (let len = term.length; len >= minLen; len = Math.max(minLen, Math.floor(len * 0.75))) {
      const rx = new RegExp(esc(term.slice(0, len)) + "\\w*", "i");
      const m = rx.exec(text);
      if (m) return { pre: text.slice(0, m.index), hit: m[0], post: text.slice(m.index + m[0].length) };
      if (len === minLen) break;
    }
    return null;
  }
  async function translateVisible() {
    const seen = new Set(Object.keys(translatedMap));
    const toAdd = new Map();
    for (const item of visible) {
      const sKey = snippetKey(item);
      if (!seen.has(sKey)) toAdd.set(sKey, translateDE_EN(sKey));
      if (item.match) {
        const kKey = `__k:${item.match}`;
        if (!seen.has(kKey)) toAdd.set(kKey, translateDE_EN(item.match));
      }
      const oKey = origKey(item);
      if (!seen.has(oKey)) toAdd.set(oKey, translateDE_EN(oKey));
      if (item.origMatch) {
        const okKey = `__ok:${item.origMatch}`;
        if (!seen.has(okKey)) toAdd.set(okKey, translateDE_EN(item.origMatch));
      }
    }
    if (!toAdd.size) return;
    const results = await Promise.all([...toAdd.entries()].map(async ([k, p]) => [k, await p]));
    translatedMap = { ...translatedMap, ...Object.fromEntries(results) };
  }
  $: if ($lang === "en" && visible.length) translateVisible();

  let rows = [];
  let start = null;
  let end = null;
  let ticks = [];
  let timelineWidth = 2400;
  let totalWidth = 2400 + leftPad + rightPad;

  let visibleStart = 0;
  let visibleEnd = 0;
  let visible = [];
  let syncingScroll = false;
  let scheduleResetX = false;
  let filteredUnsub;

  // The date header must stay pinned to the viewport while the page scrolls
  // vertically, which requires it to NOT be inside a container that
  // establishes its own vertical scrollport (position:sticky only sticks to
  // the nearest scrolling ancestor — and per the CSS overflow spec, giving
  // an element overflow-x without overflow-y forces overflow-y to "auto"
  // too, silently turning it into one). So the header and the row content
  // stay two siblings, each independently horizontally scrollable, with
  // their scrollLeft kept in sync here. Vertical and horizontal scrolling
  // are otherwise fully independent — nothing auto-scrolls the timeline
  // horizontally as you scroll the page vertically.
  function syncScrollLeft(/** @type {HTMLElement} */ from, /** @type {HTMLElement} */ to) {
    if (syncingScroll) return;
    syncingScroll = true;
    to.scrollLeft = from.scrollLeft;
    syncingScroll = false;
  }

  function onBarScroll() {
    if (!datesBar || !timelineContainer) return;
    syncScrollLeft(datesBar, timelineContainer);
  }

  function onContainerHScroll() {
    if (!datesBar || !timelineContainer) return;
    syncScrollLeft(timelineContainer, datesBar);
  }

  function updateVisible() {
    const rowsStartY = sectionTop + yOffset;
    const first = Math.max(
      0,
      Math.floor((window.scrollY - rowsStartY) / lineHeight) - bufferRows
    );
    const last = Math.min(
      rows.length,
      Math.ceil(
        (window.scrollY + window.innerHeight - rowsStartY) / lineHeight
      ) + bufferRows
    );
    if (first !== visibleStart || last !== visibleEnd) {
      visibleStart = first;
      visibleEnd = last;
      visible = rows.slice(visibleStart, visibleEnd);
    }
  }

  async function resetX() {
    if (!browser || !timelineContainer) return;
    await tick();
    timelineContainer.scrollTo({ left: 0, behavior: "auto" });
    if (datesBar) datesBar.scrollLeft = 0;
  }

  $: if (scheduleResetX) {
    scheduleResetX = false;
    resetX();
  }

  $: {
    const src = Array.isArray($filtered) ? $filtered : [];
    const mapped = src
      .map((a) => {
        const t0 =
          Array.isArray(a.ExtractedTime) && a.ExtractedTime[0]
            ? a.ExtractedTime[0]
            : "00:00";
        const d = parseDate(a.ExtractedDate || a.Date, t0);
        if (!d) return null;
        const text = a.Text || "";
        const keywords = [
          ...(Array.isArray(a.KeywordMatch) ? a.KeywordMatch : []),
          ...(Array.isArray(a.KeywordExtracted) ? a.KeywordExtracted : []),
        ].filter(Boolean);
        const candidates = [$filters.text, ...keywords].filter(Boolean);
        const kw = candidates.find(c => text.toLowerCase().includes(String(c).toLowerCase())) || candidates[0] || "";
        const snippet = shortenAroundKeyword(text, kw, 200);
        const sp = kw ? splitAround(snippet, kw) : null;
        const before = sp ? sp.pre : snippet;
        const match = sp ? sp.hit : "";
        const after = sp ? sp.post : "";
        const origKw = keywords[0] || "";
        const origSnippet = origKw ? shortenAroundKeyword(text, origKw, 200) : text.slice(0, 200);
        const origSp = origKw ? splitAround(origSnippet, origKw) : null;
        const origBefore = origSp ? origSp.pre : origSnippet;
        const origMatch = origSp ? origSp.hit : "";
        const origAfter = origSp ? origSp.post : "";
        return { date: d, before, match, after, origBefore, origMatch, origAfter, url: a.URL };
      })
      .filter(Boolean)
      .sort((a, b) => b.date - a.date);

    rows = mapped;

    if (rows.length) {
      const dates = rows.map((r) => +r.date);
      const minDate = new Date(Math.min(...dates));
      const maxDate = new Date(Math.max(...dates));
      start = minDate;
      end = maxDate;
      const viewportW =
        timelineContainer?.clientWidth ||
        sectionEl?.clientWidth ||
        (browser ? window.innerWidth : 1200);
      const msWeek = 7 * 24 * 60 * 60 * 1000;
      const spanWeeks = Math.max(1, Math.round((+end - +start) / msWeek));
      const density = rows.length / spanWeeks;
      const pxPerWeek = Math.min(
        16,
        Math.max(3, 10 / Math.max(0.5, Math.log10(density + 1)))
      );
      const byTime = spanWeeks * pxPerWeek;
      const byCount = rows.length * 40;
      const targetWidth = Math.max(viewportW, Math.min(byTime, byCount));
      timelineWidth = Math.min(10000, Math.round(targetWidth));
      totalWidth = leftPad + timelineWidth + rightPad;
      ticks = [];
      const nTicks = Math.max(1, Math.floor(timelineWidth / tickPx));
      for (let i = 0; i <= nTicks; i++) {
        const x = leftPad + i * tickPx;
        const frac = Math.min(1, Math.max(0, (x - leftPad) / timelineWidth));
        const t = +end - frac * (+end - +start);
        ticks.push({ x, d: new Date(t) });
      }
      // always refresh visible slice when rows rebuild (content may have changed)
      // use updateVisible() so visibleStart/visibleEnd are recalculated from
      // current scroll position — otherwise initial async data load renders nothing
      // because visibleEnd is still 0 when the first real rows arrive
      if (browser) { measureSectionTop(); updateVisible(); }
    } else {
      start = null;
      end = null;
      ticks = [];
      visible = [];
      visibleStart = 0;
      visibleEnd = 0;
    }
  }

  function normPos(date) {
    if (!start || !end || +end - +start === 0) return leftPad;
    return leftPad + ((+end - +date) / (+end - +start)) * timelineWidth;
  }

  function rafSync() {
    rafId = null;
    if (!timelineContainer) return;
    updateVisible();
  }

  function onWinScroll() {
    if (rafId === null) rafId = requestAnimationFrame(rafSync);
  }

  function onWinResize() {
    measureSectionTop();
    onWinScroll();
  }

  onMount(() => {
    if (!browser) return;
    measureSectionTop();
    window.addEventListener("scroll", onWinScroll, { passive: true });
    window.addEventListener("resize", onWinResize, { passive: true });
    filteredUnsub = filtered.subscribe(async () => {
      scheduleResetX = true;
    });
    onWinScroll();
  });

  onDestroy(() => {
    if (!browser) return;
    window.removeEventListener("scroll", onWinScroll);
    window.removeEventListener("resize", onWinResize);
    if (rafId !== null) cancelAnimationFrame(rafId);
    if (filteredUnsub) filteredUnsub();
  });

  let showSnippet = true;

</script>

<section bind:this={sectionEl}>
  {#if rows.length === 0}
    <p></p>
  {:else}
    <div
      class="datesBar"
      bind:this={datesBar}
      on:scroll|passive={onBarScroll}
    >
      <div class="datesInner" style:width="{totalWidth}px">
        {#each ticks as t}
          <div class="date tick" style:left="{t.x}px" style:font-size="{dateFontSize}px">{fmtDate(t.d)}</div>
        {/each}
      </div>
    </div>

    <div
      class="timelineContainer"
      bind:this={timelineContainer}
      on:scroll|passive={onContainerHScroll}
    >
      <div
        class="rows"
        style:width="{totalWidth}px"
        style:height="{yOffset + rows.length * lineHeight + 40}px"
      >
        {#each ticks as t}
          <div class="tickline" style:left="{t.x}px"></div>
        {/each}

        {#each visible as item, i (visibleStart + i)}
          {@const isEN = $lang === "en"}
          {@const sKey = snippetKey(item)}
          {@const ts = translatedMap[sKey]}
          {@const tk = item.match ? translatedMap[`__k:${item.match}`] : ""}
          {@const enSplit = isEN && ts ? (
            splitAround(ts, tk || "") ||
            (tk && tk.includes(" ") ? tk.split(" ").reduce((acc, w) => acc || splitAround(ts, w), null) : null) ||
            splitAround(ts, item.match || "")
          ) : null}
          {@const oKey = origKey(item)}
          {@const to = translatedMap[oKey]}
          {@const tok = item.origMatch ? (/** @type {any} */(translatedMap))[`__ok:${item.origMatch}`] : ""}
          {@const enOrigSplit = isEN && to ? (
            splitAround(to, tok || "") ||
            splitAround(to, item.origMatch || "")
          ) : null}
          <a
            href={item.url}
            target="_blank"
            rel="noopener"
            class="row"
            style:left="{normPos(item.date)}px"
            style:top="{yOffset + (visibleStart + i) * lineHeight}px"
            style:height="{lineHeight}px"
            style:line-height="{lineHeight}px"
            style:font-size="{fontSize}px"
          >
            {#if !showSnippet}
              {#if isEN && enOrigSplit}
                <span class="text">{enOrigSplit.pre}</span><span class="highlight">{enOrigSplit.hit}</span><span class="text">{enOrigSplit.post}</span>
              {:else if isEN && to}
                <span class="text">{to}</span>
              {:else}
                <span class="text">{item.origBefore}</span><span class="highlight">{item.origMatch}</span><span class="text">{item.origAfter}</span>
              {/if}
            {:else if isEN}
              {#if enSplit}
                <span class="text">{enSplit.pre}</span><span class="highlight">{enSplit.hit}</span><span class="text">{enSplit.post}</span>
              {:else}
                <span class="text">{ts ?? sKey}</span>
              {/if}
            {:else}
              <span class="text">{item.before}</span>
              <span class="highlight">{item.match}</span>
              <span class="text">{item.after}</span>
            {/if}
            <span class="date" style:font-size="{dateFontSize}px"> {fmtDate(item.date)} ↗</span>
          </a>
        {/each}
      </div>
    </div>

    {#if $filters.text}
      <button class="snippet-toggle" on:click={() => (showSnippet = !showSnippet)}>
        {showSnippet ? "snippet" : "original"}
      </button>
    {/if}
  {/if}
</section>

<style>
  section {
    display: flex;
    flex-direction: column;
    color: white;
    background-color: black;
    min-height: 100vh;
    padding: 16px 20px 0;
    box-sizing: border-box;
    text-rendering: geometricPrecision;
  }
  .timelineContainer {
    overflow: auto;
    flex-grow: 1;
    will-change: scroll-position;
  }
  .datesBar {
    /* a sibling of .timelineContainer (not nested inside it) so it isn't
       itself inside a vertical scroll container — that's what lets
       position:sticky pin it to the viewport as the page scrolls. Its own
       horizontal scroll position is kept in sync with .timelineContainer
       via JS (see onBarScroll/onContainerHScroll). */
    position: sticky;
    top: 0;
    background-color: black;
    overflow-x: auto;
    overflow-y: hidden;
    height: 36px;
    will-change: scroll-position;
    z-index: 2;
  }
  .datesBar::-webkit-scrollbar {
    height: 0;
    display: none;
  }
  .datesInner {
    position: relative;
    height: 36px;
  }
  .tick {
    position: absolute;
    top: 0;
    line-height: 36px;
    white-space: nowrap;
  }
  .rows {
    position: relative;
  }
  .tickline {
    /* top/height tied exactly to .rows's own box (100%), not computed in px —
       any mismatch here inflates .timelineContainer's scrollable area past
       its visible box and produces a second, almost-invisible scrollbar */
    position: absolute;
    top: 0;
    height: 100%;
    width: 1px;
    border-left: 1px dashed var(--color-1);
  }
  .row {
    /* plain inline flow, not flex — flex would make each <span> its own
       flex item, and each item's own leading/trailing whitespace gets
       trimmed at its box edge, silently eating the spaces around the
       highlighted word */
    position: absolute;
    white-space: nowrap;
    font-style: italic;
    text-decoration: none;
  }
  .snippet-toggle {
    position: fixed;
    top: 8px;
    right: 8px;
    z-index: 10;
    background: rgba(0, 0, 0, 0.8);
    color: var(--color-1, gainsboro);
    border: 1px solid var(--color-1, gainsboro);
    font-family: var(--font-mono);
    font-size: 11px;
    cursor: pointer;
    padding: 3px 8px;
  }
  .snippet-toggle:hover {
    background: var(--color-1, gainsboro);
    color: black;
  }
  .row:hover {
    color: var(--color-1);
    text-decoration: underline;
  }
  .highlight {
    font-weight: 400;
    font-style: normal;
    color: var(--color-1);
  }
  .date,
  .row {
    color: gainsboro;
  }
  .date {
    color: var(--color-1);
    font-style: normal;
  }
</style>
