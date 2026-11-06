import { afterEach, expect, it, vi } from "vitest";
import { createServer } from "node:http";
import { connect } from "node:net";
import type { AddressInfo } from "node:net";
import { parseMacProxySettings, resolveProxySettings } from "../server/network";
import { providerFetch } from "../server/provider";

afterEach(() => vi.unstubAllEnvs());

it("reads enabled macOS web proxies and excludes disabled or malformed entries", () => {
  expect(
    parseMacProxySettings(`<dictionary> {
    HTTPEnable : 0
    HTTPProxy : stale.local
    HTTPPort : 8080
    HTTPSEnable : 1
    HTTPSProxy : 127.0.0.1
    HTTPSPort : 8118
    ExceptionsList : <array> {
      0 : *.local
      1 : example.test
    }
  }`),
  ).toEqual({
    httpsProxy: "http://127.0.0.1:8118",
    noProxy: "*.local,example.test",
  });
  expect(
    parseMacProxySettings("HTTPSProxy : 127.0.0.1\nHTTPSPort : 8118"),
  ).toEqual({});
  expect(
    parseMacProxySettings(
      "HTTPSEnable : 1\nHTTPSProxy : host/path\nHTTPSPort : 99999",
    ),
  ).toEqual({});
});

it("prefers explicit environment proxies, including lowercase and no-proxy exclusions", () => {
  const system = { httpsProxy: "http://127.0.0.1:8118", noProxy: "*.local" };
  expect(resolveProxySettings({}, system)).toEqual(system);
  expect(
    resolveProxySettings(
      { HTTPS_PROXY: "http://env.test:8888", NO_PROXY: "*.example.test" },
      system,
    ),
  ).toEqual({
    httpProxy: "",
    httpsProxy: "http://env.test:8888",
    noProxy: "*.example.test",
  });
  expect(
    resolveProxySettings(
      { https_proxy: "", HTTPS_PROXY: "http://ignored.test", no_proxy: "*" },
      system,
    ),
  ).toEqual({ httpProxy: "", httpsProxy: "", noProxy: "*" });
  expect(resolveProxySettings({ NO_PROXY: "*" }, system)).toEqual({
    ...system,
    noProxy: "*",
  });
});

it("routes model requests through the configured proxy while keeping loopback requests direct", async () => {
  const upstream = createServer((req, res) => {
    expect(req.headers.authorization).toBe("Bearer fixture-key");
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ data: [{ id: "fixture-model" }] }));
  });
  const proxy = createServer();
  const tunnels: string[] = [];
  const sockets = new Set<import("node:net").Socket>();
  for (const server of [upstream, proxy]) {
    server.on("connection", (socket) => {
      sockets.add(socket);
      socket.on("close", () => sockets.delete(socket));
    });
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
  }
  proxy.on("connect", (req, client, head) => {
    tunnels.push(req.url!);
    expect(req.headers.authorization).toBeUndefined();
    const target = connect(
      (upstream.address() as AddressInfo).port,
      "127.0.0.1",
      () => {
        client.write("HTTP/1.1 200 Connection Established\r\n\r\n");
        if (head.length) target.write(head);
        client.pipe(target).pipe(client);
      },
    );
    sockets.add(target);
    target.on("close", () => sockets.delete(target));
    target.on("error", () => client.destroy());
    client.on("error", () => target.destroy());
    client.on("close", () => target.destroy());
  });
  vi.stubEnv(
    "http_proxy",
    `http://127.0.0.1:${(proxy.address() as AddressInfo).port}`,
  );
  vi.stubEnv("https_proxy", "");
  vi.stubEnv("no_proxy", "");
  const config = {
    provider: "openai" as const,
    baseUrl: "http://model.invalid",
    model: "fixture",
    apiKey: "fixture-key",
  };
  try {
    expect(await providerFetch(config, "/models", { method: "GET" })).toEqual({
      data: [{ id: "fixture-model" }],
    });
    expect(tunnels).toEqual(["model.invalid:80"]);
    await providerFetch(
      {
        ...config,
        baseUrl: `http://127.0.0.1:${(upstream.address() as AddressInfo).port}`,
      },
      "/models",
      { method: "GET" },
    );
    expect(tunnels).toHaveLength(1);
  } finally {
    for (const socket of sockets) socket.destroy();
    await Promise.all(
      [upstream, proxy].map(
        (server) =>
          new Promise<void>((resolve) => server.close(() => resolve())),
      ),
    );
  }
});
