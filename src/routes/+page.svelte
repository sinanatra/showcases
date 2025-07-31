<article>
  <header>
    <!-- <a href="overview">Overview</a> — -->
    <a href="timeline">Timeline</a>

    <!-- <a href="infection2">Infection 2</a> —
    <a href="infection">Infection</a> — -->
    <a href="infection1">Infection</a>
    <a href="spread">Spread</a>
  </header>
</article>

<style>
  article {
    height: 100vh;
    background-color: black;
    padding: 10px;
  }
  header {
    font-weight: bold;
    display: flex;
    gap: 10px;
    background-color: rgb(254, 255, 231);
    border-radius: 3px;
    font-size: 4vw;
    line-height: 1.2em;
    color: black;
    margin: 10px;
  }

  a {
    color: black;
    text-decoration: none;
  }

  a:not(:first-child)::before {
    content: "-";
    margin-right: 5px;
  }
</style>
