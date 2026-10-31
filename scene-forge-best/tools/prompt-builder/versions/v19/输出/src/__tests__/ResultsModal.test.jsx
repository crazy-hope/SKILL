import React from "react";
import { ConfigProvider } from "antd";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
  cleanup,
} from "@testing-library/react";
import { beforeEach, afterEach, it, expect, vi } from "vitest";
import App from "../App.jsx";
import {
  freshBrief,
  STORAGE,
  KEY_STORAGE,
  CONNECTION_STORAGE,
  backup,
} from "../../model.mjs";
const config = {
  token: "local",
  spec: { version: "v16", sha256: "a".repeat(64) },
};
const reply = (body) => ({ ok: true, json: async () => body });
const deferred = () => {
  let resolve;
  const promise = new Promise((r) => (resolve = r));
  return { promise, resolve };
};
const ready = (brief, title = "新方案") => ({
  status: "ready",
  brief,
  schemes: Array.from({ length: brief.count }, (_, i) => ({
    title: `${title}${i + 1}`,
    zh: `${title}中文${i + 1}`,
    en: `${title} English ${i + 1}`,
  })),
  spec: config.spec,
  target: {
    id: "midjourney",
    label: "MJ",
    requested: "Midjourney",
    scope: "测试",
    checkedAt: "2026-10-30",
    sources: [],
  },
  provider: "openai",
  model: "mock",
});
beforeEach(() => {
  localStorage.clear();
  localStorage.setItem(KEY_STORAGE, JSON.stringify({ openai: "fake-key" }));
  localStorage.setItem(
    CONNECTION_STORAGE,
    JSON.stringify({
      provider: "openai",
      profiles: { openai: { model: "mock" }, deepseek: { model: "" } },
    }),
  );
  global.fetch = vi.fn(async () => reply(config));
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
async function mount() {
  render(
    <ConfigProvider theme={{ token: { motion: false } }}>
      <App />
    </ConfigProvider>,
  );
  await screen.findByText("规范 V16");
  fireEvent.change(screen.getByRole("textbox", { name: "描绘内容", exact: true }), {
    target: { value: "主体" },
  });
}
async function close() {
  fireEvent.click(
    within(screen.getByRole("dialog")).getByRole("button", {
      name: "关闭窗口",
    }),
  );
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
}
function pending() {
  const d = deferred();
  global.fetch.mockImplementation((url, opt) => {
    d.brief = JSON.parse(opt.body).brief;
    return d.promise;
  });
  fireEvent.click(screen.getByRole("button", { name: "生成完整提示词" }));
  return d;
}
it("opens loading immediately, can reopen without resending, and shows final text only in dialog", async () => {
  await mount();
  const d = pending();
  expect(
    within(screen.getByRole("dialog", { name: /^完整提示词/ })).getByText(
      "正在生成完整提示词…",
    ),
  ).toBeTruthy();
  await close();
  fireEvent.click(screen.getByRole("button", { name: "查看生成进度" }));
  expect(fetch).toHaveBeenCalledTimes(2);
  d.resolve(reply(ready(d.brief)));
  await within(screen.getByRole("dialog")).findByText("新方案中文1");
  await close();
  expect(screen.queryByText("新方案中文1")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "查看提示词" }));
  expect(
    within(screen.getByRole("dialog")).getByText("新方案 English 1"),
  ).toBeTruthy();
});
it("failed new generation never shows old successful output as the current result", async () => {
  await mount();
  global.fetch.mockImplementation(async (url, opt) =>
    reply(ready(JSON.parse(opt.body).brief, "旧方案")),
  );
  fireEvent.click(screen.getByRole("button", { name: "生成完整提示词" }));
  await screen.findByText("旧方案中文1");
  await close();
  const d = pending();
  expect(screen.queryByText("旧方案中文1")).toBeNull();
  d.resolve({ ok: false, json: async () => ({ error: "模拟网络失败" }) });
  await within(screen.getByRole("dialog")).findByText("模拟网络失败");
  expect(JSON.parse(localStorage.getItem(STORAGE)).history).toHaveLength(1);
  expect(screen.queryByText("旧方案中文1")).toBeNull();
});
it("clarification stays in the generation dialog and preserves inputs without success history", async () => {
  await mount();
  global.fetch.mockResolvedValue(
    reply({ status: "clarification", questions: ["模拟冲突：请修改色彩。"] }),
  );
  fireEvent.click(screen.getByRole("button", { name: "生成完整提示词" }));
  await within(screen.getByRole("dialog")).findByText("模拟冲突：请修改色彩。");
  expect(JSON.parse(localStorage.getItem(STORAGE)).history).toHaveLength(0);
  await close();
  expect(screen.getByRole("textbox", { name: "描绘内容", exact: true }).value).toBe("主体");
});
it("switching schemes copies only the selected complete language", async () => {
  await mount();
  fireEvent.mouseDown(screen.getByRole("combobox", { name: "方案数量" }));
  fireEvent.click(await screen.findByRole("option", { name: "2 对双语" }));
  global.fetch.mockImplementation(async (url, opt) =>
    reply(ready(JSON.parse(opt.body).brief)),
  );
  const writeText = vi.fn().mockResolvedValue();
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText },
    configurable: true,
  });
  fireEvent.click(screen.getByRole("button", { name: "生成完整提示词" }));
  await screen.findByText("新方案中文1");
  fireEvent.click(screen.getByRole("tab", { name: /新方案2/ }));
  fireEvent.click(
    within(screen.getByRole("dialog")).getByRole("button", {
      name: "复制英文",
    }),
  );
  expect(writeText).toHaveBeenCalledWith("新方案 English 2");
  expect(screen.queryByText("新方案中文1")).toBeNull();
});
it("viewing historical output is not replaced by a pending newer result", async () => {
  const historic = ready({ ...freshBrief(), subject: "历史主体" }, "历史方案");
  localStorage.setItem(
    STORAGE,
    JSON.stringify(backup({ draft: historic.brief, history: [historic] })),
  );
  await mount();
  const d = pending();
  await close();
  fireEvent.click(screen.getByRole("button", { name: /记录与备份/ }));
  fireEvent.click(await screen.findByRole("button", { name: /^查\s*看$/ }));
  await within(
    await screen.findByRole("dialog", { name: /^完整提示词/ }),
  ).findByText("历史方案中文1");
  d.resolve(reply(ready(d.brief)));
  await waitFor(() =>
    expect(JSON.parse(localStorage.getItem(STORAGE)).history).toHaveLength(2),
  );
  expect(
    within(screen.getByRole("dialog")).getByText("历史方案中文1"),
  ).toBeTruthy();
  expect(screen.queryByText("新方案中文1")).toBeNull();
  await close();
  fireEvent.click(screen.getByRole("button", { name: "查看提示词" }));
  expect(
    within(screen.getByRole("dialog")).getByText("新方案中文1"),
  ).toBeTruthy();
});
it("new draft during a pending generation prevents old output from reopening or being saved", async () => {
  await mount();
  const d = pending();
  await close();
  fireEvent.click(screen.getByRole("button", { name: /记录与备份/ }));
  fireEvent.click(screen.getByRole("button", { name: "新建输入" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  d.resolve(reply(ready(d.brief)));
  await screen.findByText(/条件已变更/);
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(screen.queryByRole("button", { name: "查看提示词" })).toBeNull();
  expect(JSON.parse(localStorage.getItem(STORAGE)).history).toHaveLength(0);
  expect(screen.getByRole("textbox", { name: "描绘内容", exact: true }).value).toBe("");
});
