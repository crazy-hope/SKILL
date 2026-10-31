import { test, expect } from "@playwright/test";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { emptyBrief } from "../brief.mjs";
test.use({ actionTimeout: 8000 });
const evidence = fileURLToPath(new URL("../../验证材料/", import.meta.url));
const storage = "scene-forge-workspace-v12";
const read = (page) =>
  page.evaluate((k) => JSON.parse(localStorage.getItem(k)), storage);
const popup = (page) =>
  page.locator(".ant-select-dropdown:visible:not(.ant-slide-up-leave)");
async function choose(page, label, value) {
  await page
    .getByRole("button", { name: `展开${label}选项`, exact: true })
    .click();
  await expect(popup(page)).toBeVisible();
  await page.getByLabel(label, { exact: true }).fill(value);
  await popup(page)
    .locator(".ant-select-item-option-content")
    .filter({ hasText: new RegExp(`^${value}$`) })
    .click();
  await expect(page.getByLabel(label, { exact: true })).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator('.ant-select-dropdown:visible')).toHaveCount(0);
}
for (const [layout, viewport] of [
  ["桌面", { width: 1440, height: 1000 }],
  ["手机", { width: 390, height: 844 }],
]) {
  test(`${layout}: all character dropdowns click, search, reopen and persist independently`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await page.evaluate(
      ({ key, draft }) =>
        localStorage.setItem(
          key,
          JSON.stringify({
            format: "scene-forge-backup-v3",
            draft,
            presets: [],
            history: [],
          }),
        ),
      {
        key: storage,
        draft: {
          ...emptyBrief(),
          题材: "云上天宫；现代都市",
          元素: "仙人；旅人甲；白鹿",
        },
      },
    );
    await page.reload();
    await page.locator(".selected-name").filter({ hasText: /^仙人/ }).click();
    await expect(
      page.getByText("仙人 · 人物设置", { exact: true }),
    ).toBeVisible();
    const labels = [
      "性别（人物适用）",
      "人物数量",
      "年龄段",
      "发型",
      "衣服款式",
      "服装颜色",
      "材质",
      "配饰",
      "画面占比",
      "动作",
      "画面位置",
      "前后层次",
      "关系",
    ];
    for (const label of labels) {
      await page.getByLabel(label, { exact: true }).click();
      await expect(popup(page)).toBeVisible();
      expect(
        await popup(page).locator(".ant-select-item-option").count(),
      ).toBeGreaterThan(1);
      await page.getByLabel(label, { exact: true }).press("Escape");
      await expect(popup(page)).toHaveCount(0);
    }
    for (const label of ["角色", "相对尺度", "关系对象"]) {
      await page.getByLabel(label, { exact: true }).click();
      await expect(popup(page)).toBeVisible();
      await page.getByLabel(label, { exact: true }).press("Escape");
    }
    await choose(page, "性别（人物适用）", "女性");
    await choose(page, "人物数量", "2人");
    await choose(page, "年龄段", "青年");
    await choose(page, "发型", "高马尾");
    await page.getByLabel("衣服款式", { exact: true }).fill("交领");
    await expect(
      popup(page)
        .locator(".ant-select-item-option-content")
        .filter({ hasText: "交领仙袍" }),
    ).toBeVisible();
    await popup(page)
      .locator(".ant-select-item-option-content")
      .filter({ hasText: /^交领仙袍$/ })
      .click();
    await page.getByLabel("衣服款式", { exact: true }).click();
    await expect(
      popup(page)
        .locator(".ant-select-item-option-content")
        .filter({ hasText: /^自动$/ }),
    ).toBeVisible();
    await popup(page)
      .locator(".ant-select-dropdown-list-holder")
      .evaluate((el) => {
        el.scrollTop = 400;
      });
    await expect(
      popup(page)
        .locator(".ant-select-item-option-content")
        .filter({ hasText: /^衬衫$/ }),
    ).toBeVisible();
    await page.getByLabel("衣服款式", { exact: true }).press("Escape");
    await choose(page, "服装颜色", "青色");
    await choose(page, "材质", "丝绸");
    await page.getByLabel("配饰", { exact: true }).fill("定制银扣");
    await page.getByLabel("配饰", { exact: true }).press("Escape");
    await page
      .getByRole("button", { name: "展开配饰选项", exact: true })
      .click();
    expect(
      await popup(page).locator(".ant-select-item-option").count(),
    ).toBeGreaterThan(1);
    await page.getByText("人物服饰", { exact: true }).click();
    await expect(popup(page)).toHaveCount(0);
    await page.getByLabel("发型", { exact: true }).fill("短");
    await page.getByLabel("发型", { exact: true }).press("ArrowDown");
    await page.getByLabel("发型", { exact: true }).press("Enter");
    await expect(page.getByLabel("发型", { exact: true })).toHaveValue("短发");
    const color = page
      .getByLabel("服装颜色", { exact: true })
      .locator("xpath=ancestor::label");
    await color.locator(".ant-input-clear-icon").click();
    await expect(page.getByLabel("服装颜色", { exact: true })).toHaveValue(
      "自动",
    );
    await choose(page, "服装颜色", "青色");
    await page
      .getByText("人物基本属性", { exact: true })
      .scrollIntoViewIfNeeded();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
    ).toBe(false);
    await page.screenshot({ path: evidence + `${layout}-人物设置.png`, animations: 'disabled' });
    await page.getByRole("button", { name: "完成设置" }).click();
    await page
      .locator(".selected-name")
      .filter({ hasText: /^旅人甲/ })
      .click();
    await page.getByLabel("衣服款式", { exact: true }).fill("皮衣");
    await page.getByRole("button", { name: "完成设置" }).click();
    await page.getByRole("button", { name: "保存预设", exact: true }).click();
    await page.getByLabel("预设名称", { exact: true }).fill("人物属性验证");
    await page.getByRole("button", { name: "保存", exact: true }).click();
    await page.reload();
    const saved = await read(page),
      actor = saved.draft.elementSettings.find((s) => s.name === "仙人");
    expect(actor).toMatchObject({
      gender: "女性",
      count: "2人",
      age: "青年",
      hairstyle: "短发",
      clothing: "交领仙袍",
      clothingColor: "青色",
      clothingMaterial: "丝绸",
      accessories: "定制银扣",
    });
    expect(
      saved.draft.elementSettings.find((s) => s.name === "旅人甲").clothing,
    ).toBe("皮衣");
    expect(saved.presets[0].brief.elementSettings).toEqual(
      saved.draft.elementSettings,
    );
    await page.locator(".selected-name").filter({ hasText: /^白鹿/ }).click();
    await expect(page.getByLabel("年龄段", { exact: true })).toHaveCount(0);
    await expect(page.getByLabel("对象数量", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "完成设置" }).click();
    for (const name of ["白鹿", "旅人甲"])
      await page
        .getByRole("button", { name: `移除${name}`, exact: true })
        .click();
    await page.locator(".selected-name").filter({ hasText: /^仙人/ }).click();
    await page.getByLabel("关系对象", { exact: true }).click();
    await expect(
      page.getByText("暂无其他已选元素，请先添加关系对象", { exact: true }),
    ).toBeVisible();
  });
}
test("character payload, presets backup restore and downloaded Markdown preserve every attribute", async ({
  page,
}) => {
  await page.goto("/");
  const draft = {
    ...emptyBrief(),
    题材: "现代都市",
    元素: "人物",
    elementSettings: [
      {
        name: "人物",
        role: "主体",
        scale: "常规",
        frame: "自动",
        count: "2人",
        action: "自动",
        position: "自动",
        depth: "自动",
        relation: "自动",
        target: "",
        gender: "女性",
        age: "青年",
        hairstyle: "短发",
        clothing: "衬衫",
        clothingColor: "蓝色",
        clothingMaterial: "棉布",
        accessories: "无配饰",
      },
    ],
  };
  await page.evaluate(
    ({ key, draft }) =>
      localStorage.setItem(
        key,
        JSON.stringify({
          format: "scene-forge-backup-v3",
          draft,
          presets: [],
          history: [],
        }),
      ),
    { key: storage, draft },
  );
  await page.reload();
  await page.getByRole("button", { name: "配置模型接口", exact: true }).click();
  await page.getByLabel("API Key", { exact: true }).fill("mock-v14-key");
  await page
    .getByRole("button", { name: "测试连接 / 获取模型", exact: true })
    .click();
  await expect(page.getByText(/连接成功/)).toBeVisible();
  await choose(page, "文本模型 ID", "mock-text-model");
  await page.getByRole("button", { name: "保存配置", exact: true }).click();
  const request = page.waitForRequest((req) =>
    req.url().endsWith("/api/generate"),
  );
  await page
    .getByRole("button", { name: "生成双语提示词 ↗", exact: true })
    .click();
  expect((await request).postDataJSON().brief.elementSettings).toEqual(
    draft.elementSettings,
  );
  await expect(page.getByText("5 对双语", { exact: true })).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "下载全部 .md", exact: true }).click();
  await (await download).saveAs(evidence + "人物属性-模拟.md");
  const markdown = await fs.readFile(evidence + "人物属性-模拟.md", "utf8");
  for (const value of [
    "年龄段=青年",
    "衣服款式=衬衫",
    "材质=棉布",
    "配饰=无配饰",
  ])
    expect(markdown).toContain(value);
  await page.getByRole("button", { name: "关闭", exact: true }).click();
  await page.getByRole("button", { name: /记录与备份/ }).click();
  const backup = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出备份", exact: true }).click();
  await (await backup).saveAs(evidence + "人物属性-备份.json");
  const raw = await fs.readFile(evidence + "人物属性-备份.json", "utf8");
  expect(raw).not.toContain("mock-v14-key");
  expect(JSON.parse(raw).history[0].brief.elementSettings).toEqual(
    draft.elementSettings,
  );
  await page
    .locator("input[type=file]")
    .setInputFiles(evidence + "人物属性-备份.json");
  await page.getByRole("button", { name: "确认", exact: true }).click();
  await expect(page.getByText("备份已恢复", { exact: true })).toBeVisible();
  expect((await read(page)).draft.elementSettings).toEqual(
    draft.elementSettings,
  );
});
