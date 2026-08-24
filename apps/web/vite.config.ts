import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const inContainer = Boolean(process.env.API_PROXY);

export default defineConfig({
  plugins: [react()],
  server: {
    host: inContainer || undefined,
    proxy: {
      "/api": process.env.API_PROXY ?? "http://localhost:3000"
    },
    watch: inContainer ? { usePolling: true } : undefined
  },
  test: {
    environment: "jsdom",
    globals: true,
    include: ["tests/**/*.test.{ts,tsx}"]
  }
});
