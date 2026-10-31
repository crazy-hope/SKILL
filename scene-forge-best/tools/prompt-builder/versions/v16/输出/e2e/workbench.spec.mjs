import { test, expect } from "@playwright/test";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
const evidence =
  process.env.SCENE_EVIDENCE_DIR ||
  fileURLToPath(new URL("../../验证材料/", import.meta.url));
const storage = "scene-forge-workspace-v16";
const read = (page) =>
  page.evaluate((key) => JSON.parse(localStorage.getItem(key)), storage);
async function configure(page, key = "mock-ui-secret", provider = "OpenAI") {
  await page
    .getByRole("button", { name: /配置模型接口|OpenAI 已配置|DeepSeek 已配置/ })
    .click();
  if (provider === "DeepSeek")
    await page.getByText("DeepSeek", { exact: true }).click();
  await page.getByLabel("API Key", { exact: true }).fill(key);
  await page.getByLabel("文本模型 ID", { exact: true }).fill("mock-text-model");
  await page.getByRole("button", { name: "保存配置", exact: true }).click();
  await expect(
    page.getByRole("button", { name: `${provider} 已配置` }),
  ).toBeVisible();
}
async function conceive(page) {
  await page
    .getByRole("button", { name: "构思 3 个场景", exact: true })
    .click();
  await expect(page.locator(".concept-card")).toHaveCount(3);
}
async function select(page, index = 0) {
  await page.locator(".concept-card").nth(index).click();
  await expect(page.locator(".concept-card").nth(index)).toHaveAttribute(
    "aria-pressed",
    "true",
  );
}
async function refine(page) {
  await page.getByRole("button", { name: "精修条件", exact: true }).click();
}
async function closeRefine(page) {
  await page.getByRole("button", { name: "完成精修", exact: true }).click();
}
async function pick(page, field, values) {
  await page
    .getByRole("button", { name: `＋ 选择${field}`, exact: true })
    .click();
  for (const v of values) {
    await page.getByLabel(`搜索${field}`, { exact: true }).fill(v);
    await page.getByRole("checkbox", { name: v, exact: true }).first().check();
  }
  await page.getByRole("button", { name: "完成选择", exact: true }).click();
}
async function count(page, n) {
  await page.getByLabel("展开数量", { exact: true }).click();
  await page
    .locator(".ant-select-dropdown:visible .ant-select-item-option-content")
    .filter({ hasText: new RegExp(`^${n} 对双语$`) })
    .click();
}
async function expand(page, n = 5) {
  await page
    .getByRole("button", { name: "展开双语提示词", exact: true })
    .click();
  await expect(
    page.locator(".result-meta").getByText(`${n} 对双语`, { exact: true }),
  ).toBeVisible();
}
async function waitForScreenshotIdle(page, scene = false) {
  await expect(page.locator(".ant-select-dropdown:visible")).toHaveCount(0);
  await expect(page.locator(".ant-message-notice:visible")).toHaveCount(0);
  await expect(page.locator(".ant-btn-loading")).toHaveCount(0);
  if (scene) {
    await expect(
      page.getByRole("button", { name: "构思 3 个场景", exact: true }),
    ).toBeEnabled();
    await expect(
      page.getByRole("button", { name: "展开双语提示词", exact: true }),
    ).toBeEnabled();
    await expect(
      page.locator(".concept-card[aria-pressed='true']"),
    ).toBeEnabled();
  }
  await page.evaluate(() => document.fonts.ready);
}
async function noOverflow(page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
  ).toBe(false);
}
test.beforeAll(async () => {
  await fs.mkdir(evidence, { recursive: true });
});

