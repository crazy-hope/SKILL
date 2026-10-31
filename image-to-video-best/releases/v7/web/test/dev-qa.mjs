// Requires development dependencies. Local ephemeral services, no saved config or upstream calls.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { createServer as createVite } from "vite";
import viteConfig from "../vite.config.mjs";
import { createApp } from "../lib/http.mjs";
import { readConfig } from "../lib/config.mjs";
const backend = createServer(createApp({ config: readConfig({}) }));
await new Promise((r) => backend.listen(0, "127.0.0.1", r));
let dev;
try {
  const target = `http://127.0.0.1:${backend.address().port}`;
  dev = await createVite({
    ...viteConfig,
    configFile: false,
    root: fileURLToPath(new URL("../", import.meta.url)),
    server: {
      ...viteConfig.server,
      port: 0,
      proxy: { "/api": { ...viteConfig.server.proxy["/api"], target } },
    },
  });
  await dev.listen();
  const origin = `http://127.0.0.1:${dev.httpServer.address().port}`;
  assert.equal((await fetch(`${origin}/api/config`)).status, 200);
  const send = (path, source, body) =>
    fetch(`${origin}/api/${path}`, {
      method: "POST",
      headers: { Origin: source, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  const saved = await send("connection", origin, {
    baseUrl: "https://example.invalid/v1",
    model: "mock-vision",
    apiKey: "fake-dev-test-key",
  });
  assert.equal(saved.status, 200);
  assert.equal((await saved.json()).connection.hasKey, true);
  assert.equal((await send("generate", origin, {})).status, 400); // input validation reached, not origin rejection
  assert.equal(
    (await send("connection/clear", "https://foreign.invalid", {})).status,
    403,
  );
  assert.equal((await send("connection/clear", origin, {})).status, 200);
  console.log(
    "PASS actual Vite proxy: GET/config save/clear/generate validation; foreign Origin rejected. Local dummy credentials only.",
  );
} finally {
  await dev?.close();
  backend.closeAllConnections();
  await new Promise((r) => backend.close(r));
}
