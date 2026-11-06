import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { createApp } from "./app";
const base = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = Number(process.env.PORT ?? 4317);
if (!Number.isInteger(port) || port < 1024 || port > 65535)
  throw new Error("PORT 必须在 1024–65535 之间");
const app = createApp({
  root: path.resolve(base, ".."),
  configDir: path.join(base, ".local"),
  manifestPath: path.join(base, "skill-manifest.json"),
  port,
});
if (process.argv.includes("--production")) {
  app.use(express.static(path.join(base, "dist")));
  app.get("/{*path}", (_req, res) =>
    res.sendFile(path.join(base, "dist/index.html")),
  );
} else {
  const { createServer } = await import("vite");
  const vite = await createServer({
    root: base,
    server: { middlewareMode: true },
    appType: "spa",
  });
  app.use(vite.middlewares);
}
const server = app.listen(port, "127.0.0.1", () =>
  console.log(`画外 · 提示词创作工作台 http://127.0.0.1:${port}`),
);
server.on("error", (e: NodeJS.ErrnoException) => {
  console.error(
    e.code === "EADDRINUSE"
      ? `端口 ${port} 已在使用，请打开已有工作台，或使用 PORT 指定其他端口。`
      : "无法启动本地服务",
  );
  process.exit(1);
});