test("desktop two stages, count change, refresh, selected preset, ten outputs, exports and backup", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.locator(".condition-card")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "展开双语提示词", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: /荷间泛舟/ }).click();
  await page.getByLabel("想法", { exact: true }).fill("水面很静，无人。");
  await configure(page);
  await conceive(page);
  await select(page, 1);
  const selected = (await read(page)).draft.scene.selected;
  await count(page, 10);
  expect((await read(page)).draft.scene.selected).toEqual(selected);
  await waitForScreenshotIdle(page, true);
  await page.screenshot({
    path: evidence + "桌面-场景与三构思.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.getByRole("button", { name: /记录与备份/ }).click();
  await page.getByRole("button", { name: "保存预设", exact: true }).click();
  await page.getByLabel("预设名称", { exact: true }).fill("荷塘关系");
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "OpenAI 已配置" }),
  ).toBeVisible();
  await expect(page.locator(".concept-card")).toHaveCount(1);
  expect((await read(page)).presets[0].brief.scene.selected).toEqual(selected);
  await page.evaluate(() => navigator.clipboard.writeText("UNCHANGED"));
  await expand(page, 10);
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    "UNCHANGED",
  );
  await page.getByRole("button", { name: /方案10：/ }).click();
  const saved = await read(page);
  await expect
    .poll(() => page.evaluate(() => navigator.clipboard.readText()))
    .toBe(saved.history[0].schemes[9].en);
  expect(saved.history[0].spec.version).toBe("v14");
  expect(saved.history[0].brief.scene.selected).toEqual(selected);
  await expect(page.locator(".bilingual")).toBeVisible();
  await waitForScreenshotIdle(page);
  await expect(page.getByRole("dialog")).toBeInViewport();
  await expect(page.getByRole("dialog")).toHaveCSS("transform", "none");
  await page.screenshot({
    path: evidence + "桌面-十对双语模拟.png",
    fullPage: false,
    animations: "disabled",
  });
  for (const [name, file] of [
    ["下载全部 .md", "result.md"],
    ["下载全部（单独）", "result.zip"],
  ]) {
    const wait = page.waitForEvent("download");
    await page.getByRole("button", { name, exact: true }).click();
    await (await wait).saveAs(evidence + file);
  }
  const markdown = await fs.readFile(evidence + "result.md", "utf8");
  expect(markdown).toContain(selected.title);
  expect(markdown).toContain("本方案实际设计");
  expect(markdown).not.toContain("mock-ui-secret");
  await page.getByRole("button", { name: "关闭", exact: true }).click();
  await page.getByRole("button", { name: /记录与备份/ }).click();
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出备份", exact: true }).click();
  await (await pending).saveAs(evidence + "backup.json");
  const raw = await fs.readFile(evidence + "backup.json", "utf8");
  expect(raw).not.toContain("mock-ui-secret");
  expect(JSON.parse(raw).format).toBe("scene-forge-backup-v5");
  expect(JSON.parse(raw).history[0].brief.scene.selected).toEqual(selected);
  await page.locator("input[type=file]").setInputFiles({
    name: "old.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"format":"scene-forge-backup-v4"}'),
  });
  await expect(page.getByText(/恢复失败/)).toBeVisible();
  expect((await read(page)).history).toHaveLength(1);
  await page
    .locator("input[type=file]")
    .setInputFiles(evidence + "backup.json");
  await page.getByRole("button", { name: "确认", exact: true }).click();
  await expect(page.getByText("备份已恢复", { exact: true })).toBeVisible();
  await noOverflow(page);
  expect(errors).toEqual([]);
});

test("mobile custom scene, clear negative, DeepSeek config and full bilingual flow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByLabel("核心场景", { exact: true }).fill("潮汐后的无人海岸");
  await page
    .getByLabel("想法", { exact: true })
    .fill("礁石与退去的海水形成自然通路。");
  await configure(page, "mock-mobile-secret", "DeepSeek");
  await refine(page);
  await expect(page.locator(".condition-card")).toHaveCount(10);
  await page.getByRole("button", { name: "清空负面", exact: true }).click();
  await closeRefine(page);
  await page.reload();
  expect((await read(page)).draft.负面提示词).toBe("");
  expect((await read(page)).draft.scene.direction).toBe("");
  await conceive(page);
  await select(page);
  await noOverflow(page);
  await waitForScreenshotIdle(page, true);
  await page.screenshot({
    path: evidence + "手机-场景构思.png",
    fullPage: true,
    animations: "disabled",
  });
  await expand(page);
  await expect(page.locator(".bilingual")).toBeVisible();
  await noOverflow(page);
  await waitForScreenshotIdle(page);
  await expect(page.getByRole("dialog")).toBeInViewport();
  await expect(page.getByRole("dialog")).toHaveCSS("transform", "none");
  await page.screenshot({
    path: evidence + "手机-双语模拟.png",
    fullPage: false,
    animations: "disabled",
  });
});

