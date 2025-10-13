import { fetchMarkdownData } from "$lib/utils/fetchMarkdownData";
import { json } from "@sveltejs/kit";

export const GET = async () => {
  const allPosts = await fetchMarkdownData();
  return json(allPosts);
};
