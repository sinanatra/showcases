function parseFrontmatter(content) {
  if (!content.startsWith("---")) {
    return { metadata: {}, markdown: content };
  }

  const parts = content.split("---");
  if (parts.length < 3) {
    return { metadata: {}, markdown: content };
  }

  const metadata = {};
  const yamlContent = parts[1];
  const markdown = parts.slice(2).join("---");

  yamlContent.split("\n").forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;

    const colonIndex = trimmed.indexOf(":");
    if (colonIndex === -1) return;

    const key = trimmed.substring(0, colonIndex).trim();
    let value = trimmed.substring(colonIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (key === "urls" && value === "") {
      metadata[key] = [];
    } else if (value === "true") {
      metadata[key] = true;
    } else if (value === "false") {
      metadata[key] = false;
    } else {
      metadata[key] = value;
    }
  });

  return { metadata, markdown };
}

export const fetchMarkdownData = async () => {
  try {
    const allPostFiles = import.meta.glob("/src/routes/texts/*.md", {
      query: "?raw",
      import: "default",
    });

    const allPosts = await Promise.all(
      Object.entries(allPostFiles).map(async ([path, resolver]) => {
        try {
          const content = await resolver();
          const postPath = path.slice(11, -3);
          const { metadata } = parseFrontmatter(content);

          return {
            meta: metadata,
            path: postPath,
            text: "",
          };
        } catch (e) {
          console.warn(`Could not load markdown for ${path}:`, e.message);
          return {
            meta: {},
            path: path.slice(11, -3),
            text: "",
          };
        }
      })
    );

    return allPosts;
  } catch (e) {
    console.warn(`Could not load markdown files:`, e.message);

    return [];
  }
};
