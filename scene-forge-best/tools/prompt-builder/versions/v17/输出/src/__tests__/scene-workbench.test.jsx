import React from "react";
import { it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  cleanup,
  waitFor,
  act,
} from "@testing-library/react";
import { App as AntApp } from "antd";
import Workbench from "../App.jsx";
import { emptyWorkspace, saveWorkspace, STORAGE } from "../workspace.mjs";
import { saveKeys } from "../credentials.mjs";
import { actualDesign } from "../../../tests/actual-design-fixture.mjs";
const concepts = [1, 2, 3].map((n) => ({
  title: `模拟构思${n}`,
  summary: `模拟画面${n}`,
  relationship: `模拟关系${n}`,
  variation: `模拟差异${n}`,
}));
let handler;
const state = () => JSON.parse(localStorage.getItem(STORAGE));
function mount() {
  return render(
    <AntApp>
      <Workbench />
    </AntApp>,
  );
}
async function start() {
  fireEvent.change(screen.getByLabelText("想法"), {
    target: { value: "静静的无人水面" },
  });
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "构思 3 个场景" })).toBeEnabled(),
  );
  fireEvent.click(screen.getByRole("button", { name: "构思 3 个场景" }));
}
beforeEach(() => {
  localStorage.clear();
  const w = emptyWorkspace();
  w.profiles.openai.model = "mock-model";
  saveWorkspace(localStorage, w);
  saveKeys(localStorage, { openai: "mock-key" });
  handler = async (path, body) =>
    path === "/api/concepts"
      ? { status: "concepts", concepts }
      : {
          status: "ready",
          brief: body.brief,
          spec: { version: "v14", sha256: "mock" },
          provider: body.provider,
          model: body.model,
          schemes: [
            {
              name: "模拟成品",
              zh: "模拟完整中文",
              en: "Mock complete English",
              design: actualDesign(),
            },
          ],
        };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (path, options) => ({
      ok: true,
      json: async () =>
        path === "/api/config"
          ? { token: "mock-token", spec: { version: "v14" } }
          : handler(path, JSON.parse(options.body)),
    })),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it("starts with core and idea, while full fields and editable negative live in refinement", async () => {
  mount();
  expect(screen.getByLabelText("核心场景")).toHaveValue("");
  expect(screen.getByLabelText("想法")).toHaveValue("");
  expect(screen.queryByLabelText("负面提示词")).toBeNull();
  expect(screen.getByRole("button", { name: "展开双语提示词" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "精修条件" }));
  expect(screen.getByLabelText("负面提示词")).not.toHaveValue("");
  expect(document.querySelectorAll(".condition-card")).toHaveLength(10);
  fireEvent.click(screen.getByRole("button", { name: "清空负面" }));
  await waitFor(() => expect(state().draft.负面提示词).toBe(""));
});
it("lotus direction is deliberate, cancelable and never adds a person", () => {
  mount();
  fireEvent.click(screen.getByRole("button", { name: /荷间泛舟/ }));
  expect(screen.getByLabelText("核心场景")).toHaveValue("田野中的荷塘");
  expect(state().draft.scene.direction).toContain("小舟");
  expect(state().draft.元素).toBe("");
  fireEvent.click(screen.getByRole("button", { name: /荷间泛舟/ }));
  expect(state().draft.scene.direction).toBe("");
});
it("selects a real concept, preserves it on refresh, then expands and saves bilingual output", async () => {
  let ui = mount();
  await start();
  fireEvent.click(
    await screen.findByRole("button", { name: "选择构思：模拟构思2" }),
  );
  await waitFor(() =>
    expect(state().draft.scene.selected).toEqual(concepts[1]),
  );
  ui.unmount();
  ui = mount();
  expect(screen.getByText("模拟关系2")).toBeVisible();
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "展开双语提示词" }),
    ).toBeEnabled(),
  );
  fireEvent.click(screen.getByRole("button", { name: "展开双语提示词" }));
  await waitFor(() => expect(state().history).toHaveLength(1));
  expect(screen.getByText("Mock complete English")).toBeInTheDocument();
  expect(state().history[0].brief.scene.selected).toEqual(concepts[1]);
  expect(JSON.stringify(state())).not.toContain("mock-key");
});
it("changing input clears both choices and persisted selection", async () => {
  mount();
  await start();
  fireEvent.click(
    await screen.findByRole("button", { name: "选择构思：模拟构思1" }),
  );
  fireEvent.change(screen.getByLabelText("核心场景"), {
    target: { value: "沙漠" },
  });
  expect(
    screen.queryByRole("button", { name: "选择构思：模拟构思1" }),
  ).toBeNull();
  expect(state().draft.scene.selected).toBeNull();
  expect(screen.getByRole("button", { name: "展开双语提示词" })).toBeDisabled();
});
it("late concepts cannot restore a choice after input changes even if the input changes back", async () => {
  let resolve;
  handler = () =>
    new Promise((r) => {
      resolve = r;
    });
  mount();
  await start();
  await waitFor(() => expect(resolve).toBeDefined());
  fireEvent.change(screen.getByLabelText("想法"), {
    target: { value: "另一片湖" },
  });
  fireEvent.change(screen.getByLabelText("想法"), {
    target: { value: "静静的无人水面" },
  });
  await act(async () => resolve({ status: "concepts", concepts }));
  expect(
    screen.queryByRole("button", { name: "选择构思：模拟构思1" }),
  ).toBeNull();
  expect(state().draft.scene.selected).toBeNull();
  expect(screen.getByRole("button", { name: "构思 3 个场景" })).toBeEnabled();
});
it("malformed concepts fail visibly, preserve input and allow a clean retry", async () => {
  handler = async () => ({
    status: "concepts",
    concepts: concepts.slice(0, 2),
  });
  mount();
  await start();
  expect(await screen.findByText("构思失败，输入已保留")).toBeVisible();
  expect(state().history).toEqual([]);
  expect(screen.getByLabelText("想法")).toHaveValue("静静的无人水面");
  handler = async () => ({ status: "concepts", concepts });
  fireEvent.click(screen.getByRole("button", { name: "构思 3 个场景" }));
  expect(
    await screen.findByRole("button", { name: "选择构思：模拟构思1" }),
  ).toBeVisible();
});
it("clarification never masquerades as concept cards or successful history", async () => {
  handler = async () => ({
    status: "clarification",
    questions: ["模拟澄清：是否需要人物？"],
  });
  mount();
  await start();
  expect(await screen.findByText("模拟澄清：是否需要人物？")).toBeVisible();
  expect(state().history).toEqual([]);
  expect(
    screen.queryByRole("button", { name: "选择构思：模拟构思1" }),
  ).toBeNull();
});
it("late final results cannot add history or replace the result for changed input", async () => {
  mount();
  await start();
  fireEvent.click(
    await screen.findByRole("button", { name: "选择构思：模拟构思1" }),
  );
  let resolve;
  handler = () =>
    new Promise((r) => {
      resolve = r;
    });
  const submitted = structuredClone(state().draft);
  fireEvent.click(screen.getByRole("button", { name: "展开双语提示词" }));
  await waitFor(() => expect(resolve).toBeDefined());
  fireEvent.change(screen.getByLabelText("想法"), {
    target: { value: "下一个念头" },
  });
  await act(async () =>
    resolve({
      status: "ready",
      brief: submitted,
      spec: { version: "v14" },
      schemes: [
        {
          name: "过时结果",
          zh: "过时中文",
          en: "Stale English",
          design: actualDesign(),
        },
      ],
    }),
  );
  expect(state().history).toEqual([]);
  expect(screen.queryByText("Stale English")).toBeNull();
});
it("custom core drops exact lotus presets but keeps user written backdrop", () => {
  mount();
  fireEvent.click(screen.getByRole("button", { name: /荷间泛舟/ }));
  fireEvent.change(screen.getByLabelText("核心场景"), {
    target: { value: "深海场景" },
  });
  expect(state().draft.scene).toMatchObject({
    core: "深海场景",
    direction: "",
    backdrop: "",
  });
  fireEvent.click(screen.getByRole("button", { name: /荷间泛舟/ }));
  fireEvent.click(screen.getByRole("button", { name: "精修条件" }));
  fireEvent.change(screen.getByLabelText("背景陪衬"), {
    target: { value: "用户定义背景" },
  });
  fireEvent.change(screen.getByLabelText("核心场景"), {
    target: { value: "新核心" },
  });
  expect(state().draft.scene.backdrop).toBe("用户定义背景");
});
it("changing output count preserves the selected concept and candidates", async () => {
  mount();
  await start();
  fireEvent.click(
    await screen.findByRole("button", { name: "选择构思：模拟构思1" }),
  );
  fireEvent.mouseDown(screen.getByLabelText("展开数量"));
  fireEvent.click(await screen.findByText("10 对双语"));
  expect(state().draft.数量).toBe("10条");
  expect(state().draft.scene.selected).toEqual(concepts[0]);
  expect(
    screen.getByRole("button", { name: "选择构思：模拟构思2" }),
  ).toBeVisible();
  expect(screen.getByRole("button", { name: "展开双语提示词" })).toBeEnabled();
});

