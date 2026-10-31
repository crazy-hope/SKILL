import React from "react";
import {ConfigProvider} from "antd";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import App from "../App.jsx";
import {
  freshBrief,
  markdown,
  STORAGE,
  KEY_STORAGE,
  CONNECTION_STORAGE,
} from "../../model.mjs";
const config = { token: "local", spec: { version: "v16", sha256: "abc" } };
const reply = (body) => ({ ok: true, json: async () => body });
const deferred = () => {
  let resolve;
  const promise = new Promise((r) => (resolve = r));
  return { promise, resolve };
};
function ready(brief) {
  return {
    status: "ready",
    brief,
    schemes: [
      {
        title: "模拟结果",
        zh: "完整中文花瓣雨水",
        en: "Complete English rain scene",
      },
    ],
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
  };
}
beforeEach(() => {
  localStorage.clear();
  localStorage.setItem(KEY_STORAGE, JSON.stringify({ openai: "test-secret" }));
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
  // jsdom does not emit CSS animation completion; browser tests cover real motion/focus.
  render(<ConfigProvider theme={{token:{motion:false}}}><App /></ConfigProvider>);
  await waitFor(() => expect(screen.getByText("规范 V16")).toBeTruthy());
}
it("shows exact editable paragraphs and an empty subject; no former workflow", async () => {
  await mount();
  for (const [k, label] of Object.entries({
    style: "画风题材",
    color: "色彩",
    camera: "镜头机位",
    mood: "情绪",
    moment: "瞬间状态",
  }))
    expect(screen.getByLabelText(label).value).toBe(freshBrief()[k]);
  expect(screen.getByRole("textbox", { name: "描绘内容", exact: true }).value).toBe("");
  expect(screen.queryByText("精修条件")).toBeNull();
  expect(screen.queryByText("选择构思")).toBeNull();
});
it("manual subject generates directly in one call and persists bilingual history without keys", async () => {
  await mount();
  fireEvent.change(screen.getByRole("textbox", { name: "描绘内容", exact: true }), {
    target: { value: "三名女子避雨" },
  });
  global.fetch.mockImplementation(async (url, opt) =>
    reply(ready(JSON.parse(opt.body).brief)),
  );
  fireEvent.click(screen.getByRole("button", { name: "生成完整提示词" }));
  await screen.findByText("完整中文花瓣雨水");
  expect(fetch).toHaveBeenCalledTimes(2);
  const saved = localStorage.getItem(STORAGE);
  expect(saved).toContain("Complete English");
  expect(saved).not.toContain("test-secret");
});
it("AI fills only subject, supports undo, and respects cleared settings", async () => {
  await mount();
  fireEvent.change(screen.getByLabelText("色彩"), { target: { value: "" } });
  global.fetch.mockResolvedValue(
    reply({ status: "subject", subject: "乳白花瓣下的三名女子。" }),
  );
  fireEvent.click(screen.getByRole("button", { name: "AI描述主体" }));
  await waitFor(() =>
    expect(screen.getByRole("textbox", { name: "描绘内容", exact: true }).value).toBe(
      "乳白花瓣下的三名女子。",
    ),
  );
  expect(screen.getByLabelText("色彩").value).toBe("");
  fireEvent.click(screen.getByRole("button", { name: "撤销AI描述" }));
  expect(screen.getByRole("textbox", { name: "描绘内容", exact: true }).value).toBe("");
});
it("editing and reverting a condition still discards late AI response", async () => {
  await mount();
  const d = deferred();
  global.fetch.mockReturnValue(d.promise);
  fireEvent.click(screen.getByRole("button", { name: "AI描述主体" }));
  const input = screen.getByLabelText("情绪");
  fireEvent.change(input, { target: { value: "changed" } });
  fireEvent.change(input, { target: { value: freshBrief().mood } });
  d.resolve(reply({ status: "subject", subject: "过期内容" }));
  await screen.findByText(/条件已变更，本次返回已忽略/);
  expect(screen.getByRole("textbox", { name: "描绘内容", exact: true }).value).toBe("");
});
it("count edits invalidate final response before history write", async () => {
  await mount();
  fireEvent.change(screen.getByRole("textbox", { name: "描绘内容", exact: true }), {
    target: { value: "主体" },
  });
  const d = deferred();
  global.fetch.mockImplementation((url, opt) => {
    d.brief = JSON.parse(opt.body).brief;
    return d.promise;
  });
  fireEvent.click(screen.getByRole("button", { name: "生成完整提示词" }));
  fireEvent.mouseDown(screen.getByRole("combobox", { name: "方案数量" }));
  fireEvent.click(await screen.findByRole("option", { name: "2 对双语" }));
  d.resolve(reply(ready(d.brief)));
  await screen.findByText(/条件已变更，本次返回已忽略/);
  expect(JSON.parse(localStorage.getItem(STORAGE)).history).toHaveLength(0);
});
it("corrupt storage is preserved while fields remain editable", async () => {
  localStorage.setItem(STORAGE, "broken");
  await mount();
  fireEvent.change(screen.getByRole("textbox", { name: "描绘内容", exact: true }), {
    target: { value: "新内容" },
  });
  expect(localStorage.getItem(STORAGE)).toBe("broken");
  expect(screen.getByText(/暂停自动保存/)).toBeTruthy();
});
it("manual edits after AI remove undo instead of overwriting new writing", async () => {
  await mount();
  global.fetch.mockResolvedValue(
    reply({ status: "subject", subject: "AI填入" }),
  );
  fireEvent.click(screen.getByRole("button", { name: "AI描述主体" }));
  await screen.findByRole("button", { name: "撤销AI描述" });
  fireEvent.change(screen.getByRole("textbox", { name: "描绘内容", exact: true }), {
    target: { value: "我改写的主体" },
  });
  expect(screen.queryByRole("button", { name: "撤销AI描述" })).toBeNull();
  expect(screen.getByRole("textbox", { name: "描绘内容", exact: true }).value).toBe("我改写的主体");
});
it("connection edits invalidate pending generation even when model ID is reverted", async () => {
  await mount();
  fireEvent.change(screen.getByRole("textbox", { name: "描绘内容", exact: true }), {
    target: { value: "主体" },
  });
  const d = deferred();
  global.fetch.mockImplementation((url, opt) => {
    d.brief = JSON.parse(opt.body).brief;
    return d.promise;
  });
  fireEvent.click(screen.getByRole("button", { name: "生成完整提示词" }));
  fireEvent.click(screen.getByRole("button", { name: "接口设置" }));
  fireEvent.change(screen.getByLabelText("文本模型 ID"), {
    target: { value: "other" },
  });
  fireEvent.change(screen.getByLabelText("文本模型 ID"), {
    target: { value: "mock" },
  });
  fireEvent.click(screen.getByRole("button", { name: "关闭窗口" }));
  d.resolve(reply(ready(d.brief)));
  await screen.findByText(/条件已变更，本次返回已忽略/);
  expect(JSON.parse(localStorage.getItem(STORAGE)).history).toHaveLength(0);
});

it("restoring a backup invalidates AI started during the pending file read", async () => {
  await mount();
  fireEvent.change(screen.getByRole("textbox", { name: "描绘内容", exact: true }), {
    target: { value: "恢复前主体" },
  });
  fireEvent.click(screen.getByRole("button", { name: /记录与备份/ }));
  const read = deferred(),
    ai = deferred();
  fireEvent.change(screen.getByLabelText("恢复v6备份"), {
    target: { files: [{ size: 100, text: () => read.promise }] },
  });
  fireEvent.click(screen.getByRole("button", { name: "关闭窗口" }));
  global.fetch.mockReturnValue(ai.promise);
  fireEvent.click(screen.getByRole("button", { name: "AI描述主体" }));
  read.resolve(
    JSON.stringify({
      format: "scene-forge-backup-v6",
      draft: { ...freshBrief(), subject: "恢复后的主体", color: "备份配色" },
      history: [],
    }),
  );
  await waitFor(() =>
    expect(screen.getByRole("textbox", { name: "描绘内容", exact: true }).value).toBe("恢复后的主体"),
  );
  ai.resolve(reply({ status: "subject", subject: "来自旧条件的AI描述" }));
  await waitFor(() => expect(screen.queryByText("正在描述主体…")).toBeNull());
  expect(screen.getByRole("textbox", { name: "描绘内容", exact: true }).value).toBe("恢复后的主体");
  expect(screen.getByLabelText("色彩").value).toBe("备份配色");
});

it("model input guidance is shown outside the copyable bilingual content", async () => {
  await mount();
  fireEvent.change(screen.getByRole("textbox", { name: "描绘内容", exact: true }), {
    target: { value: "主体" },
  });
  global.fetch.mockImplementation(async (url, opt) => {
    const out = ready(JSON.parse(opt.body).brief);
    out.schemes[0].usage = "请将正负提示词分别粘贴。";
    return reply(out);
  });
  fireEvent.click(screen.getByRole("button", { name: "生成完整提示词" }));
  await screen.findByText("请将正负提示词分别粘贴。");
  expect(screen.getByText("完整中文花瓣雨水").textContent).not.toContain(
    "粘贴",
  );
  expect(localStorage.getItem(STORAGE)).toContain("请将正负提示词分别粘贴。");
});
it("selecting ten pairs in the popup persists the actual numeric count", async () => {
  await mount();
  fireEvent.mouseDown(screen.getByRole("combobox", { name: "方案数量" }));
  fireEvent.click(await screen.findByRole("option", { name: "10 对双语" }));
  expect(JSON.parse(localStorage.getItem(STORAGE)).draft.count).toBe(10);
});

it("custom target and clear survive field edits without restoring Midjourney", async () => {
  await mount();
  const target = screen.getByLabelText("目标图像模型");
  fireEvent.change(target, { target: { value: "Custom Art Model" } });
  expect(JSON.parse(localStorage.getItem(STORAGE)).draft.target).toBe(
    "Custom Art Model",
  );
  fireEvent.change(target, { target: { value: "" } });
  expect(JSON.parse(localStorage.getItem(STORAGE)).draft.target).toBe("");
});
it("provider selection preserves independent keys and models through save and reopen", async () => {
  await mount();
  fireEvent.click(screen.getByRole("button", { name: "接口设置" }));
  fireEvent.mouseDown(screen.getByRole("combobox", { name: "文本服务" }));
  fireEvent.click(await screen.findByRole("option", { name: "DeepSeek" }));
  fireEvent.change(screen.getByLabelText("文本模型 ID"), {
    target: { value: "deepseek-test" },
  });
  fireEvent.change(screen.getByLabelText("API Key"), {
    target: { value: "deepseek-test-key" },
  });
  fireEvent.click(screen.getByRole("button", { name: "保存设置" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  fireEvent.click(screen.getByRole("button", { name: "接口设置" }));
  expect(screen.getByLabelText("文本模型 ID").value).toBe("deepseek-test");
  fireEvent.mouseDown(screen.getByRole("combobox", { name: "文本服务" }));
  fireEvent.click(await screen.findByRole("option", { name: "OpenAI" }));
  expect(screen.getByLabelText("文本模型 ID").value).toBe("mock");
  expect(screen.getByLabelText("API Key").value).toBe("test-secret");
  expect(JSON.parse(localStorage.getItem(KEY_STORAGE)).deepseek).toBe(
    "deepseek-test-key",
  );
  expect(localStorage.getItem(STORAGE)).not.toContain("deepseek-test-key");
});
it("library modal closes on Escape without changing the subject", async () => {
  await mount();
  fireEvent.change(screen.getByRole("textbox", { name: "描绘内容", exact: true }), {
    target: { value: "我写的主体" },
  });
  fireEvent.click(screen.getByRole("button", { name: "接口设置" }));
  fireEvent.keyDown(screen.getByRole("dialog"), {
    key: "Escape",
    code: "Escape",
    keyCode: 27,
  });
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(screen.getByRole("textbox", { name: "描绘内容", exact: true }).value).toBe("我写的主体");
});

it("clearing content persists only the empty subject and rejects a pending AI refill", async () => {
  await mount();
  expect(screen.getByRole("heading", { name: "描绘内容", exact: true })).toBeTruthy();
  fireEvent.change(screen.getByRole("textbox", { name: "描绘内容", exact: true }), { target: { value: "当前内容" } });
  const before = JSON.parse(localStorage.getItem(STORAGE)).draft;
  const d = deferred();
  global.fetch.mockReturnValue(d.promise);
  fireEvent.click(screen.getByRole("button", { name: "AI描述主体" }));
  fireEvent.click(screen.getByRole("button", { name: "清空", exact: true }));
  expect(JSON.parse(localStorage.getItem(STORAGE)).draft).toEqual({...before, subject: ""});
  d.resolve(reply({ status: "subject", subject: "过期内容" }));
  await screen.findByText(/条件已变更，本次返回已忽略/);
  expect(screen.getByRole("textbox", { name: "描绘内容", exact: true }).value).toBe("");
  expect(screen.getByRole("button", { name: "生成完整提示词" })).toBeDisabled();
  expect(screen.queryByRole("button", { name: "撤销AI描述" })).toBeNull();
});

it("switching a saved tone preserves other inputs and invalidates pending AI", async () => {
  await mount();
  fireEvent.change(screen.getByRole('textbox',{name:'描绘内容',exact:true}),{target:{value:'保留我的内容'}});
  fireEvent.change(screen.getByLabelText('色彩'),{target:{value:'自定义色彩'}});
  const before=JSON.parse(localStorage.getItem(STORAGE)).draft;
  const d=deferred();global.fetch.mockReturnValue(d.promise);
  fireEvent.click(screen.getByRole('button',{name:'AI描述主体'}));
  fireEvent.mouseDown(screen.getByRole('combobox',{name:'选择画面基调'}));
  fireEvent.click(await screen.findByRole('option',{name:'巨构荷塘-写实柔和',exact:true}));
  const saved=JSON.parse(localStorage.getItem(STORAGE)).draft;
  for(const key of ['subject','negative','target','count'])expect(saved[key]).toEqual(before[key]);
  expect(saved.color).toBe(freshBrief().color);
  expect(saved.style).toContain('--profile ny6wlzu --chaos 15 --ar 16:9 --raw --hd');
  d.resolve(reply({status:'subject',subject:'过期AI'}));
  await screen.findByText(/条件已变更，本次返回已忽略/);
  expect(screen.getByRole('textbox',{name:'描绘内容',exact:true}).value).toBe('保留我的内容');
});

it("new MJ results save identical tone suffixes in both languages and downloads", async () => {
  await mount();
  fireEvent.change(screen.getByRole('textbox',{name:'描绘内容',exact:true}),{target:{value:'我的内容'}});
  fireEvent.mouseDown(screen.getByRole('combobox',{name:'选择画面基调'}));
  fireEvent.click(await screen.findByRole('option',{name:'巨构荷塘-写实柔和',exact:true}));
  global.fetch.mockImplementation(async (url,opt)=>reply(ready(JSON.parse(opt.body).brief)));
  fireEvent.click(screen.getByRole('button',{name:'生成完整提示词'}));
  await screen.findByRole('button',{name:'复制英文'});
  const result=JSON.parse(localStorage.getItem(STORAGE)).history[0];
  for(const k of ['zh','en']) {
    expect(result.schemes[0][k]).toMatch(/--profile ny6wlzu --chaos 15 --ar 16:9 --raw --hd$/);
    expect(markdown(result)).toContain(result.schemes[0][k]);
  }
});
