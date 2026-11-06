import { it, expect } from "vitest";
import { mkdtemp, readFile, stat, writeFile, mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  saveConfig,
  loadConfig,
  publicConfig,
  normalizeBaseUrl,
} from "../server/config";
import { readSources, getRuleStatus } from "../server/rules";
import { decodeCompletion, safeOrigin } from "../server/provider";
it("persists credentials privately and never returns secrets in public config", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "prompt-config-"));
  await saveConfig(dir, {
    baseUrl: "https://api.deepseek.com",
    model: "test-model",
    apiKey: "secret-value",
  });
  const config = await loadConfig(dir);
  expect(config.apiKey).toBe("secret-value");
  expect(JSON.stringify(publicConfig(config))).not.toContain("secret-value");
  expect((await stat(path.join(dir, "config.json"))).mode & 0o777).toBe(0o600);
  await saveConfig(dir, { model: "next" });
  expect((await loadConfig(dir)).apiKey).toBe("secret-value");
  await saveConfig(dir, { apiKey: "" });
  expect(publicConfig(await loadConfig(dir)).hasKey).toBe(false);
});
it("rejects unsafe URL shapes and allows explicit loopback providers", () => {
  expect(normalizeBaseUrl("https://api.deepseek.com/v1/")).toBe(
    "https://api.deepseek.com/v1",
  );
  expect(() => normalizeBaseUrl("https://secret@host.test")).toThrow();
  expect(() => normalizeBaseUrl("http://example.com")).toThrow();
  expect(normalizeBaseUrl("http://127.0.0.1:11434/v1")).toContain("11434");
});
it("detects source changes and missing files rather than trusting version alone", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "prompt-rules-"));
  await mkdir(path.join(root, "references"));
  await writeFile(
    path.join(root, "SKILL.md"),
    'metadata:\n  version: "v6"\nOriginal',
  );
  await writeFile(path.join(root, "references/a.md"), "Keep all subjects");
  const files = ["SKILL.md", "references/a.md"];
  const source = await readSources(root, files);
  const manifest = { version: "v6", files: source.files, hash: source.hash };
  expect((await getRuleStatus(root, manifest)).synced).toBe(true);
  await writeFile(path.join(root, "references/a.md"), "Changed");
  expect((await getRuleStatus(root, manifest)).synced).toBe(false);
});
it("treats length, empty content and malformed upstream messages as failures", () => {
  expect(() =>
    decodeCompletion({
      choices: [{ finish_reason: "length", message: { content: "{}" } }],
    }),
  ).toThrow(/截断/);
  expect(() =>
    decodeCompletion({
      choices: [{ finish_reason: "stop", message: { content: "  " } }],
    }),
  ).toThrow(/空/);
  expect(() => decodeCompletion({ choices: [] })).toThrow();
  expect(
    decodeCompletion({
      choices: [{ finish_reason: "stop", message: { content: '{"ok":true}' } }],
    }),
  ).toBe('{"ok":true}');
});
it("accepts only the actual local origin, including Host validation", () => {
  expect(safeOrigin("127.0.0.1:4317", "http://127.0.0.1:4317", 4317)).toBe(
    true,
  );
  expect(safeOrigin("127.0.0.1:4317", "https://evil.test", 4317)).toBe(false);
  expect(safeOrigin("evil.test:4317", undefined, 4317)).toBe(false);
});
it("cancels an in-flight upstream request and reports cancellation without exposing provider errors", async () => {
  const { vi } = await import("vitest");
  const { providerFetch } = await import("../server/provider");
  const abort = new AbortController();
  vi.stubGlobal(
    "fetch",
    (_url: unknown, init: RequestInit) =>
      new Promise((_resolve, reject) => {
        init.signal?.addEventListener(
          "abort",
          () => reject(new Error("private upstream detail")),
          { once: true },
        );
      }),
  );
  try {
    const pending = providerFetch(
      {
        provider: "deepseek",
        baseUrl: "https://api.deepseek.com",
        model: "fixture",
        apiKey: "secret",
      },
      "/chat/completions",
      { method: "POST" },
      abort.signal,
    );
    abort.abort();
    await expect(pending).rejects.toMatchObject({
      status: 499,
      message: "已取消生成",
    });
  } finally {
    vi.unstubAllGlobals();
  }
});
it("reports the timeout separately from network and authentication errors", async () => {
  const { vi } = await import("vitest");
  const { providerFetch } = await import("../server/provider");
  const timeout = new AbortController();
  const timer = vi
    .spyOn(AbortSignal, "timeout")
    .mockReturnValue(timeout.signal);
  vi.stubGlobal(
    "fetch",
    (_url: unknown, init: RequestInit) =>
      new Promise((_resolve, reject) => {
        init.signal?.addEventListener(
          "abort",
          () => reject(new Error("private upstream detail")),
          { once: true },
        );
      }),
  );
  try {
    const pending = providerFetch(
      {
        provider: "deepseek",
        baseUrl: "https://api.deepseek.com",
        model: "fixture",
        apiKey: "secret",
      },
      "/chat/completions",
      { method: "POST" },
    );
    timeout.abort();
    await expect(pending).rejects.toMatchObject({
      status: 504,
      message: "生成超时，设置已保留，请重试",
    });
  } finally {
    timer.mockRestore();
    vi.unstubAllGlobals();
  }
});
