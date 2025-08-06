<script>
  import { goto } from "$app/navigation";
  function start() {
    goto("/spread");
  }

  function splitAndScatter(text, spread = 0.1) {
    return text.split("").map((c, i) => ({
      c,
      i,
      x: (Math.random() - 0.5) * spread + "ch",
      y: (Math.random() - 0.5) * spread + "ch",
    }));
  }

  const title = "Showcases";
  const subtitle = "Recoding Right-Wing Extremism";
  const buttonText = "Enter";
</script>

<main>
  <article>
    <h1>
      {#each splitAndScatter(title, 0.1) as { c, x, y, i }}
        {#if c === " "}
          <span class="letter letter--space" style="left:0;top:0"></span>
        {:else}
          <span class="letter" style="transform: translate({x}, {y});">{c}</span
          >
        {/if}
      {/each}
    </h1>
    <h2>
      {#each splitAndScatter(subtitle, 0.1) as { c, x, y, i }}
        {#if c === " "}
          <span class="letter letter--space" style="left:0;top:0"></span>
        {:else}
          <span class="letter" style="transform: translate({x}, {y});">{c}</span
          >
        {/if}
      {/each}
    </h2>
    <p>
      This project automatically monitors police reports from Berlin and Brandenburg, highlighting and visualizing every new act of right-wing, xenophobic, or hate-motivated violence. It transforms official data into interactive records, making visible what is often overlooked in German society.
      
    </p>
    <button on:click={start}>
      {#each splitAndScatter(buttonText, 0.1) as { c, x, y, i }}
        {#if c === " "}
          <span class="letter letter--button letter--space" style="left:0;top:0"
          ></span>
        {:else}
          <span
            class="letter letter--button"
            style="transform: translate({x}, {y});">{c}</span
          >
        {/if}
      {/each}
    </button>
  </article>
</main>

<style>
  main {
    font-size: 28px;
    line-height: 20px;
    min-height: 100vh;
    background: #111;
    color: #fff;
    display: flex;
    align-items: center;
  }

  article {
    max-width: 50ch;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
  }

  h1,
  h2 {
    display: flex;
    flex-wrap: wrap;
    font-size: 2.8ch;
    margin: 0;
    position: relative;
  }
  h2 {
    font-size: 2ch;
    opacity: 0.82;
  }
  p {
    display: flex;
    flex-wrap: wrap;
    font-size: 1.07ch;
    margin: 0;
    opacity: 0.95;
    position: relative;
  }
  .letter {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.1ch;
    height: 1.6ch;
    color: white;
    margin: 0;
    border-radius: 0.5ch;
    font-family: inherit;
    font-size: inherit;
    box-shadow: 0 0.5px 2px #0002;
    position: relative;
    top: 0.01em;
  }
  .letter--small {
    background: none;
    color: white;
  }

  .letter--button {
    /* background: #fff;
    color: #1a1a1a; */
    border-radius: 0.5ch;
    font-size: 1.1em;
    box-shadow: 0 2px 8px #0001;
  }

  .letter--space {
    background: transparent !important;
    box-shadow: none !important;
    color: transparent !important;
    border: none;
    min-width: 1.4ch;
    min-height: 1.3ch;
    margin: 0 0.14ch 0.18ch 0;
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
  }
  button:hover .letter--button {
    background: #ececec;
    color: black;
  }
</style>
