import { defineConfig } from "vite";
import path from "path";

export default defineConfig({
  root: ".",
  server: {
    host: true,
  },
  resolve: {
    alias: {
      "harmony-core": path.resolve(__dirname, "../HARMONY_CORE/src/index.ts"),
      "rendering-ui": path.resolve(__dirname, "../RENDERING_UI/src/index.ts"),
      "audio-engine": path.resolve(__dirname, "../AUDIO_ENGINE/src/index.ts"),
      "persistence-data": path.resolve(
        __dirname,
        "../PERSISTENCE_DATA/src/index.ts",
      ),
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
