<script>
  import { onMount } from "svelte";
  import { csv } from "d3-fetch";
  import { timeParse } from "d3-time-format";

  let data = [];
  let groupedData = {};
  let uniqueWeeks = [];
  let uniqueTags = [];
  let selectedWeekIndex = 0;
  let selectedWeek = "";

  const parseDate = timeParse("%d.%m.%Y");

  function getWeekStart(date) {
    const d = new Date(date);
    const day = d.getDay();

    const diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);

    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  onMount(async () => {
    data = await csv("data/tagged_documents_filtered.csv");

    data.forEach((d) => {
      d["Date"] = parseDate(d["Date"]);
    });

    groupedData = data.reduce((acc, d) => {
      if (!d["Date"]) return acc;
      const weekStart = getWeekStart(d["Date"]);
      const weekKey = weekStart.toISOString().slice(0, 10);
      if (!acc[weekKey]) acc[weekKey] = [];
      acc[weekKey].push(d);
      return acc;
    }, {});

    uniqueWeeks = Object.keys(groupedData).sort();

    const tagSet = new Set();
    data.forEach((d) => {
      if (d["Tag"]) tagSet.add(d["Tag"]);
    });
    uniqueTags = Array.from(tagSet);

    selectedWeek = uniqueWeeks[selectedWeekIndex];
  });

  $: if (uniqueWeeks.length) {
    selectedWeek = uniqueWeeks[selectedWeekIndex];
  }

  $: pivot = selectedWeek
    ? uniqueTags.reduce((acc, tag) => {
        acc[tag] = groupedData[selectedWeek].filter((d) => d["Tag"] === tag);
        return acc;
      }, {})
    : {};

  $: maxRows = uniqueTags.reduce((max, tag) => {
    const len = pivot[tag] ? pivot[tag].length : 0;
    return len > max ? len : max;
  }, 0);
</script>

{#if uniqueWeeks.length}
  <div>
    <input
      type="range"
      min="0"
      max={uniqueWeeks.length - 1}
      bind:value={selectedWeekIndex}
      step="1"
    />
    <p>Selected week: {uniqueWeeks[selectedWeekIndex]}</p>
  </div>

  {#if selectedWeek}
    <table border="1" cellpadding="5" cellspacing="0">
      <thead>
        <tr>
          {#each uniqueTags as tag}
            <th>{tag}</th>
          {/each}
        </tr>
      </thead>
      <tbody>
        {#each Array(maxRows) as _, rowIndex}
          <tr>
            {#each uniqueTags as tag}
              <td>
                {#if pivot[tag] && pivot[tag][rowIndex]}
                  <h1>
                    {pivot[tag][rowIndex]["Title"]}
                  </h1>
                  <strong>
                    {pivot[tag][rowIndex]["Location"]}
                  </strong>
                  <p>
                    {pivot[tag][rowIndex]["Text"]}
                  </p>
                {/if}
              </td>
            {/each}
          </tr>
        {/each}
      </tbody>
    </table>
  {/if}
{/if}

<style>
  table {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
  }

  th,
  td {
    padding: 10px;
    border: 1px solid #ccc;
    text-align: left;
    /* overflow: hidden; */
    /* white-space: nowrap;
    text-overflow: ellipsis; */
  }

  th {
    background-color: #f9f9f9;
  }
</style>