test("advanced element attributes, required relations, region and empty negative persist", async ({
  page,
}) => {
  await page.goto("/");
  await refine(page);
  await pick(page, "题材", ["现代都市"]);
  await page.getByRole("button", { name: "中国", exact: true }).click();
  await pick(page, "元素", ["人物", "道路"]);
  await page.getByRole("button", { name: "人物设置 ↗", exact: true }).click();
  await page.getByLabel("年龄段", { exact: true }).fill("青年");
  await page.getByLabel("衣服款式", { exact: true }).fill("衬衫");
  await page.getByLabel("关系", { exact: true }).fill("沿着");
  await page.getByLabel("关系对象", { exact: true }).click();
  await page
    .locator(".ant-select-dropdown:visible .ant-select-item-option-content")
    .filter({ hasText: /^道路$/ })
    .click();
  await page.getByRole("button", { name: "完成设置", exact: true }).click();
  await page
    .getByRole("checkbox", { name: "人物必须出现", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "保存必需关系", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("checkbox", { name: "道路也必须出现", exact: true })
    .check();
  await page.getByRole("button", { name: "保存必需关系", exact: true }).click();
  await page.getByRole("button", { name: "清空负面", exact: true }).click();
  await closeRefine(page);
  await page.reload();
  const data = await read(page);
  expect(data.draft.地域).toBe("中国");
  expect(data.draft.elementSettings[0]).toMatchObject({
    presence: "required",
    age: "青年",
    clothing: "衬衫",
    target: "道路",
  });
  expect(data.draft.elementSettings[1].presence).toBe("required");
  expect(data.draft.负面提示词).toBe("");
});

test("concept error and clarification preserve input, retry succeeds without false history", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("想法", { exact: true }).fill("一个模糊的空旷念头");
  await configure(page, "mock-error");
  await page
    .getByRole("button", { name: "构思 3 个场景", exact: true })
    .click();
  await expect(
    page.getByText("构思失败，输入已保留", { exact: true }),
  ).toBeVisible();
  expect((await read(page)).history).toHaveLength(0);
  await configure(page, "mock-clarification");
  await page
    .getByRole("button", { name: "构思 3 个场景", exact: true })
    .click();
  await expect(page.getByText("需要调整输入", { exact: true })).toBeVisible();
  expect((await read(page)).history).toHaveLength(0);
  await configure(page);
  await conceive(page);
  expect((await read(page)).draft.大致说明).toBe("一个模糊的空旷念头");
});

test("edits invalidate choices and delayed concept response, even if reverted", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("想法", { exact: true }).fill("旧想法");
  await configure(page);
  await conceive(page);
  await select(page);
  await page.getByLabel("想法", { exact: true }).fill("新想法");
  await expect(page.locator(".concept-card")).toHaveCount(0);
  expect((await read(page)).draft.scene.selected).toBeNull();
  let release, started;
  const gate = new Promise((r) => (release = r)),
    waiting = new Promise((r) => (started = r));
  await page.route("**/api/concepts", async (route) => {
    const response = await route.fetch();
    started();
    await gate;
    await route.fulfill({ response });
  });
  await page
    .getByRole("button", { name: "构思 3 个场景", exact: true })
    .click();
  await waiting;
  await page.getByLabel("想法", { exact: true }).fill("后来想法");
  await page.getByLabel("想法", { exact: true }).fill("新想法");
  release();
  await expect(page.locator(".concept-placeholder")).toContainText(
    "输入已更新",
  );
  await expect(page.locator(".concept-card")).toHaveCount(0);
  expect((await read(page)).history).toHaveLength(0);
});

test("delayed final response after changed input cannot enter history", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("想法", { exact: true }).fill("本次想法");
  await configure(page);
  await conceive(page);
  await select(page);
  let release, started;
  const gate = new Promise((r) => (release = r)),
    waiting = new Promise((r) => (started = r));
  await page.route("**/api/generate", async (route) => {
    const response = await route.fetch();
    started();
    await gate;
    await route.fulfill({ response });
  });
  await page
    .getByRole("button", { name: "展开双语提示词", exact: true })
    .click();
  await waiting;
  await page.getByRole("button", { name: "关闭", exact: true }).click();
  await page.getByLabel("想法", { exact: true }).fill("下次想法");
  release();
  await expect(
    page.getByRole("button", { name: "展开双语提示词", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "查看进度", exact: true }),
  ).toHaveCount(0);
  expect((await read(page)).history).toHaveLength(0);
  expect((await read(page)).draft.大致说明).toBe("下次想法");
});

test("custom core removes lotus context and malicious concept markup is rendered as text", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: /荷间泛舟/ }).click();
  await page.getByLabel("核心场景", { exact: true }).fill("深海世界");
  expect((await read(page)).draft.scene).toMatchObject({
    core: "深海世界",
    direction: "",
    backdrop: "",
  });
  await configure(page);
  await page.route("**/api/concepts", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        status: "concepts",
        concepts: [1, 2, 3].map((n) => ({
          title: `模拟 ${n}`,
          summary: "<img src=x onerror=alert(1)>",
          relationship: `关系${n}`,
          variation: `差异${n}`,
        })),
      }),
    }),
  );
  await conceive(page);
  await expect(page.locator(".concept-card img")).toHaveCount(0);
  await expect(page.locator(".concept-card").first()).toContainText(
    "<img src=x onerror=alert(1)>",
  );
});

test("corrupt current storage and previous version remain untouched while editing", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(
    ({ storage }) => {
      localStorage.setItem(storage, "{broken");
      localStorage.setItem("scene-forge-workspace-v15", "old untouched");
    },
    { storage },
  );
  await page.reload();
  await expect(page.getByText(/本地创作记录无法读取/)).toBeVisible();
  await page.getByLabel("想法", { exact: true }).fill("新的未保存草稿");
  expect(await page.evaluate((key) => localStorage.getItem(key), storage)).toBe(
    "{broken",
  );
  expect(
    await page.evaluate(() =>
      localStorage.getItem("scene-forge-workspace-v15"),
    ),
  ).toBe("old untouched");
  await expect(
    page.getByRole("button", { name: "下载原记录", exact: true }),
  ).toBeVisible();
});
