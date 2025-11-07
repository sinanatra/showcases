export const prerender = true;

export const load = async ({ fetch }) => {
  const response = await fetch(`/api/snippets`);
  const posts = await response.json();
  return {
    posts,
  };
};

export const entries = async () => {
  const files = import.meta.glob("/src/routes/texts/*.md");
  return Object.keys(files).map((p) => {
    const slug = p.split("/").pop().replace(/\.md$/, "");
    return { slug };
  });
};
