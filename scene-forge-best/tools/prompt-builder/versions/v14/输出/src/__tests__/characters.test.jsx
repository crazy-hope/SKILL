import React, { useState } from "react";
import { it, expect, afterEach } from "vitest";
import {
  render,
  screen,
  cleanup,
  fireEvent,
  waitFor,
} from "@testing-library/react";
import { Choice, ConditionGrid } from "../components/Conditions.jsx";
import { emptyBrief } from "../../brief.mjs";
afterEach(cleanup);
it("clicking a saved automatic value reveals all options and has an accessible arrow", async () => {
  function Form() {
    const [v, set] = useState("自动");
    return (
      <Choice
        label="动作"
        value={v}
        onChange={set}
        options={["自动", "静立", "缓步"]}
      />
    );
  }
  render(<Form />);
  fireEvent.mouseDown(screen.getByRole("combobox"));
  await waitFor(() =>
    expect(document.querySelectorAll(".ant-select-item-option")).toHaveLength(
      3,
    ),
  );
  expect(
    screen.getByRole("button", { name: "展开动作选项" }),
  ).toBeInTheDocument();
});
it("person drawers expose complete settings while a known animal does not", () => {
  function Form() {
    const [b, set] = useState({
      ...emptyBrief(),
      题材: "仙侠江湖",
      元素: "游历剑客；白鹿",
    });
    return <ConditionGrid draft={b} onChange={set} />;
  }
  render(<Form />);
  fireEvent.click(screen.getByRole("button", { name: /游历剑客.*设置/ }));
  for (const label of [
    "人物数量",
    "年龄段",
    "发型",
    "衣服款式",
    "服装颜色",
    "材质",
    "配饰",
  ])
    expect(screen.getByLabelText(label, { exact: true })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "完成设置" }));
  fireEvent.click(screen.getByRole("button", { name: /白鹿.*设置/ }));
  expect(
    screen.queryByLabelText("衣服款式", { exact: true }),
  ).not.toBeInTheDocument();
});

it("model configuration uses the same clickable dropdown including custom IDs", async () => {
  const { Settings } = await import("../components/Settings.jsx");
  render(
    <Settings
      provider="openai"
      profiles={{ openai: { model: "custom-model" }, deepseek: { model: "" } }}
      keys={{ openai: "mock", deepseek: "" }}
      config={{}}
      api={async () => ({ models: ["model-a", "model-b"] })}
      onClose={() => {}}
      onSave={() => {}}
      onClear={() => true}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "测试连接 / 获取模型" }));
  await screen.findByText(/连接成功/);
  fireEvent.click(screen.getByRole("button", { name: "展开文本模型 ID选项" }));
  await waitFor(() =>
    expect(document.querySelectorAll(".ant-select-item-option")).toHaveLength(
      2,
    ),
  );
});
