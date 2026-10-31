// Real browser, local simulated model output only. Never reads saved credentials.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createApp } from "../lib/http.mjs";
import { readConfig } from "../lib/config.mjs";
import { fixture } from "./helpers.mjs";
import { reviewEffects } from "../lib/effect-review.mjs";
import { AppError } from "../lib/errors.mjs";
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE || "playwright"
);
let resolveModels;
const pending = new Map();
let calls = 0,
  running = 0,
  peak = 0;
const sample =
  "# 全局基础硬性设定\n继承参考图的角色、构图和材质，保持电影质感。\n\n# 场景基底\n清透水体中，远景岩壁与前景水草形成空间层次。\n\n# 主体动态细节\n人物缓缓回眸，长发与衣料持续受水流带动，先牵动发根，再让发梢跟随，逐渐舒展。\n\n# 运镜规则\n镜头平稳后退，速度保持缓慢，一镜到底。\n\n# 同期环境音效\n仅保留低沉水流声，无背景音乐。\n\n# 硬性约束\n保持五官、手部、服饰稳定，环境动态全程持续。";
const app = createApp({
  config: { ...readConfig({}), ready: true, missing: [] },
  fetchImpl: async () => {
    await new Promise((resolve) => (resolveModels = resolve));
    return new Response(JSON.stringify({ data: [{ id: "fixture-vision" }] }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  },
  generateImpl: async (input, _context, _config, { signal }) => {
    calls++;
    running++;
    peak = Math.max(peak, running);
    try {
      await new Promise((resolve, reject) => {
        pending.set(input.idea, { resolve, reject, input });
        signal.addEventListener(
          "abort",
          () => reject(new AppError("CANCELLED", "测试取消", 499)),
          { once: true },
        );
      });
      const result = {
        ...fixture,
        level: input.level === "auto" ? "detailed" : input.level,
        submissionPrompt: "镜头平稳后退，速度保持缓慢，一镜到底。",
        prompt:
          sample.replaceAll("# ", "") +
          `\n\n模拟要求：${input.idea || "按图片自动构思"}`,
      };
      const raw = {
        effectChecks: [
          {
            requirement: "自然缓慢后退",
            source: "design",
            sourceText: "",
            promptText: "镜头平稳后退，速度保持缓慢，一镜到底。",
            submissionText: "镜头平稳后退，速度保持缓慢，一镜到底。",
            status: "self_checked",
            note: "模拟自检：引文存在不代表语义已被程序核验。",
          },
          {
            requirement: "示例待复核要求",
            source: "user",
            sourceText: "并不存在的用户要求",
            promptText: "缺失的正文原句",
            submissionText: "",
            status: "self_checked",
            note: "模拟失配用于验收提示。",
          },
        ],
      };
      return { ...result, ...reviewEffects(raw, input, result) };
    } finally {
      running--;
      pending.delete(input.idea);
    }
  },
});
const server = createServer(app);
await new Promise((r) => server.listen(0, "127.0.0.1", r));
let browser;
const wait = async (predicate) => {
  for (let i = 0; i < 150; i++) {
    if (predicate()) return;
    await new Promise((r) => setTimeout(r, 40));
  }
  throw Error(`Timed out waiting for local fixture: pending=${pending.size}, peak=${peak}`);
};
try {
  browser = await chromium.launch({
    headless: true,
    ...(process.env.BROWSER_EXECUTABLE
      ? { executablePath: process.env.BROWSER_EXECUTABLE }
      : {}),
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    permissions: ["clipboard-read", "clipboard-write"],
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/?mock=1`);
  await page.getByTestId("task-1").waitFor();
  assert.equal(await page.locator('[data-testid^="task-"]').count(), 10);
  await page.getByTestId("video-model").click();
  const options = page.locator(".ant-select-item-option-content");
  assert.deepEqual(await options.allTextContents(), [
    "Seedance 2.0",
    "Seedance 2.5",
    "Kling O3",
    "Kling 4.0",
  ]);
  await page.keyboard.press("Escape");
  const source = fileURLToPath(
    new URL(
      "../../v1/image-to-video-best/assets/cases/liquid-goddess/source.png",
      import.meta.url,
    ),
  );
  for (let i = 1; i <= 10; i++) {
    await page.getByTestId(`task-${i}`).click();
    await page.getByTestId("image-input").setInputFiles(source);
    if (i !== 1) await page.getByTestId("idea").fill(`任务 ${i}`);
    await page.waitForFunction(
      () => !document.querySelector('[data-testid="generate"]').disabled,
    );
  }
  await page.getByTestId("generate-all").click();
  await wait(() => pending.size === 10);
  assert.equal(peak, 10);
  await mkdir(new URL("../screenshots/", import.meta.url), { recursive: true });
  await page.screenshot({
    path: fileURLToPath(new URL("../screenshots/ten-task-running.png", import.meta.url)),
    fullPage: true,
    animations: "disabled",
  });
  assert.equal(pending.get("").input.idea, "");
  for (let i = 10; i >= 5; i--) pending.get(`任务 ${i}`).resolve();
  pending.get("任务 3").resolve();
  pending
    .get("任务 2")
    .reject(new AppError("UPSTREAM_RATE_LIMIT", "模拟限流", 502));
  await page.getByTestId("task-1").click();
  await page.getByTestId("cancel").click();
  await wait(() => pending.size === 1);
  assert.ok(pending.has("任务 4"));
  pending.get("任务 4").resolve();
  await wait(() => pending.size === 0);
  await page.getByTestId("task-3").click();
  await page.getByTestId("prompt-output").waitFor();
  assert.equal(
    await page.getByTestId("prompt-output").locator("h3").count(),
    6,
  );
  assert.match(await page.getByTestId("prompt-output").textContent(), /任务 3/);
  await page.getByRole("button", { name: "复制提示词", exact: true }).click();
  assert.match(
    await page.evaluate(() => navigator.clipboard.readText()),
    /全局基础硬性设定/,
  );
  await page.getByRole("button", { name: "复制全部", exact: true }).click();
  assert.match(
    await page.evaluate(() => navigator.clipboard.readText()),
    /本次未在线复核/,
  );
  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "下载 Markdown" }).click();
  const download = await downloadEvent;
  assert.match(download.suggestedFilename(), /v6/);
  assert.match(await readFile(await download.path(), "utf8"), /任务 3/);
  assert.match(
    await readFile(await download.path(), "utf8"),
    /效果核对（模型自检）/,
  );
  await page.getByTestId("review-notice").waitFor();
  await page.getByRole("tab", { name: "设计与设置" }).click();
  await page.getByTestId("effect-review").waitFor();
  await page.getByText("示例待复核要求", { exact: true }).click();
  assert.match(
    await page.getByTestId("effect-review").textContent(),
    /未在同一个需求字段/,
  );
  await page.getByRole("tab", { name: "完整提示词" }).click();
  await page.getByTestId("idea").fill("修改后的任务 3");
  await page.getByTestId("stale-notice").waitFor();
  assert.match(await page.getByTestId("prompt-output").textContent(), /任务 3/);
  // Failed tasks are retried independently; batch skips failures and completed entries.
  await page.getByTestId("task-2").click();
  await page.getByTestId("generate").click();
  await wait(() => pending.has("任务 2"));
  pending.get("任务 2").resolve();
  await wait(() => pending.size === 0);
  await page.getByTestId("task-3").click();
  await page.getByTestId("generate").click();
  await wait(() => pending.has("修改后的任务 3"));
  await page.getByTestId("idea").fill("更新后需求");
  await wait(() => pending.size === 0);
  await page.getByTestId("stale-notice").waitFor();
  await page.getByRole("button", { name: "复制镜头", exact: true }).click();
  assert.equal(await page.locator('[data-testid^="task-"]').count(), 11);
  assert.equal(await page.getByTestId("idea").inputValue(), "更新后需求");
  assert.equal(await page.getByTestId("prompt-output").count(), 0);
  await page.getByRole("button", { name: "新增镜头", exact: true }).click();
  assert.equal(await page.getByTestId("idea").inputValue(), "");
  assert.equal(await page.getByTestId("generate").isDisabled(), true);
  // Configuration drawer is keyboard dismissible and never receives a real key.
  await page.getByRole("button", { name: "连接设置", exact: true }).click();
  await page.getByLabel("API 根地址", { exact: true }).waitFor();
  await page.getByLabel("API Key", { exact: true }).fill("mock-unsaved-key");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "连接设置", exact: true }).click();
  assert.equal(
    await page.getByLabel("API Key", { exact: true }).inputValue(),
    "",
  );
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "连接设置", exact: true }).click();
  await page
    .getByLabel("API 根地址", { exact: true })
    .fill("https://example.invalid/v1");
  await page.getByLabel("API Key", { exact: true }).fill("mock-only-secret");
  await page
    .getByRole("button", { name: "测试并读取模型", exact: true })
    .click();
  await wait(() => Boolean(resolveModels));
  assert.equal(
    await page.getByLabel("API 根地址", { exact: true }).isDisabled(),
    true,
  );
  resolveModels();
  await page
    .getByText("连接成功，已读取模型列表。", { exact: false })
    .waitFor();
  await page.getByLabel("看图模型 ID", { exact: true }).fill("fixture-vision");
  await page.getByRole("button", { name: "保存配置", exact: true }).click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  const saved = await page.evaluate(() =>
    fetch("/api/config").then((r) => r.json()),
  );
  assert.equal(saved.connection.hasKey, true);
  assert.equal(saved.connection.model, "fixture-vision");
  assert.equal(JSON.stringify(saved).includes("mock-only-secret"), false);
  await page.getByTestId("task-4").click();
  await page.waitForFunction(
    () => !document.querySelector('[data-testid="generate"]').disabled,
  );
  await page.locator(".ant-message-notice").waitFor({ state: "hidden" });
  const shots = new URL("../screenshots/", import.meta.url);
  await mkdir(shots, { recursive: true });
  assert.ok(
    await page
      .getByTestId("prompt-output")
      .evaluate(
        (el) =>
          el.getBoundingClientRect().left -
            el.closest("aside").getBoundingClientRect().left >
          15,
      ),
  );
  await page.screenshot({
    path: fileURLToPath(new URL("ten-task-desktop.png", shots)),
    fullPage: true,
    animations: "disabled",
  });
  await page.getByRole("tab", { name: "设计与设置" }).click();
  await page.getByText("自然缓慢后退", { exact: true }).click();
  await page.getByTestId("effect-review").scrollIntoViewIfNeeded();
  await page.screenshot({
    path: fileURLToPath(new URL("ten-task-review.png", shots)),
    fullPage: true,
    animations: "disabled",
  });
  await page.getByRole("tab", { name: "完整提示词" }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await page.getByText("查看结果", { exact: true }).click();
  await page.getByTestId("prompt-output").waitFor({ state: "visible" });
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await page.screenshot({
    path: fileURLToPath(new URL("ten-task-mobile-result.png", shots)),
    fullPage: true,
    animations: "disabled",
  });
  await page.getByRole("tab", { name: "设计与设置" }).click();
  await page.getByTestId("effect-review").waitFor({ state: "visible" });
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await page.screenshot({
    path: fileURLToPath(new URL("ten-task-mobile-review.png", shots)),
    fullPage: true,
    animations: "disabled",
  });
  await page.getByText("编辑镜头", { exact: true }).click();
  await page.screenshot({
    path: fileURLToPath(new URL("ten-task-mobile-editor.png", shots)),
    fullPage: true,
    animations: "disabled",
  });
  assert.deepEqual(errors, []);
  console.log(
    `PASS React browser QA: four models, image-only, peak ${peak} concurrent calls, cancel/error/retry/edit isolation, copy/download, duplicate/new task, secret field reset, model-list lock and config save, padded scrollable result, effect review evidence/warnings/export, desktop/390px. SIMULATED OUTPUT ONLY; calls=${calls}.`,
  );
} finally {
  await browser?.close();
  server.closeAllConnections();
  await new Promise((r) => server.close(r));
}
