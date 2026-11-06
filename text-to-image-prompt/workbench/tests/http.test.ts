import { draftVersion } from "./prompt-fixture";
import { beforeAll, afterAll, afterEach, it, expect, vi } from "vitest";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import type { Server } from "node:http";
import { createApp } from "../server/app";
import { saveConfig } from "../server/config";
import { readSources, sourcePaths } from "../server/rules";
import { emptySettings } from "../shared/contracts";
let root: string, base: string, hash: string, server: Server;
const realFetch = globalThis.fetch;
const settings = {
  ...emptySettings(),
  media: ["电影画面", "油画"],
  visualStyles: ["柔和光学", "低反差细腻"],
  colorTone: "自然中性：保留物体本色，冷暖平衡",
  genres: ["生活"],
  culture: "东方",
  realism: "现实世界",
  mood: ["温暖治愈"],
  aspectRatio: "16:9",
  mjVersion: "inherit",
  personalize: "off" as const,
  elements: "两个人，雨天",
  exclusions: "不要路人",
};
const scenes = Array.from({ length: 5 }, (_, i) => ({
  id: `s${i}`,
  title: `场景${i}`,
  location: "书店",
  event: "搬书",
  interaction: "一起托住书箱",
  highlight: "雨与窗光",
  style: "柔和高光",
  reality: "现实世界",
  culture: "东方",
}));
const body = (stage = "scenes") => ({
  stage,
  settings,
  revision: 2,
  ruleHash: hash,
  previousScenes: [],
  amendment: "",
  answers: [],
});
beforeAll(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), "prompt-http-"));
  await mkdir(path.join(root, "references"));
  for (const file of sourcePaths)
    await writeFile(
      path.join(root, file),
      await readFile(path.resolve("..", file)),
    );
  const sources = await readSources(root);
  hash = sources.hash;
  await writeFile(
    path.join(root, "manifest.json"),
    JSON.stringify({ version: sources.version, hash, files: sources.files }),
  );
  await saveConfig(path.join(root, ".local"), {
    model: "fixture",
    apiKey: "test-secret-should-never-leak",
  });
  const options = {
    root,
    configDir: path.join(root, ".local"),
    manifestPath: path.join(root, "manifest.json"),
    port: 0,
  };
  const app = createApp(options);
  await new Promise<void>((resolve, reject) => {
    server = app.listen(0, "127.0.0.1", (err?: Error) => {
      if (err) {
        reject(err);
        return;
      }
      options.port = (server.address() as { port: number }).port;
      base = `http://127.0.0.1:${options.port}`;
      resolve();
    });
    server.on("error", reject);
  });
});
afterAll(async () => {
  if (server)
    await new Promise<void>((resolve) => server.close(() => resolve()));
  if (root) await rm(root, { recursive: true, force: true });
});
afterEach(() => vi.unstubAllGlobals());
const post = (data: unknown) =>
  realFetch(`${base}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
function upstream(output: unknown, status = 200, finish = "stop") {
  vi.stubGlobal("fetch", async () =>
    status === 200
      ? Response.json({
          choices: [
            {
              finish_reason: finish,
              message: {
                content:
                  typeof output === "string" ? output : JSON.stringify(output),
              },
            },
          ],
        })
      : new Response("upstream-secret-should-not-leak", { status }),
  );
}
it("protects config and local files, and rejects foreign origins", async () => {
  expect(
    JSON.stringify(await (await realFetch(`${base}/api/config`)).json()),
  ).not.toContain("test-secret");
  expect((await realFetch(`${base}/.local/config.json`)).status).toBe(404);
  expect((await realFetch(`${base}/@fs/any/.local/config.json`)).status).toBe(
    404,
  );
  expect(
    (
      await realFetch(`${base}/api/config`, {
        headers: { Origin: "https://foreign.test" },
      })
    ).status,
  ).toBe(403);
});
it("loads all actual rule sources and retains multi-direction user settings in upstream requests", async () => {
  let payload: Record<string, any> = {};
  vi.stubGlobal("fetch", async (_url: string, init: RequestInit) => {
    payload = JSON.parse(init.body as string);
    return Response.json({
      choices: [
        {
          finish_reason: "stop",
          message: { content: JSON.stringify({ kind: "scenes", scenes }) },
        },
      ],
    });
  });
  const response = await post(body());
  expect(response.status).toBe(200);
  const result = await response.json();
  expect(result.output.scenes).toHaveLength(5);
  expect(
    new Set(result.output.scenes.map((s: { id: string }) => s.id)).size,
  ).toBe(5);
  expect(JSON.parse(payload.messages[1].content).settings.media).toEqual([
    "电影画面",
    "油画",
  ]);
  for (const file of sourcePaths) {
    const source = await readFile(path.join(root, file), "utf8");
    expect(payload.messages[0].content).toContain(source);
  }
  expect(payload.response_format).toEqual({ type: "json_object" });
});
it.each(["camera", "story"])(
  "produces six blocks with consistent parameters for %s",
  async (mode) => {
    upstream({
      kind: "prompts",
      negativeTerms: [{ zh: "路人", en: "passersby" }],
      versions: [1, 2, 3].map((i) => ({
        ...draftVersion,
        title: `版本${i}`,
      })),
    });
    const response = await post({ ...body("prompts"), scene: scenes[0], mode });
    expect(response.status).toBe(200);
    const result = await response.json();
    expect(result.output.versions).toHaveLength(3);
    expect(
      result.output.versions.every(
        (v: { zh: string; en: string }) =>
          v.zh.endsWith("--ar 16:9\n\n--no 路人") &&
          v.en.endsWith("--ar 16:9\n\n--no passersby"),
      ),
    ).toBe(true);
  },
);
it("returns a clarification without inventing scenes or prompts", async () => {
  upstream({
    kind: "clarification",
    question: "是否允许幻想？",
    options: ["允许", "不允许"],
  });
  const r = await post(body());
  expect((await r.json()).output).toEqual({
    kind: "clarification",
    question: "是否允许幻想？",
    options: ["允许", "不允许"],
    settingField: null,
  });
});
it.each([401, 402, 429, 500])(
  "sanitizes upstream failure %i without exposing credentials",
  async (status) => {
    upstream({}, status);
    const r = await post(body());
    expect(r.status).toBe(502);
    const value = await r.text();
    expect(value).not.toContain("upstream-secret");
    expect(value).not.toContain("test-secret");
  },
);
it.each([" ", "{}", "not-json"])(
  "rejects invalid output %j",
  async (output) => {
    upstream(output);
    expect((await post(body())).status).toBe(502);
  },
);
it("requires explicit choices and checks both current and incoming rule hashes", async () => {
  upstream({ kind: "scenes", scenes });
  expect((await post({ ...body(), settings: emptySettings() })).status).toBe(
    400,
  );
  expect((await post({ ...body("prompts"), scene: scenes[0] })).status).toBe(
    400,
  );
  expect((await post({ ...body(), ruleHash: "old" })).status).toBe(409);
  const file = path.join(root, "references/creative-engine.md");
  const original = await readFile(file, "utf8");
  await writeFile(file, original + "\nChanged");
  try {
    expect((await post(body())).status).toBe(409);
    expect((await (await realFetch(`${base}/api/rules`)).json()).synced).toBe(
      false,
    );
  } finally {
    await writeFile(file, original);
  }
});
it("rejects results if the skill changes while the model is generating", async () => {
  const file = path.join(root, "references/creative-engine.md");
  const original = await readFile(file, "utf8");
  vi.stubGlobal("fetch", async () => {
    await writeFile(file, original + "\nChanged during generation");
    return Response.json({
      choices: [
        {
          finish_reason: "stop",
          message: { content: JSON.stringify({ kind: "scenes", scenes }) },
        },
      ],
    });
  });
  try {
    expect((await post(body())).status).toBe(409);
  } finally {
    await writeFile(file, original);
  }
});
it("saves OpenAI independently, reads its models and routes structured generation through Responses", async () => {
  const configured = await realFetch(`${base}/api/config`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      provider: "openai",
      apiKey: "openai-test-secret",
      model: "text-fixture",
    }),
  });
  expect(configured.status).toBe(200);
  const publicValue = await configured.json();
  expect(publicValue).toMatchObject({
    provider: "openai",
    baseUrl: "https://api.openai.com/v1",
    hasKey: true,
  });
  expect(JSON.stringify(publicValue)).not.toContain("openai-test-secret");
  const calls: { url: string; body: any; auth: unknown }[] = [];
  const versions = [1, 2, 3].map((i) => ({
    ...draftVersion,
    title: `版本${i}`,
  }));
  vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
    calls.push({
      url,
      body: init.body ? JSON.parse(init.body as string) : null,
      auth: (init.headers as Record<string, string>).Authorization,
    });
    if (url.endsWith("/models"))
      return Response.json({ data: [{ id: "text-fixture" }] });
    return Response.json({
      status: "completed",
      output: [
        { type: "reasoning", summary: [] },
        {
          type: "message",
          content: [
            {
              type: "output_text",
              text: JSON.stringify({
                kind: "prompts",
                versions,
                negativeTerms: [],
              }),
            },
          ],
        },
      ],
    });
  });
  try {
    const models = await realFetch(`${base}/api/models`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: "openai" }),
    });
    expect((await models.json()).models).toEqual([
      { id: "text-fixture", name: "text-fixture" },
    ]);
    const generated = await post({
      ...body("prompts"),
      scene: scenes[0],
      mode: "camera",
    });
    expect(generated.status).toBe(200);
    const result = await generated.json();
    expect(result.output.versions).toHaveLength(3);
    expect(result.output.versions[0].zh).toBe(
      [
        "市井生活题材取自江南书铺的日常，以电影画面结合油画笔触呈现，窗光在细密的笔触间柔和过渡，自然中性色调保留木纹与纸页的本色。",
        versions[0].zh.subject,
        versions[0].zh.emotion,
        versions[0].zh.camera,
        "--ar 16:9",
      ].join("\n\n"),
    );
    expect(calls.map((c) => c.url)).toEqual([
      "https://api.openai.com/v1/models",
      "https://api.openai.com/v1/responses",
    ]);
    expect(calls.every((c) => c.auth === "Bearer openai-test-secret")).toBe(
      true,
    );
    expect(calls[1].body).not.toHaveProperty("thinking");
    expect(calls[1].body.store).toBe(false);
    expect(JSON.parse(calls[1].body.input[1].content).settings.mood).toEqual(
      settings.mood,
    );
    const deep = await realFetch(`${base}/api/config?provider=deepseek`);
    expect((await deep.json()).hasKey).toBe(true);
    const deleted = await realFetch(`${base}/api/config/key`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: "openai" }),
    });
    expect((await deleted.json()).hasKey).toBe(false);
    expect(
      (await (await realFetch(`${base}/api/config?provider=deepseek`)).json())
        .hasKey,
    ).toBe(true);
  } finally {
    await saveConfig(path.join(root, ".local"), { provider: "deepseek" });
  }
});
