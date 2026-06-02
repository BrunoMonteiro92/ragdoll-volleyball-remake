import { defineConfig } from "vite";

export default defineConfig({
  base: "/ragdoll-volleyball-remake/",
  server: {
    port: 5173,
    open: true,
  },
  build: {
    target: "es2020",
    outDir: "dist",
    assetsInlineLimit: 0,
  },
});
