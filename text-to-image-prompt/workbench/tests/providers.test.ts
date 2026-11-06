import { it, expect } from "vitest";
import { mkdtemp, writeFile, stat } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import {
  loadConfig,
  saveConfig,
  publicConfig,
  deleteConfigKey,
} from "../server/config";
import { generationPayload, decodeResponse } from "../server/provider";
it("migrates existing DeepSeek settings and isolates provider credentials, edits and deletion", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "provider-profile-"));
  await writeFile(
    path.join(dir, "config.json"),
    JSON.stringify({
      baseUrl: "https://api.deepseek.com",
      model: "deep-fixture",
      apiKey: "deep-secret",
    }),
  );
  expect((await loadConfig(dir)).provider).toBe("deepseek");
  expect((await loadConfig(dir, "openai")).apiKey).toBe("");
  await saveConfig(dir, {
    provider: "openai",
    model: "open-fixture",
    apiKey: "open-secret",
  });
  expect((await loadConfig(dir)).baseUrl).toBe("https://api.openai.com/v1");
  expect((await loadConfig(dir, "deepseek")).apiKey).toBe("deep-secret");
  expect(JSON.stringify(publicConfig(await loadConfig(dir)))).not.toContain(
    "open-secret",
  );
  await saveConfig(dir, { provider: "deepseek" });
  expect((await loadConfig(dir)).apiKey).toBe("deep-secret");
  await deleteConfigKey(dir, "openai");
  expect((await loadConfig(dir)).provider).toBe("deepseek");
  expect((await loadConfig(dir, "openai")).apiKey).toBe("");
  expect((await stat(path.join(dir, "config.json"))).mode & 0o777).toBe(0o600);
});
it("clears only the edited provider key when its endpoint changes", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "provider-address-"));
  await saveConfig(dir, { provider: "deepseek", apiKey: "deep-secret" });
  await saveConfig(dir, { provider: "openai", apiKey: "open-secret" });
  await saveConfig(dir, {
    provider: "openai",
    baseUrl: "https://proxy.example/v1",
  });
  expect((await loadConfig(dir)).apiKey).toBe("");
  expect((await loadConfig(dir, "deepseek")).apiKey).toBe("deep-secret");
});
it("uses provider-specific endpoints and JSON controls without sending DeepSeek options to OpenAI", () => {
  const messages = [
    { role: "system", content: "Return json" },
    { role: "user", content: "scene" },
  ];
  const open = generationPayload(
    { provider: "openai", model: "fixture" },
    messages,
  );
  expect(open.endpoint).toBe("/responses");
  expect(open.body).toMatchObject({
    input: messages,
    text: { format: { type: "json_object" } },
    store: false,
    max_output_tokens: 16384,
  });
  expect(open.body).not.toHaveProperty("thinking");
  expect(open.body).not.toHaveProperty("max_tokens");
  const deep = generationPayload(
    { provider: "deepseek", model: "fixture" },
    messages,
  );
  expect(deep.endpoint).toBe("/chat/completions");
  expect(deep.body).toMatchObject({
    messages,
    response_format: { type: "json_object" },
    thinking: { type: "disabled" },
  });
});
it("reads Responses message output after reasoning and rejects incomplete, refusal and empty output", () => {
  const raw = {
    status: "completed",
    output: [
      { type: "reasoning", summary: [] },
      {
        type: "message",
        content: [{ type: "output_text", text: '{"ok":true}' }],
      },
    ],
  };
  expect(decodeResponse(raw)).toBe('{"ok":true}');
  expect(() =>
    decodeResponse({
      ...raw,
      status: "incomplete",
      incomplete_details: { reason: "max_output_tokens" },
    }),
  ).toThrow(/截断/);
  expect(() => decodeResponse({ ...raw, status: "failed" })).toThrow();
  expect(() =>
    decodeResponse({
      status: "completed",
      output: [
        { type: "message", content: [{ type: "refusal", refusal: "private" }] },
      ],
    }),
  ).toThrow(/拒绝/);
  expect(() => decodeResponse({ status: "completed", output: [] })).toThrow(
    /空/,
  );
});
