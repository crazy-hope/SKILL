import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  build: { target: "es2022" },
  test: {
    environment: "jsdom",
    include: ["src/__tests__/*.test.jsx"],
    css: false,
  },
});
