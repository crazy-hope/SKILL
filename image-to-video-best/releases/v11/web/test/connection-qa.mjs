// Real browser and local HTTP, simulated upstream only; no saved credentials.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createApp } from "../lib/http.mjs";
import { readConfig } from "../lib/config.mjs";
import { generate } from "../lib/generate.mjs";
import { completion, request } from "./helpers.mjs";
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE || "playwright"
);
let sent;
const server = createServer(
  createApp({
    config: readConfig({}),
    generateImpl: (input, context, config, options) =>
      generate(input, context, config, {
        ...options,
        fetchImpl: async (url, options) => {
          sent = { url, ...options, body: JSON.parse(options.body) };
          return Response.json(completion());
        },
      }),
  }),
);
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
let browser;
try {
  browser = await chromium.launch({
    headless: true,
    ...(process.env.BROWSER_EXECUTABLE
      ? { executablePath: process.env.BROWSER_EXECUTABLE }
      : {}),
  });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/?mock=1`);
  const open = () =>
    page.getByRole("button", { name: /^(配置服务|连接设置)$/ }).click();
  const choose = async (label) => {
    await page.getByLabel("服务预设", { exact: true }).click();
    await page
      .locator(".ant-select-item-option-content")
      .getByText(label, { exact: true })
      .click();
  };
  const address = page.getByLabel("API 根地址", { exact: true });
  const model = page.getByLabel("看图模型 ID", { exact: true });
  const key = page.getByLabel("API Key", { exact: true });
  await open();
  await choose("DeepSeek");
  assert.equal(await address.inputValue(), "https://api.deepseek.com");
  // Regression: the React rewrite erased the working vision model preset.
  assert.equal(await model.inputValue(), "deepseek-flash");
  await key.fill("TEST_ONLY_DEEPSEEK");
  await page.getByRole("button", { name: "保存配置", exact: true }).click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  const result = await page.evaluate(async (body) => {
    const r = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return { status: r.status, data: await r.json() };
  }, request());
  assert.equal(result.status, 200);
  assert.equal(sent.url, "https://api.deepseek.com/chat/completions");
  assert.equal(sent.body.model, "deepseek-flash");
  assert.equal(sent.headers.Authorization, "Bearer TEST_ONLY_DEEPSEEK");
  assert.equal(sent.body.messages[1].content[1].image_url.url, request().image);
  assert.ok(!JSON.stringify(result).includes("TEST_ONLY_DEEPSEEK"));
  await open();
  assert.match(
    await page
      .locator(".ant-select")
      .filter({ has: page.getByLabel("服务预设", { exact: true }) })
      .innerText(),
    /DeepSeek/,
  );
  assert.equal(await model.inputValue(), "deepseek-flash");
  assert.equal(await key.inputValue(), "");
  await model.fill("account-specific-vision");
  await page.getByRole("button", { name: "保存配置", exact: true }).click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  await open();
  assert.equal(await model.inputValue(), "account-specific-vision");
  await key.fill("UNSAVED_KEY");
  await choose("OpenAI");
  assert.equal(await address.inputValue(), "https://api.openai.com/v1");
  assert.equal(await model.inputValue(), "");
  assert.equal(await key.inputValue(), "");
  await page.getByRole("button", { name: "保存配置", exact: true }).click();
  await page.getByRole("alert").filter({ hasText: "模型 ID" }).waitFor();
  await address.fill("https://gateway.example/v1");
  assert.match(
    await page
      .locator(".ant-select")
      .filter({ has: page.getByLabel("服务预设", { exact: true }) })
      .innerText(),
    /自定义/,
  );
  await choose("DeepSeek");
  assert.equal(await model.inputValue(), "deepseek-flash");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForFunction(
    () => document.documentElement.scrollWidth <= innerWidth,
  );
  await page.getByText("连接看图写词服务", { exact: true }).click();
  const bounds = await page.getByRole("dialog").boundingBox();
  assert.ok(bounds.x >= 0 && bounds.width <= 390, JSON.stringify(bounds));
  await page.screenshot({
    path: new URL("../screenshots/connection-deepseek.png", import.meta.url)
      .pathname,
    fullPage: true,
  });
  await key.fill("CLOSE_WITHOUT_SAVING");
  await page.locator(".ant-drawer-close").click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  await open();
  assert.equal(await key.inputValue(), "");
  assert.equal(await model.inputValue(), "account-specific-vision");
  assert.deepEqual(errors, []);
  console.log(
    "PASS: DeepSeek preset, save/restore, image request routing, custom model, switch/close key clearing and 390px layout (simulated upstream).",
  );
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}
