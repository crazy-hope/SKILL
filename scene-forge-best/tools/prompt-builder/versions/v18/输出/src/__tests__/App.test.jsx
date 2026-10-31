import React from "react";
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
  render(<App />);
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
  expect(screen.getByLabelText("主体内容").value).toBe("");
  expect(screen.queryByText("精修条件")).toBeNull();
  expect(screen.queryByText("选择构思")).toBeNull();
});
it("manual subject generates directly in one call and persists bilingual history without keys", async () => {
  await mount();
  fireEvent.change(screen.getByLabelText("主体内容"), {
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
    expect(screen.getByLabelText("主体内容").value).toBe(
      "乳白花瓣下的三名女子。",
    ),
  );
  expect(screen.getByLabelText("色彩").value).toBe("");
  fireEvent.click(screen.getByRole("button", { name: "撤销AI描述" }));
  expect(screen.getByLabelText("主体内容").value).toBe("");
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
  expect(screen.getByLabelText("主体内容").value).toBe("");
});
it("count edits invalidate final response before history write", async () => {
  await mount();
  fireEvent.change(screen.getByLabelText("主体内容"), {
    target: { value: "主体" },
  });
  const d = deferred();
  global.fetch.mockImplementation((url, opt) => {
    d.brief = JSON.parse(opt.body).brief;
    return d.promise;
  });
  fireEvent.click(screen.getByRole("button", { name: "生成完整提示词" }));
  fireEvent.change(screen.getByLabelText("方案数量"), {
    target: { value: "2" },
  });
  d.resolve(reply(ready(d.brief)));
  await screen.findByText(/条件已变更，本次返回已忽略/);
  expect(JSON.parse(localStorage.getItem(STORAGE)).history).toHaveLength(0);
});
it("corrupt storage is preserved while fields remain editable", async () => {
  localStorage.setItem(STORAGE, "broken");
  await mount();
  fireEvent.change(screen.getByLabelText("主体内容"), {
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
  fireEvent.change(screen.getByLabelText("主体内容"), {
    target: { value: "我改写的主体" },
  });
  expect(screen.queryByRole("button", { name: "撤销AI描述" })).toBeNull();
  expect(screen.getByLabelText("主体内容").value).toBe("我改写的主体");
});
it("connection edits invalidate pending generation even when model ID is reverted", async () => {
  await mount();
  fireEvent.change(screen.getByLabelText("主体内容"), {
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
  fireEvent.change(screen.getByLabelText("主体内容"), {
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
    expect(screen.getByLabelText("主体内容").value).toBe("恢复后的主体"),
  );
  ai.resolve(reply({ status: "subject", subject: "来自旧条件的AI描述" }));
  await waitFor(() => expect(screen.queryByText("正在描述主体…")).toBeNull());
  expect(screen.getByLabelText("主体内容").value).toBe("恢复后的主体");
  expect(screen.getByLabelText("色彩").value).toBe("备份配色");
});

it("model input guidance is shown outside the copyable bilingual content", async () => {
  await mount();
  fireEvent.change(screen.getByLabelText("主体内容"), {
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
