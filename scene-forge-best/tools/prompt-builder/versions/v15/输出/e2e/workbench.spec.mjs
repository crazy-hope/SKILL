import { test, expect } from "@playwright/test";
import fs from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const evidence = process.env.SCENE_EVIDENCE_DIR || fileURLToPath(new URL("../../验证材料/", import.meta.url));
const store = "scene-forge-workspace-v15";
const read = (page) =>
  page.evaluate((key) => JSON.parse(localStorage.getItem(key)), store);
async function config(page, key = "mock-ui-secret") {
  await page.getByRole("button", { name: "配置模型接口" }).click();
  await page.getByLabel("API Key", { exact: true }).fill(key);
  await page.getByLabel("文本模型 ID", { exact: true }).fill("mock-text-model");
  await page.getByRole("button", { name: "保存配置", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "OpenAI 已配置" }),
  ).toBeVisible();
}
async function pick(page, field, values) {
  await page
    .getByRole("button", { name: `＋ 选择${field}`, exact: true })
    .click();
  for (const value of values) {
    await page.getByLabel(`搜索${field}`, { exact: true }).fill(value);
    await page
      .getByRole("checkbox", { name: value, exact: true })
      .first()
      .check();
  }
  await page.getByRole("button", { name: "完成选择", exact: true }).click();
}
test("desktop selection, locks, ten results, clipboard, downloads and schema4 persistence", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "生成双语提示词 ↗" }),
  ).toBeEnabled();
  await expect(page.locator(".condition-card")).toHaveCount(10);
  await pick(page, "题材", ["云上天宫"]);
  await page.getByRole("button", { name: "中国", exact: true }).click();
  await pick(page, "元素", ["白鹿", "仙女", "星沙云脊"]);
  await page.locator(".selected-name").filter({ hasText: "仙女" }).click();
  await page.getByLabel("性别（人物适用）", { exact: true }).fill("女性");
  await page.getByLabel("动作", { exact: true }).fill("缓步");
  await page.getByLabel("关系", { exact: true }).fill("沿着");
  await page.getByLabel("关系对象", { exact: true }).click();
  await page
    .locator(".ant-select-dropdown:visible .ant-select-item-option-content")
    .filter({ hasText: /^星沙云脊$/ })
    .click();
  await page.getByRole("button", { name: "完成设置" }).click();
  await page.getByRole("button", { name: "移除星沙云脊" }).click();
  await expect
    .poll(async () => {
      const s = await read(page);
      return s.draft.elementSettings.find((s) => s.name === "仙女")?.target;
    })
    .toBe("");
  expect(
    (await read(page)).draft.elementSettings.find((s) => s.name === "仙女"),
  ).toMatchObject({ gender: "女性", action: "缓步", relation: "自动" });
  await page.getByRole("button", { name: "清空负面" }).click();
  await page.getByRole("button", { name: "清空大致说明" }).click();
  await page.getByLabel("数量", { exact: true }).click();
  await page
    .locator(".ant-select-dropdown:visible .ant-select-item-option-content")
    .filter({ hasText: /^10 个方案 · 10 对双语$/ })
    .click();
  await page.getByRole("button", { name: "保存预设", exact: true }).click();
  await page.getByLabel("预设名称", { exact: true }).fill("React验证预设");
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await config(page);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "OpenAI 已配置" }),
  ).toBeVisible();
  await expect(page.getByLabel("负面提示词", { exact: true })).toHaveValue("");
  expect((await read(page)).presets[0].name).toBe("React验证预设");
  await page.screenshot({
    path: evidence + "桌面-React十面板.png",
    fullPage: true,
  });
  await page.evaluate(() => navigator.clipboard.writeText("UNCHANGED"));
  await page.getByRole("button", { name: "生成双语提示词 ↗" }).click();
  await expect(page.getByText("10 对双语", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    "UNCHANGED",
  );
  await page.getByRole("button", { name: /方案10：/ }).click();
  const saved = await read(page);
  expect(saved.history[0].spec.version).toBe("v11");
  await expect
    .poll(() => page.evaluate(() => navigator.clipboard.readText()))
    .toBe(saved.history[0].schemes[9].en);
  const scrolling = await page
    .locator(".result-detail")
    .evaluate((el) => ({ scroll: el.scrollHeight, client: el.clientHeight }));
  expect(scrolling.scroll).toBeGreaterThan(scrolling.client);
  await page.screenshot({
    path: evidence + "结果-十方案模拟.png",
    fullPage: true,
  });
  for (const [name, file] of [
    ["下载全部 .md", "result.md"],
    ["下载全部（单独）", "result.zip"],
  ]) {
    const pending = page.waitForEvent("download");
    await page.getByRole("button", { name, exact: true }).click();
    const download = await pending;
    await download.saveAs(evidence + file);
    expect(download.suggestedFilename()).toMatch(
      /云上天宫_Midjourney_9x16_\d{14}/,
    );
  }
  const md = await fs.readFile(evidence + "result.md", "utf8");
  expect(md).toContain("本次工作台输入");
  expect(md).toContain("本方案实际设计");
  expect(md).toContain(saved.history[0].schemes[9].design.元素);
  expect(md).toContain("规范：v11");
  expect(md).not.toContain("mock-ui-secret");
  const zipCount = execFileSync(
    "python3",
    [
      "-c",
      "import zipfile,sys; z=zipfile.ZipFile(sys.argv[1]); assert all('本方案实际设计' in z.read(n).decode('utf-8') for n in z.namelist()); print(len(z.namelist()))",
      evidence + "result.zip",
    ],
    { encoding: "utf8" },
  ).trim();
  expect(zipCount).toBe("10");
  await page.getByRole("button", { name: "关闭", exact: true }).click();
  await page.getByRole("button", { name: /记录与备份/ }).click();
  const backupDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出备份", exact: true }).click();
  const backup = await backupDownload;
  await backup.saveAs(evidence + "backup.json");
  const backupText = await fs.readFile(evidence + "backup.json", "utf8");
  expect(backupText).not.toContain("mock-ui-secret");
  expect(JSON.parse(backupText).history[0].schemes).toHaveLength(10);
  expect(JSON.parse(backupText).history[0].schemes[9].design).toEqual(saved.history[0].schemes[9].design);
  await page.locator("input[type=file]").setInputFiles({
    name: "invalid.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"format":"old"}'),
  });
  await expect(page.getByText(/恢复失败/)).toBeVisible();
  expect((await read(page)).history).toHaveLength(1);
  await page
    .locator("input[type=file]")
    .setInputFiles(evidence + "backup.json");
  await page.getByRole("button", { name: "确认", exact: true }).click();
  await expect(page.getByText("备份已恢复", { exact: true })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
  ).toBe(false);
  expect(errors).toEqual([]);
});
test("mobile layout and picker, explicit empty values survive reload", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "生成双语提示词 ↗" }),
  ).toBeEnabled();
  await pick(page, "题材", ["赛博朋克"]);
  await page.getByRole("button", { name: "中国", exact: true }).click();
  await page.getByRole("button", { name: "中国", exact: true }).click();
  await page.getByRole("button", { name: "清空负面" }).click();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "生成双语提示词 ↗" }),
  ).toBeEnabled();
  await expect(page.getByLabel("负面提示词", { exact: true })).toHaveValue("");
  expect((await read(page)).draft.地域).toBe("");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
  ).toBe(false);
  await expect(
    page.getByRole("button", { name: "生成双语提示词 ↗" }),
  ).toBeInViewport();
  await page.screenshot({
    path: evidence + "手机-React十面板.png",
    fullPage: true,
  });
  await config(page);
  await page.getByRole("button", { name: "生成双语提示词 ↗" }).click();
  await expect(page.getByText("5 对双语", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /方案5：/ }).click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
  ).toBe(false);
  await expect(page.locator(".result-detail")).toBeInViewport();
  await page.screenshot({
    path: evidence + "手机-双语结果模拟.png",
    fullPage: true,
  });
});
test("failed generation is not saved and does not erase the draft", async ({
  page,
}) => {
  await page.goto("/");
  await config(page, "mock-error");
  await page.getByLabel("大致说明", { exact: true }).fill("错误路径测试");
  await page.getByRole("button", { name: "生成双语提示词 ↗" }).click();
  await expect(
    page.getByText("生成失败，输入已保留", { exact: true }),
  ).toBeVisible();
  expect((await read(page)).history).toHaveLength(0);
  expect((await read(page)).draft.大致说明).toBe("错误路径测试");
});
test("clarification does not enter successful history", async ({ page }) => {
  await page.route("**/api/generate", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        status: "clarification",
        questions: ["模拟澄清：请确认两个冲突条件的优先级。"],
      }),
    }),
  );
  await page.goto("/");
  await config(page);
  await page.getByLabel("大致说明", {exact:true}).fill("无人，同时必须有人物");
  await page.getByRole("button", { name: "生成双语提示词 ↗" }).click();
  await expect(page.getByText("需要调整输入", { exact: true })).toBeVisible();
  expect((await read(page)).history).toHaveLength(0);
});
test("editing during generation preserves new draft but result keeps submitted input", async ({
  page,
}) => {
  let release, started;
  const gate = new Promise((r) => (release = r)),
    requestStarted = new Promise((r) => (started = r));
  await page.route("**/api/generate", async (route) => {
    const response = await route.fetch();
    started();
    await gate;
    await route.fulfill({ response });
  });
  await page.goto("/");
  await config(page);
  await page.getByLabel("大致说明", { exact: true }).fill("本次提交内容");
  await page.getByRole("button", { name: "生成双语提示词 ↗" }).click();
  await requestStarted;
  await page.getByRole("button", { name: "关闭", exact: true }).click();
  await page.getByLabel("大致说明", { exact: true }).fill("下一次草稿内容");
  release();
  await expect.poll(async () => (await read(page)).history.length).toBe(1);
  const state = await read(page);
  expect(state.draft.大致说明).toBe("下一次草稿内容");
  expect(state.history[0].brief.大致说明).toBe("本次提交内容");
});
