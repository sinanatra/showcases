<script>
  import { onMount, onDestroy, tick } from "svelte"
  import { fade } from "svelte/transition"
  import { lang, setLang, availableLangs } from "$lib/i18n"
  import Stories from "$lib/components/Stories.svelte"

  export let scenes = null
  export let src = null
  export let threshold = 0.6
  export let data = {}
  export let storiesData = null

  let active = 0
  let videoRef
  let status = "loading"
  let errorMsg = ""
  let observer
  let root

  $: currentLang = $lang

  function l(v, langCode) {
    if (!v) return ""
    if (typeof v === "string") return v
    return v?.[langCode] ?? v?.en ?? v?.de ?? ""
  }

  function fill(str, map) {
    if (!str || typeof str !== "string") return str
    return str.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, k) => {
      const v = map?.[k]
      return v === 0 || v ? String(v) : "—"
    })
  }

  $: localizedScenes = (scenes || []).map((s) => {
    const _heading = fill(l(s.heading, currentLang), data)
    const _subtitle = fill(l(s.subtitle, currentLang), data)
    const _body = fill(l(s.body, currentLang), data)
    const _cta = (s.cta || []).map((c) => ({ ...c, _label: fill(l(c.label, currentLang), data) }))
    return { ...s, _heading, _subtitle, _body, _cta }
  })

  $: current = localizedScenes?.[active] ?? null
  $: isVideo = current?.media?.type === "video"

  function handleEnded() {
    if (!videoRef) return
    videoRef.pause()
    setTimeout(() => {
      try {
        videoRef.currentTime = 0
        videoRef.play()
      } catch {}
    }, 5000)
  }

  function preloadImages(list) {
    ;(list || []).forEach((s) => {
      if (s?.media?.type === "image" && s.media.src) {
        const img = new Image()
        img.src = s.media.src
      }
    })
  }

  async function initObserver() {
    await tick()
    const steps = Array.from(root.querySelectorAll(".step"))
    observer = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          const idx = Number(e.target.dataset.index)
          if (!Number.isNaN(idx)) active = idx
        }
      })
    }, { root: null, threshold })
    steps.forEach((el, i) => {
      el.dataset.index = String(i)
      observer.observe(el)
    })
  }

  onMount(async () => {
    try {
      if (!(Array.isArray(scenes) && scenes.length)) {
        if (!src) throw new Error("No scenes provided")
        const res = await fetch(src, { credentials: "same-origin" })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        scenes = await res.json()
      }
      status = "ready"
      active = 0
      preloadImages(scenes)
      await initObserver()
      await tick()
      videoRef?.play?.().catch(() => {})
    } catch (e) {
      status = "error"
      errorMsg = e?.message || String(e)
    }
  })

  onDestroy(() => observer?.disconnect())
</script>

<div class="lang-switch" aria-label="Language switcher">
  {#each availableLangs as l}
    <button class:active={$lang === l} on:click={() => setLang(l)} aria-pressed={$lang === l}>
      {l.toUpperCase()}
    </button>
  {/each}
</div>

<div class="scrolly" bind:this={root}>
  <div class="bg">
    {#if status === "ready" && current}
      {#key current.id}
        {#if isVideo}
          <video
            bind:this={videoRef}
            class="bg-media"
            autoplay
            muted
            playsinline
            preload="metadata"
            poster={current.media?.poster}
            on:ended={handleEnded}
            transition:fade
          >
            {#if Array.isArray(current.media?.sources) && current.media.sources.length}
              {#each current.media.sources as s}
                <source src={s.src} type={s.type} />
              {/each}
            {:else if current.media?.src}
              <source src={current.media.src} type="video/mp4" />
            {/if}
          </video>
        {:else if current?.media?.type === "image"}
          <img class="bg-media" src={current.media?.src} alt={current.media?.alt || ""} transition:fade />
        {/if}
      {/key}
    {:else if status === "loading"}
      <div class="bg-media" style="background:#000;"></div>
    {/if}
  </div>

  <main>
    {#if status === "error"}
      <section class="step">
        <article>Failed to load scenes: {errorMsg}</article>
      </section>
    {:else}
      {#each localizedScenes as s, i}
        <section class="step" aria-label={"section-" + i}>
          <article class:with-aside={s.embed === "stories"}>
            {#if s._heading}<h1><span class="line-bg">{s._heading}</span></h1>{/if}
            {#if s._subtitle}<h2><span class="line-bg">{s._subtitle}</span></h2>{/if}
            {#if s._body}<p><span class="line-bg">{s._body}</span></p>{/if}
            {#if s._cta?.length}
              <div class="links">
                {#each s._cta as link}
                  <a href={link.href} sveltekit:prefetch class:disabled={link.visible === false} aria-disabled={link.visible === false}>
                    <span class="line-bg">{link._label}</span>
                  </a>
                {/each}
              </div>
            {/if}
          </article>
          {#if s.embed === "stories"}
            <aside class="aside">
              <Stories data={storiesData} />
            </aside>
          {/if}
        </section>
      {/each}
    {/if}
  </main>
</div>

<style>
  .lang-switch {
    position: fixed;
    bottom: 1rem;
    right: 1rem;
    z-index: 10;
    display: flex;
    gap: 10px;
  }
  .lang-switch button {
    background: #111;
    color: #eee;
    font-size: 0.9rem;
    cursor: pointer;
    border: none;
  }
  .lang-switch button.active {
    color: #000;
    background: #fff;
  }
  .scrolly {
    background: #000;
    position: relative;
    min-height: 100vh;
  }
  .bg {
    position: fixed;
    inset: 0;
    z-index: 0;
  }
  .bg-media {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    pointer-events: none;
  }
  main {
    position: relative;
    z-index: 1;
  }
  .step {
    min-height: 100vh;
    display: grid;
    place-items: center;
    padding: 6vh 2vw;
  }
  .step article {
    max-width: 70ch;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 1ch;
  }
  .step article h1,
  .step article h2 {
    text-align: center;
  }
  .step article p {
    align-self: flex-start;
    text-align: left;
  }
  .step article .links {
    align-self: center;
    text-align: center;
  }
  .line-bg {
    background: #000;
    color: #fff;
    padding: 0.1ch 0.5ch;
    display: inline;
    box-decoration-break: clone;
    -webkit-box-decoration-break: clone;
  }
  h1 {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 3em;
    font-weight: 400;
    margin: 0;
  }
  h2 {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 1.5em;
    font-weight: 400;
    margin: 0;
    font-style: italic;
  }
  p {
    font-size: 1em;
    margin: 0.6rem 0 0;
  }
  .links {
    margin-top: 1rem;
    display: flex;
    gap: 0.8rem;
    flex-wrap: wrap;
  }
  .links a {
    color: #fff;
    text-decoration: none;
    border-bottom: 1px solid transparent;
  }
  .links a span:hover {
    background: var(--color-1);
    color: #000;
  }
  .step.with-aside {
    min-height: 60vh;
  }
  .step.with-aside article {
    max-width: 48ch;
  }
  .step.with-aside {
    width: 100%;
    display: grid;
    grid-template-columns: 1fr;
    gap: 2rem;
    align-items: start;
  }
  .aside {
    width: 100%;
    max-width: 720px;
    margin: 0 auto;
  }
  @media (min-width: 960px) {
    .step.with-aside {
      grid-template-columns: 1fr 1fr;
    }
    .step.with-aside article {
      align-items: flex-start;
      text-align: left;
    }
  }
</style>
