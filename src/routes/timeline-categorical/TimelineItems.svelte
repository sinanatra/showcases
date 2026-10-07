<svelte:options namespace="svg" />

<script>
  import { settings, distCW } from "./settings.svelte.js";
  import { segmentText } from "./catTimeline.js";
  import { GRADIENT_END_AT } from "../../lib/constants/categories.js";

  let FS = $derived(settings.FS);
  let STACK_GAP = $derived(settings.STACK_GAP);
  let DIST_FS = $derived(settings.DIST_FS);
  let DIST_GAP = $derived(settings.DIST_GAP);
  let DIST_CW = $derived(distCW());

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

  const clean = (c) => String(c).replace(/[^a-zA-Z0-9]/g, "");
  const gradId = (color, end) => `grad-${clean(color)}-${clean(end ?? "#ffffff")}`;
  // one gradient per start/end pair in use
  let gradients = $derived([
    ...new Map(
      placed.flatMap((item) =>
        (item.segments?.length ? item.segments : [item]).map((s) => {
          const color = s.color ?? item.color, end = s.colorEnd ?? item.colorEnd ?? "#ffffff";
          return [gradId(color, end), { id: gradId(color, end), color, end }];
        }),
      ),
    ).values(),
  ]);
</script>

<!-- one gradient per color, reused by every box of that color: objectBoundingBox
     units make it sweep left-to-right across each rect's own width. -->
<defs>
  {#each gradients as g}
    <linearGradient id={g.id} x1="0" x2="1" y1="0" y2="0">
      <stop offset="0%" stop-color={g.color} />
      <stop offset={`${GRADIENT_END_AT}%`} stop-color={g.end} />
    </linearGradient>
  {/each}
</defs>

{#each placed as item}
  {@const textY = baseline - item.y - 1}
  {@const rawSegs = item.segments?.length
    ? item.segments
    : [{ color: item.color, text: item.label }]}
  {@const sized = rawSegs.map((s) => ({
    color: s.color ?? item.color,
    colorEnd: s.colorEnd ?? item.colorEnd,
    ...segmentText(s, translatedMap, langMode),
  }))}
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
              fill={`url(#${gradId(seg.color, seg.colorEnd)})`}
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
            {@const split = !!seg.de && !!seg.en}
            <rect
              x={rectX}
              y={textY - FS}
              width={split ? seg.deW + (i === 0 ? 2 : 0) : rectW}
              height={FS + 3}
              fill={`url(#${gradId(seg.color, seg.colorEnd)})`}
              stroke="none"
              stroke-width={0}
            />
            {#if split}
              <rect
                x={seg.x + seg.deW + seg.gap}
                y={textY - FS}
                width={seg.enW + (i === segs.length - 1 ? 2 : 0)}
                height={FS + 3}
                fill={`url(#${gradId(seg.color, seg.colorEnd)})`}
                stroke="none"
                stroke-width={0}
              />
            {/if}
            <text
              x={seg.x}
              y={textY}
              style="font-family: var(--font-mono)"
              font-size={FS}
              text-anchor="start"
              class="item"
              >{#if seg.de}<tspan fill={DE_TEXT}>{seg.de}</tspan
                >{/if}{#if seg.en}<tspan x={seg.x + (seg.de ? seg.deW + seg.gap : 0)} fill={EN_TEXT} font-weight="700"
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
          fill={`url(#${gradId(seg.color, seg.colorEnd)})`}
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
        {@const split = !!seg.de && !!seg.en}
        <rect
          x={rectX}
          y={textY - FS}
          width={split ? seg.deW + (i === 0 ? 2 : 0) : rectW}
          height={FS + 3}
          fill={`url(#${gradId(seg.color, seg.colorEnd)})`}
          stroke="none"
          stroke-width={0}
        />
        {#if split}
          <rect
            x={seg.x + seg.deW + seg.gap}
            y={textY - FS}
            width={seg.enW + (i === segs.length - 1 ? 2 : 0)}
            height={FS + 3}
            fill={`url(#${gradId(seg.color, seg.colorEnd)})`}
            stroke="none"
            stroke-width={0}
          />
        {/if}
        <text
          x={seg.x}
          y={textY}
          style="font-family: var(--font-mono)"
          font-size={FS}
          text-anchor="start"
          class="item"
          >{#if seg.de}<tspan fill={DE_TEXT}>{seg.de}</tspan
            >{/if}{#if seg.en}<tspan x={seg.x + (seg.de ? seg.deW + seg.gap : 0)} fill={EN_TEXT} font-weight="700"
              >{seg.en}</tspan
            >{/if}</text
        >
      {/if}
    {/each}
  {/if}
{/each}
