<svelte:options namespace="svg" />

<script>
  import {
    FS,
    CHAR_W,
    DIST_FS,
    DIST_CW,
    DIST_GAP,
    STACK_GAP,
  } from "./config.js";

  const DE_TEXT = "#000";
  const EN_TEXT = "#000";
  const DIST_TEXT = "#999";

  let {
    placed,
    baseline,
    textAlign = "start",
    translatedMap = {},
    langMode = "both",
  } = $props();

  const gradId = (color) => `grad-${String(color).replace("#", "")}`;
  let uniqueColors = $derived([
    ...new Set(
      placed.flatMap((item) =>
        (item.segments?.length ? item.segments : [{ color: item.color }]).map(
          (s) => s.color ?? item.color,
        ),
      ),
    ),
  ]);
</script>

<!-- one gradient per color, reused by every box of that color: objectBoundingBox
     units make it sweep left-to-right across each rect's own width. -->
<defs>
  {#each uniqueColors as c}
    <linearGradient id={gradId(c)} x1="0" x2="1" y1="0" y2="0">
      <!-- <stop offset="0%" stop-color="white" /> -->
      <stop offset="0%" stop-color={c} />
      <stop offset="40%" stop-color="white" />
    </linearGradient>
  {/each}
</defs>

{#each placed as item}
  {@const textY = baseline - item.y - 1}
  {@const rawSegs = item.segments?.length
    ? item.segments
    : [{ color: item.color, text: item.label }]}
  {@const sized = rawSegs.map((s) => {
    const translated = translatedMap[s.text];
    // "en" mode falls back to German for anything not (yet) translated,
    // rather than showing a blank box.
    const showEn = langMode !== "de" && !!translated;
    const showDe = langMode !== "en" || !translated;
    const de = showDe ? s.text : "";
    const en = showEn ? translated : "";
    const stacked = langMode === "both" && !!de && !!en;
    const tw = stacked
      ? Math.ceil(Math.max(de.length, en.length) * CHAR_W)
      : Math.ceil((de.length + en.length) * CHAR_W);
    return { color: s.color ?? item.color, de, en, stacked, tw };
  })}
  {@const districtLabel = item.district || ""}
  {@const districtW = districtLabel
    ? Math.ceil(districtLabel.length * DIST_CW) + DIST_GAP
    : 0}
  {@const itemTw = sized.reduce((sum, s) => sum + s.tw, 0)}
  {@const groupX =
    textAlign === "middle"
      ? item.x - itemTw / 2
      : textAlign === "end"
        ? item.x - itemTw
        : item.x}
  {@const districtX = groupX - districtW}
  {@const segs = sized.reduce((acc, s) => {
    const prevEnd = acc.length
      ? acc[acc.length - 1].x + acc[acc.length - 1].tw
      : groupX;
    acc.push({ ...s, x: prevEnd });
    return acc;
  }, [])}
  {#if item.raw?.URL}
    <a href={item.raw.URL} target="_blank" rel="noreferrer" class="item-link">
      <g>
        {#if districtLabel}
          <text
            x={districtX}
            y={textY}
            style="font-family: var(--font-mono)"
            font-size={DIST_FS}
            text-anchor="start"
            fill={DIST_TEXT}>{districtLabel}</text
          >
        {/if}
        {#each segs as seg, i}
          {@const rectX = seg.x - (i === 0 ? 2 : 0)}
          {@const rectW =
            seg.tw + (i === 0 ? 2 : 0) + (i === segs.length - 1 ? 2 : 0)}
          {#if seg.stacked}
            {@const deY = textY - FS - STACK_GAP}
            <rect
              x={rectX}
              y={deY - FS}
              width={rectW}
              height={2 * FS + STACK_GAP + 3}
              fill={`url(#${gradId(seg.color)})`}
              stroke="none"
              stroke-width={0}
            />
            <text
              x={seg.x}
              y={deY}
              style="font-family: var(--font-mono)"
              font-size={FS}
              text-anchor="start"
              class="item"
              fill={DE_TEXT}>{seg.de}</text
            >
            <text
              x={seg.x}
              y={textY}
              style="font-family: var(--font-mono)"
              font-size={FS}
              font-weight="700"
              text-anchor="start"
              class="item"
              fill={EN_TEXT}>{seg.en}</text
            >
          {:else}
            <rect
              x={rectX}
              y={textY - FS}
              width={rectW}
              height={FS + 3}
              fill={`url(#${gradId(seg.color)})`}
              stroke="none"
              stroke-width={0}
            />
            <text
              x={seg.x}
              y={textY}
              style="font-family: var(--font-mono)"
              font-size={FS}
              text-anchor="start"
              class="item"
              >{#if seg.de}<tspan fill={DE_TEXT}>{seg.de}</tspan
                >{/if}{#if seg.en}<tspan fill={EN_TEXT} font-weight="700"
                  >{seg.en}</tspan
                >{/if}</text
            >
          {/if}
        {/each}
      </g>
    </a>
  {:else}
    {#if districtLabel}
      <text
        x={districtX}
        y={textY}
        style="font-family: var(--font-mono)"
        font-size={DIST_FS}
        text-anchor="start"
        fill={DIST_TEXT}>{districtLabel}</text
      >
    {/if}
    {#each segs as seg, i}
      {@const rectX = seg.x - (i === 0 ? 2 : 0)}
      {@const rectW =
        seg.tw + (i === 0 ? 2 : 0) + (i === segs.length - 1 ? 2 : 0)}
      {#if seg.stacked}
        {@const deY = textY - FS - STACK_GAP}
        <rect
          x={rectX}
          y={deY - FS}
          width={rectW}
          height={2 * FS + STACK_GAP + 3}
          fill={`url(#${gradId(seg.color)})`}
          stroke="none"
          stroke-width={0}
        />
        <text
          x={seg.x}
          y={deY}
          style="font-family: var(--font-mono)"
          font-size={FS}
          text-anchor="start"
          class="item"
          fill={DE_TEXT}>{seg.de}</text
        >
        <text
          x={seg.x}
          y={textY}
          style="font-family: var(--font-mono)"
          font-size={FS}
          font-weight="700"
          text-anchor="start"
          class="item"
          fill={EN_TEXT}>{seg.en}</text
        >
      {:else}
        <rect
          x={rectX}
          y={textY - FS}
          width={rectW}
          height={FS + 3}
          fill={`url(#${gradId(seg.color)})`}
          stroke="none"
          stroke-width={0}
        />
        <text
          x={seg.x}
          y={textY}
          style="font-family: var(--font-mono)"
          font-size={FS}
          text-anchor="start"
          class="item"
          >{#if seg.de}<tspan fill={DE_TEXT}>{seg.de}</tspan
            >{/if}{#if seg.en}<tspan fill={EN_TEXT} font-weight="700"
              >{seg.en}</tspan
            >{/if}</text
        >
      {/if}
    {/each}
  {/if}
{/each}
