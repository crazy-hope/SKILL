import test from "node:test";
import assert from "node:assert/strict";
import { rewriteDevOrigin } from "../dev-proxy.mjs";
test("dev proxy translates only same-origin loopback UI POSTs", () => {
  const calls = [];
  const proxy = { setHeader: (...args) => calls.push(args) };
  rewriteDevOrigin(
    proxy,
    { headers: { host: "127.0.0.1:5173", origin: "http://127.0.0.1:5173" } },
    "http://127.0.0.1:3210",
  );
  assert.deepEqual(calls, [["Origin", "http://127.0.0.1:3210"]]);
  for (const headers of [
    { host: "127.0.0.1:5173", origin: "https://evil.example" },
    { host: "127.0.0.1:5173" },
    { host: "evil.example:5173", origin: "http://evil.example:5173" },
    { host: "localhost:5173", origin: "http://127.0.0.1:5173" },
  ])
    rewriteDevOrigin(proxy, { headers }, "http://127.0.0.1:3210");
  assert.equal(calls.length, 1);
});