it("invalid final output reports failure and never writes successful history", async () => {
  mount();
  await start();
  fireEvent.click(
    await screen.findByRole("button", { name: "选择构思：模拟构思1" }),
  );
  handler = async (path, body) => ({
    status: "ready",
    brief: body.brief,
    spec: { version: "v14" },
    schemes: [{ name: "缺少英文", zh: "只有中文", design: actualDesign() }],
  });
  fireEvent.click(screen.getByRole("button", { name: "展开双语提示词" }));
  expect(await screen.findByText("生成失败，输入已保留")).toBeInTheDocument();
  expect(state().history).toEqual([]);
  expect(state().draft.scene.selected).toEqual(concepts[0]);
});

it("output count changed while final request is pending invalidates that response but keeps concept", async () => {
  mount();
  await start();
  fireEvent.click(
    await screen.findByRole("button", { name: "选择构思：模拟构思1" }),
  );
  let resolve;
  handler = () =>
    new Promise((r) => {
      resolve = r;
    });
  const submitted = structuredClone(state().draft);
  fireEvent.click(screen.getByRole("button", { name: "展开双语提示词" }));
  await waitFor(() => expect(resolve).toBeDefined());
  fireEvent.mouseDown(screen.getByLabelText("展开数量"));
  fireEvent.click(await screen.findByText("10 对双语"));
  await act(async () =>
    resolve({
      status: "ready",
      brief: submitted,
      spec: { version: "v14" },
      schemes: [
        {
          name: "旧数量结果",
          zh: "旧中文",
          en: "Old English",
          design: actualDesign(),
        },
      ],
    }),
  );
  expect(state().history).toEqual([]);
  expect(state().draft.scene.selected).toEqual(concepts[0]);
  expect(state().draft.数量).toBe("10条");
  expect(screen.queryByText("Old English")).toBeNull();
});

