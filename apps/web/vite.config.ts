import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
import { VitePWA } from "vite-plugin-pwa";

const inContainer = Boolean(process.env.API_PROXY);

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "EZScout",
        short_name: "EZScout",
        start_url: "/",
        display: "standalone",
        theme_color: "#2d6a4f",
        background_color: "#f5f7f8",
        icons: [
          { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png" }
        ]
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg}"],
        runtimeCaching: [
          {
            urlPattern: /\/api\/forms\/.*/i,
            handler: "NetworkFirst",
            options: {
              cacheName: "form-cache",
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 * 7 }
            }
          }
        ]
      }
    })
  ],
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
