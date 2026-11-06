// @vitest-environment jsdom
import React, { useState } from "react";
import { afterEach, it, expect } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MultiChoice } from "../src/components/SettingsPanel";
import { emptySettings } from "../shared/contracts";
import { SettingsPanel } from "../src/components/SettingsPanel";
afterEach(cleanup);
it("allows multiple directions and custom additions without replacing previous choices", async () => {
  function Harness() {
    const [value, set] = useState<string[]>([]);
    return (
      <MultiChoice
        label="题材"
        values={value}
        options={["生活", "历史"]}
        onChange={set}
      />
    );
  }
  render(<Harness />);
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "生活" }));
  await user.click(screen.getByRole("button", { name: "历史" }));
  expect(screen.getByRole("button", { name: "移除生活" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "移除历史" })).toBeTruthy();
  await user.type(
    screen.getByPlaceholderText("搜索或输入自定义方向"),
    "建筑＋产品{Enter}",
  );
  expect(screen.getByRole("button", { name: "移除建筑" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "移除产品" })).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "移除生活" }));
  expect(screen.queryByRole("button", { name: "移除生活" })).toBeNull();
});
it("starts with no chosen creative defaults and keeps culture and realism distinct", () => {
  render(
    <SettingsPanel
      settings={emptySettings()}
      onChange={() => {}}
      onAdvice={() => {}}
      errors={[]}
      disabled={false}
    />,
  );
  expect(
    screen
      .getByRole("button", { name: "电影画面" })
      .getAttribute("aria-pressed"),
  ).toBe("false");
  expect(screen.getByLabelText("文化背景")).toBeTruthy();
  expect(screen.getByLabelText("内容现实性")).toBeTruthy();
});
it("explains palette meaning and prompt wording on hover without selecting it", async () => {
  render(
    <SettingsPanel
      settings={emptySettings()}
      onChange={() => {}}
      onAdvice={() => {}}
      errors={[]}
      disabled={false}
    />,
  );
  const user = userEvent.setup();
  const option = screen.getByRole("button", {
    name: "黑白灰阶：以明暗层次组织画面",
  });
  await user.hover(option);
  const tooltip = await screen.findByRole("tooltip");
  expect(tooltip.textContent).toContain("不使用彩色");
  expect(tooltip.textContent).toContain("提示词表达示例");
  expect(tooltip.textContent).toContain("整幅画面采用黑白灰阶");
  expect(option.getAttribute("aria-pressed")).toBe("false");
  await user.keyboard("{Escape}");
  expect(screen.queryByRole("tooltip")).toBeNull();
});
it("supports keyboard help for media and keeps selection unchanged", async () => {
  render(
    <SettingsPanel
      settings={emptySettings()}
      onChange={() => {}}
      onAdvice={() => {}}
      errors={[]}
      disabled={false}
    />,
  );
  const user = userEvent.setup();
  await user.click(screen.getByLabelText("搜索表现方式"));
  await user.tab();
  const tooltip = await screen.findByRole("tooltip");
  expect(tooltip.textContent).toContain("电影画面");
  expect(tooltip.textContent).toContain("不会自动变成纪实摄影");
  expect(
    screen
      .getByRole("button", { name: "电影画面" })
      .getAttribute("aria-pressed"),
  ).toBe("false");
});