it("delayed concepts are discarded when only delivery count changes", async () => {
  let resolve;
  handler = () =>
    new Promise((r) => {
      resolve = r;
    });
  mount();
  await start();
  await waitFor(() => expect(resolve).toBeDefined());
  fireEvent.mouseDown(screen.getByLabelText("展开数量"));
  fireEvent.click(await screen.findByText("10 对双语"));
  await act(async () => resolve({ status: "concepts", concepts }));
  expect(
    screen.queryByRole("button", { name: "选择构思：模拟构思1" }),
  ).toBeNull();
  expect(state().draft.数量).toBe("10条");
});

it("history with missing selected concept protects the original storage while new input remains editable", async () => {
  const workspace = emptyWorkspace();
  workspace.draft.大致说明 = "原始草稿";
  const damaged = JSON.stringify({
    format: "scene-forge-backup-v5",
    draft: workspace.draft,
    presets: [],
    history: [
      {
        status: "ready",
        brief: workspace.draft,
        spec: { version: "v14", sha256: "mock" },
        provider: "openai",
        model: "mock-model",
        schemes: [
          {
            name: "缺失构思的历史",
            zh: "完整中文",
            en: "Complete English",
            design: actualDesign(),
          },
        ],
      },
    ],
  });
  localStorage.setItem(STORAGE, damaged);
  mount();
  expect(screen.getByText(/本地创作记录无法读取/)).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("想法"), {
    target: { value: "当前可编辑的新想法" },
  });
  expect(screen.getByLabelText("想法")).toHaveValue("当前可编辑的新想法");
  expect(localStorage.getItem(STORAGE)).toBe(damaged);
  expect(
    screen.getByRole("button", { name: "下载原记录" }),
  ).toBeInTheDocument();
});
