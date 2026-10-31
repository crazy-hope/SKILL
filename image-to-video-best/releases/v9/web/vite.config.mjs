import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { rewriteDevOrigin } from "./dev-proxy.mjs";
export default defineConfig({
  plugins: [react()],
  publicDir: false,
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: (id) =>
          id.includes("node_modules") ? "vendor" : undefined,
      },
    },
  },
  server: {
    host: "127.0.0.1",
    cors: false,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:3210",
        changeOrigin: true,
        configure(proxy, options) {
          proxy.on("proxyReq", (proxyReq, req) =>
            rewriteDevOrigin(proxyReq, req, options.target),
          );
        },
      },
    },
  },
});
