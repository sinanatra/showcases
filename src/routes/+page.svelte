<script>
  import { goto } from "$app/navigation";
  import { t, lang, setLang, availableLangs } from "$lib/i18n";

  let videoEl;

  function handleEnded() {
    videoEl.pause();
    setTimeout(() => {
      videoEl.currentTime = 0;
      videoEl.play();
    }, 5000);
  }
</script>

<div class="lang-switch" aria-label="Language switcher">
  {#each availableLangs as l}
    <button
      class:active={$lang === l}
      on:click={() => setLang(l)}
      aria-pressed={$lang === l}
    >
      {l.toUpperCase()}
    </button>
  {/each}
</div>

<video
  class="bg-video"
  autoplay
  muted
  playsinline
  bind:this={videoEl}
  on:ended={handleEnded}
>
  <source src="bg.mp4" type="video/mp4" />
</video>

<main>
  <article class="panel">
    <h1>{$t("showcases")}</h1>
    <h2>{$t("subtitle")}</h2>
    <p>{$t("description")}</p>
    <p>{$t("sub")}</p>

    <div class="links">
      <a href="/spread" sveltekit:prefetch>{$t("last")}</a> –
      <a href="/timeline" sveltekit:prefetch>{$t("timeline")}</a> –
      <a href="/methodology" sveltekit:prefetch>{$t("methodology")}</a>
    </div>
  </article>
</main>

<style>
  .lang-switch {
    position: fixed;
    top: 1rem;
    right: 1rem;
    z-index: 10;
    display: flex;
    gap: 0.4rem;
  }
  .lang-switch button {
    background: #111;
    color: #eee;
    border: 1px solid #333;
    border-radius: 8px;
    padding: 0.35rem 0.6rem;
    font-size: 0.9rem;
    cursor: pointer;
    opacity: 0.85;
  }
  .lang-switch button.active {
    border-color: #888;
    background: #222;
    opacity: 1;
  }

  .bg-video {
    position: fixed;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    z-index: 0;
    pointer-events: none;
  }

  main {
    height: 100vh;
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    z-index: 1;
  }

  .panel {
    max-width: 70ch;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    background: rgba(0, 0, 0, 1);
    backdrop-filter: blur(6px);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 2px;
    padding: 5px;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35);
  }

  .links {
    margin-top: 10px;
    display: flex;
    gap: 0.5rem;
    align-items: center;
    opacity: 0.9;
  }
  .links a {
    color: #ddd;
    text-decoration: none;
    border-bottom: 1px solid transparent;
  }
  .links a:hover {
    color: #fff;
    border-bottom-color: #fff;
  }

  h1 {
    font-size: 1.4em;
    margin: 0;
  }
  h2 {
    font-size: 1.1em;
    margin: 0;
  }
  p {
    font-size: 1em;
    margin: 0.6rem 0 0;
  }

  button {
    font-size: 1.13em;
    background: transparent;
    border: none;
    cursor: pointer;
    color: white;
  }

  button:hover {
    background: #ececec;
    color: black;
  }

  .start {
    padding: 0;
    margin-top: 20px;
  }
</style>
