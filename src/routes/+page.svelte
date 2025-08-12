<script>
  import { goto } from "$app/navigation";

  let videoEl;

  function start() {
    goto("spread");
  }

  function handleEnded() {
    videoEl.pause();

    setTimeout(() => {
      videoEl.currentTime = 0;
      videoEl.play();
    }, 5000);
  }
</script>

<video
  class="bg-video"
  autoplay
  muted
  playsinline
  bind:this={videoEl}
  on:ended={handleEnded}
  poster="/bg-poster.jpg"
>
  <source src="bg.mp4" type="video/mp4" />
  <source src="bg.mov" type="video/quicktime" />
</video>

<main>
  <article class="panel">
    <h1>Showcases</h1>
    <h2>Recoding Right-Wing Extremism</h2>
    <p>
      This project automatically monitors police reports from Berlin and
      Brandenburg, highlighting and visualizing every new act of right-wing,
      xenophobic, or hate-motivated violence.
    </p>
    <button on:click={start}> Enter </button>
  </article>
</main>

<style>
  :global(body) {
    background: #000;
  }

  .bg-video {
    position: fixed;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    z-index: 0;
    pointer-events: none;
    filter: brightness(0.7);
  }

  main {
    min-height: 100vh;
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    z-index: 1;
    padding: 4vh 2vw;
    /* background: radial-gradient(120% 120% at 50% 50%, #0000 40%, #0006 100%); */
  }

  .panel {
    max-width: 60ch;
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

  h1,
  h2 {
    display: flex;
    flex-wrap: wrap;
    font-size: 1.3em;
    margin: 0;
    position: relative;
  }

  h2 {
    font-size: 1.2em;
  }

  p {
    display: flex;
    flex-wrap: wrap;
    font-size: 0.8em;
    margin: 0.6rem 0 0;
  }

  button {
    font-size: 1.13em;
    background: transparent;
    border: none;
    font-family: inherit;
    letter-spacing: 0.01em;
    cursor: pointer;
    margin-top: 1.6ch;
    box-shadow: none;
    padding: 0;
    display: flex;
    color: white;
  }

  button:hover {
    background: #ececec;
    color: black;
  }
</style>
