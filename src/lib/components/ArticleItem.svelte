<script>
  export let article;

  function getSentences(text) {
    return text.match(/[^\\.?!]+[\\.?!]+/g) || [text];
  }

  function highlight(text, terms) {
    let html = text;
    terms.forEach((term) => {
      const esc = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const re = new RegExp(`(${esc})`, "gi");
      html = html.replace(re, '<span class="highlight">$1</span>');
    });
    return html;
  }

  const terms = article.KeywordExtracted || [];
  const sentences = getSentences(article.Text);
  const matched = sentences.filter((s) =>
    terms.some((term) => new RegExp(term, "i").test(s))
  );

  const snippet = matched.join(" ");
</script>

<article class="polizei">
  <h2>{article.Title}</h2>
  <p>
    <strong>Date:</strong>
    {article.ExtractedDate}
    <strong>Time:</strong>
    {article.ExtractedTime.join(", ")}
  </p>
  <p>
    <strong>District:</strong>
    {article.ExtractedDistrict}
    <strong>Gender:</strong>
    {article.ExtractedGender.join(", ")}
  </p>
  <p><strong>Keywords:</strong> {article.KeywordMatch.join(", ")}</p>

  <div>{@html highlight(article.Text, terms)}</div>

  <a href={article.URL} target="_blank" rel="noopener">Source</a>
</article>

<style>
  .polizei {
    padding: 1rem;
    border-bottom: 1px solid #ddd;
    font-family: Arial, sans-serif;
  }

  :global(.highlight) {
    background-color: yellow !important;
  }
</style>
