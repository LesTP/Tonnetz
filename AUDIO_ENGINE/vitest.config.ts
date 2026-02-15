import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "harmony-core": path.resolve(__dirname, "../HARMONY_CORE/src/index.ts"),
    },
  },
  test: {
    include: ["src/**/*.test.ts"],
  },
});
