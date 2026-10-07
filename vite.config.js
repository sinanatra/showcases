import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [sveltekit()],
  // categories.json sits in the project root (shared with pipeline/), outside
  // the folders the dev server serves by default.
  server: { fs: { allow: ["categories.json"] } },
});
