<script>
  let { sheet } = $props();

  // shrinks the text of a long report until it fits on the page; every strip
  // of a sheet shows the same report, so each one is measured only once
  const sizes = new Map();
  function fitText(content, sheet) {
    const article = content.parentElement;
    const overflows = (size) => {
      article.style.setProperty("--fit", size);
      return content.scrollHeight > content.clientHeight;
    };
    const fit = (sheet) => {
      const key = sheet.paragraphs.join("");
      if (!sizes.has(key)) {
        let fits = 0.08;
        let tooBig = 1;
        if (!overflows(1)) fits = 1;
        else
          for (let i = 0; i < 7; i++) {
            const size = (fits + tooBig) / 2;
            if (overflows(size)) tooBig = size;
            else fits = size;
          }
        sizes.set(key, fits);
      }
      article.style.setProperty("--fit", sizes.get(key));
    };
    fit(sheet);
    return { update: fit };
  }

  const L = $derived(
    sheet.en
      ? {
          reportOf: "Police report of",
          category: "Category",
          tags: "Tags:",
          date: "Date:",
          press: "Press office and contact",
        }
      : {
          reportOf: "Polizeimeldung vom",
          category: "Kategorie",
          tags: "Tags:",
          date: "Datum:",
          press: "Pressearbeit und Erreichbarkeit",
        },
  );
</script>

<article>
  <header>
    {#if sheet.berlin}
      <img src="/logos/polizei-berlin.webp" alt="" />
      <span>Polizei Berlin</span>
    {:else}
      <img src="/logos/polizei-brandenburg.svg" alt="Polizei Brandenburg" />
    {/if}
  </header>
  <div class="content" use:fitText={sheet}>
    <h1>{@html sheet.title}</h1>
    {#if sheet.berlin}
      <p>{L.reportOf} {sheet.date}</p>
      <p>{sheet.location}</p>
    {:else}
      <p>
        {sheet.town}{#if sheet.county}{" "}( {sheet.county} ){/if}
      </p>
      <dl>
        {#if sheet.categories.length}<div>
            <dt>{L.category}</dt>
            <dd>{sheet.categories.join(", ")}</dd>
          </div>{/if}
        {#if sheet.tags.length}<div>
            <dt>{L.tags}</dt>
            <dd>{sheet.tags.join(", ")}</dd>
          </div>{/if}
        <div>
          <dt>{L.date}</dt>
          <dd>{sheet.date}</dd>
        </div>
      </dl>
    {/if}
    {#each sheet.paragraphs as p}<p>{@html p}</p>{/each}
  </div>
  {#if sheet.berlin}
    <address>
      <strong>Polizei Berlin</strong>
      <ul><li>{L.press}</li></ul>
      Platz der Luftbrücke 6<br />12101 Berlin<br />
    </address>
  {/if}
</article>

<style>
  article {
    position: absolute;
    inset: 0;
    overflow: hidden;
    background: #fff;
    border: 1px solid #ccc;
    box-sizing: border-box;
    color: #000;
    font-family: Arial, Helvetica, sans-serif;
    font-size: calc(2.3cqw * var(--fit, 1)); /* --fit shrinks the reports that don't fit */
    line-height: 1.45;
    /* header on top, text below it, above a bottom margin */
    display: flex;
    flex-direction: column;
    padding-bottom: 7cqw;
  }
  .content {
    flex: 1;
    min-height: 0;
    overflow: hidden;
    padding: 4cqw 7cqw 0;
  }
  h1 {
    margin: 0 0 4cqw;
    font-family: inherit;
    font-size: 3.4cqw;
    font-weight: 700;
    line-height: 1.15;
  }
  p {
    margin: 0 0 0.6em;
    font-family: inherit;
  }
  dl {
    font-size: 0.6em;
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 0 1.5em;
    margin: 0 0 1em;
    padding-bottom: 0.2em;
  }
  dt,
  dd {
    display: inline;
    margin: 0;
  }
  address {
    padding: 2cqw 7cqw 0;
    font-style: normal;
  }
  address ul {
    margin: 0.3em 0;
    padding-left: 1.1em;
  }
  address li::marker {
    color: #e40523; /* Berlin red */
  }
  article :global(*) {
    font-family: Arial, Helvetica, sans-serif;
  }
  article :global(mark) {
    background: var(--mark);
    color: #000;
  }

  header {
    display: flex;
    align-items: center;
    gap: 3cqw;
    padding: 6cqw 7cqw 0;
  }
  img {
    display: block;
    height: 8cqw;
  }
  header span {
    font-size: 3.4cqw;
    font-weight: 700;
    line-height: 1;
  }
</style>
