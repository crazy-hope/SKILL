import {actualDesign} from '../../../tests/actual-design-fixture.mjs';
import React, { useState } from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { emptyBrief } from "../../brief.mjs";
import { ConditionGrid } from "../components/Conditions.jsx";
import { ResultView } from "../components/Results.jsx";
afterEach(cleanup);
describe("React behavior parity", () => {
  it("clears region with panel 01 and preserves empty negative independently", () => {
    function Form() {
      const [draft, setDraft] = useState({
        ...emptyBrief(),
        题材: "赛博朋克",
        地域: "中国",
        负面提示词: "",
      });
      return (
        <>
          <ConditionGrid draft={draft} onChange={setDraft} />
          <output data-testid="state">{JSON.stringify(draft)}</output>
        </>
      );
    }
    render(<Form />);
    fireEvent.click(screen.getByRole("button", { name: "清空题材" }));
    const draft = JSON.parse(screen.getByTestId("state").textContent);
    expect(draft.题材).toBe("");
    expect(draft.地域).toBe("");
    expect(draft.负面提示词).toBe("");
    expect(draft.数量).toBe("5条");
  });
  it("repeated region click cancels selection", () => {
    function Form() {
      const [draft, setDraft] = useState(emptyBrief());
      return <ConditionGrid draft={draft} onChange={setDraft} />;
    }
    render(<Form />);
    const region = screen.getByRole("button", { name: "中国" });
    fireEvent.click(region);
    expect(region).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(region);
    expect(region).toHaveAttribute("aria-pressed", "false");
  });
  it("renders first result without copying; title click copies only full English and user markup stays text", () => {
    const copy = vi.fn().mockResolvedValue(true),
      r = {
        brief: emptyBrief(),
        spec: { version: "v10", sha256: "test" },
        schemes: [
          {
            design: actualDesign(),
            name: "第一条",
            zh: "<img src=x onerror=alert(1)>",
            en: "Complete first English",
            concept: "一",
            specs: "横向",
          },
          {
            design: actualDesign(),
            name: "第二条",
            zh: "第二条中文",
            en: "Complete second English",
            concept: "二",
            specs: "竖向",
          },
        ],
      };
    const { container } = render(<ResultView result={r} onCopy={copy} />);
    expect(copy).not.toHaveBeenCalled();
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByText("<img src=x onerror=alert(1)>")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "方案2：第二条" }));
    expect(copy).toHaveBeenCalledWith("Complete second English");
    expect(screen.getByText("第二条中文")).toBeVisible();
  });
});
it("commits pending custom input when finishing the selection drawer", () => {
  function Form() {
    const [draft, setDraft] = useState(emptyBrief());
    return (
      <>
        <ConditionGrid draft={draft} onChange={setDraft} />
        <output data-testid="state">{JSON.stringify(draft)}</output>
      </>
    );
  }
  render(<Form />);
  fireEvent.click(screen.getByRole("button", { name: "＋ 选择元素" }));
  fireEvent.change(screen.getByLabelText("自定义元素"), {
    target: { value: "自定义云桥" },
  });
  fireEvent.click(screen.getByRole("button", { name: "完成选择" }));
  expect(JSON.parse(screen.getByTestId("state").textContent).元素).toBe(
    "自定义云桥",
  );
});
it("bounds custom gender input before normalization and keeps other locks", () => {
  function Form() {
    const [draft, setDraft] = useState({ ...emptyBrief(), 元素: "仙女" });
    return (
      <>
        <ConditionGrid draft={draft} onChange={setDraft} />
        <output data-testid="state">{JSON.stringify(draft)}</output>
      </>
    );
  }
  render(<Form />);
  fireEvent.click(screen.getByRole("button", { name: "仙女设置 ↗" }));
  fireEvent.change(screen.getByLabelText("性别（人物适用）"), {
    target: { value: "女".repeat(81) },
  });
  const state = JSON.parse(screen.getByTestId("state").textContent);
  expect(state.elementSettings[0]?.gender).toBe("女".repeat(80));
});
it("clipboard failure stays visible without losing the selected bilingual text", async () => {
  const result = {
    brief: emptyBrief(),
    spec: { version: "v10", sha256: "test" },
    schemes: [
      {
        name: "复制失败测试",
        design: actualDesign(),
        zh: "完整中文仍可手动选择",
        en: "English remains selectable",
      },
    ],
  };
  render(
    <ResultView result={result} onCopy={vi.fn().mockResolvedValue(false)} />,
  );
  fireEvent.click(screen.getByRole("button", { name: "方案1：复制失败测试" }));
  expect(
    await screen.findByText("复制失败，请选中文字手动复制。"),
  ).toBeVisible();
  expect(screen.getByText("English remains selectable")).toBeVisible();
});
