import { sveltekit } from "@sveltejs/kit/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [tailwindcss(), sveltekit()],
  worker: {
    // The Mermaid frame is loaded as a module script from an opaque-origin
    // sandbox. Inline its dynamic imports so the frame has one self-contained
    // asset and never needs cross-origin chunk requests.
    format: "iife",
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
  },
  // The development Mermaid frame is an ESM worker asset loaded from an
  // opaque-origin sandbox. Permit this application's own asset to satisfy
  // module CORS; the iframe CSP still blocks every content-driven resource.
  server: {
    cors: { origin: "null" },
  },
  preview: {
    cors: { origin: "null" },
  },
  ssr: {
    noExternal: ["lucide-svelte"],
  },
});
