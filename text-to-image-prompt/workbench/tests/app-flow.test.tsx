// @vitest-environment jsdom
import "fake-indexeddb/auto";
import React from "react";
import { it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../src/App";
import { saveDraft } from "../src/storage";
import { freshSession } from "../shared/session";
const scenes = Array.from({ length: 5 }, (_, i) => ({
  id: `scene-${i}`,
  title: `测试场景${i + 1}`,
  location: "书店",
  event: "两人搬书",
  interaction: "托住木箱",
  highlight: "窗光",
  style: "柔和光学",
  reality: "现实世界",
  culture: "东方",
}));
const draft = () => ({
  ...freshSession(),
  settings: {
    media: ["电影画面", "油画"],
    visualStyles: ["柔和光学"],
    colorTone: "自然中性：保留物体本色，冷暖平衡",
    genres: ["生活"],
    culture: "东方",
    realism: "现实世界",
    mood: ["温暖治愈"],
    aspectRatio: "16:9",
    mjVersion: "inherit",
    personalize: "off" as const,
    profileCode: "",
    elements: "两个人",
    exclusions: "不要路人",
  },
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it("runs the real React scene-selection-to-bilingual-output flow with simulated HTTP responses", async () => {
  await saveDraft(draft());
  const requests: Record<string, unknown>[] = [];
  vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
    if (url.endsWith("/rules"))
      return Response.json({
        version: "v6",
        hash: "current",
        synced: true,
        changedFiles: [],
      });
    if (url.endsWith("/config"))
      return Response.json({
        hasKey: true,
        model: "fixture",
        baseUrl: "https://api.deepseek.com",
      });
    const input = JSON.parse(init?.body as string);
    requests.push(input);
    return Response.json({
      revision: input.revision,
      ruleHash: "current",
      ruleVersion: "v6",
      model: "fixture",
      output:
        input.stage === "scenes"
          ? { kind: "scenes", scenes }
          : {
              kind: "prompts",
              versions: [1, 2, 3].map((i) => ({
                title: `拍法${i}`,
                zh: `两人在书店搬箱，版本${i} --ar 16:9`,
                en: `Two people carry a box, version ${i} --ar 16:9`,
              })),
            },
    });
  });
  render(<App />);
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "生成五个场景" }));
  await screen.findByText("测试场景1");
  const progress = screen.getByRole("progressbar", { name: "创作设置完成度" });
  expect(progress.getAttribute("aria-valuemax")).toBe("10");
  expect(progress.getAttribute("aria-valuenow")).toBe("10");
  expect(screen.queryByRole("button", { name: "生成完整提示词" })).toBeNull();
  await user.click(screen.getByRole("button", { name: /测试场景4/ }));
  await user.click(screen.getByRole("button", { name: /同一瞬间，不同拍法/ }));
  await user.click(screen.getByRole("button", { name: "生成完整提示词" }));
  await screen.findByText("拍法1");
  expect(requests[1].scene).toMatchObject({ id: "scene-3" });
  expect(requests[1].mode).toBe("camera");
  expect((requests[1].settings as { media: string[] }).media).toEqual([
    "电影画面",
    "油画",
  ]);
  await user.click(screen.getByRole("tab", { name: "版本 03" }));
  expect(screen.getByText("拍法3")).toBeTruthy();
  expect(screen.getByText(/Two people carry a box, version 3/)).toBeTruthy();
});
it("ignores a late response after cancelling and preserves the form", async () => {
  await saveDraft(draft());
  let finish: (value: Response) => void = () => {};
  vi.stubGlobal("fetch", async (url: string) => {
    if (url.endsWith("/rules"))
      return Response.json({
        version: "v6",
        hash: "current",
        synced: true,
        changedFiles: [],
      });
    if (url.endsWith("/config"))
      return Response.json({
        hasKey: true,
        model: "fixture",
        baseUrl: "https://api.deepseek.com",
      });
    return new Promise<Response>((resolve) => {
      finish = resolve;
    });
  });
  render(<App />);
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "生成五个场景" }));
  await user.click(await screen.findByRole("button", { name: /^取消$/ }));
  finish(
    Response.json({
      revision: 0,
      ruleHash: "current",
      ruleVersion: "v6",
      model: "fixture",
      output: { kind: "scenes", scenes },
    }),
  );
  await waitFor(() => expect(screen.queryByText("测试场景1")).toBeNull());
  expect(
    (screen.getByLabelText("你的创作起点 选填") as HTMLTextAreaElement).value,
  ).toBe("两个人");
});
it("preserves new feedback typed while a replacement batch is pending", async () => {
  await saveDraft({
    ...draft(),
    scenes,
    scenesRevision: 0,
    ruleHash: "current",
  });
  let finish: (value: Response) => void = () => {};
  vi.stubGlobal("fetch", async (url: string) => {
    if (url.endsWith("/rules"))
      return Response.json({
        version: "v6",
        hash: "current",
        synced: true,
        changedFiles: [],
      });
    if (url.endsWith("/config"))
      return Response.json({
        hasKey: true,
        model: "fixture",
        baseUrl: "https://api.deepseek.com",
      });
    return new Promise<Response>((resolve) => {
      finish = resolve;
    });
  });
  render(<App />);
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "换一批" }));
  await user.type(
    screen.getByLabelText("再靠近你的想法一点"),
    "增加窗边的书架",
  );
  finish(
    Response.json({
      revision: 0,
      ruleHash: "current",
      ruleVersion: "v6",
      model: "fixture",
      output: { kind: "scenes", scenes },
    }),
  );
  await waitFor(() =>
    expect(screen.queryByRole("button", { name: /^取消$/ })).toBeNull(),
  );
  expect(
    (screen.getByLabelText("再靠近你的想法一点") as HTMLInputElement).value,
  ).toBe("增加窗边的书架");
});
it("does not send previous scene and camera mode into a replacement batch", async () => {
  await saveDraft({
    ...draft(),
    scenes,
    scenesRevision: 0,
    ruleHash: "current",
    selectedId: "scene-2",
    mode: "camera",
  });
  let input: Record<string, unknown> = {};
  vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
    if (url.endsWith("/rules"))
      return Response.json({
        version: "v6",
        hash: "current",
        synced: true,
        changedFiles: [],
      });
    if (url.endsWith("/config"))
      return Response.json({
        hasKey: true,
        model: "fixture",
        baseUrl: "https://api.deepseek.com",
      });
    input = JSON.parse(init?.body as string);
    return Response.json({
      revision: 0,
      ruleHash: "current",
      ruleVersion: "v6",
      model: "fixture",
      output: { kind: "scenes", scenes },
    });
  });
  render(<App />);
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "换一批" }));
  await waitFor(() => expect(input.stage).toBe("scenes"));
  expect(input.scene).toBeNull();
  expect(input.mode).toBeNull();
});
it("requires editing actual settings for parameter conflicts instead of accepting a textual override", async () => {
  await saveDraft(draft());
  vi.stubGlobal("fetch", async (url: string) => {
    if (url.endsWith("/rules"))
      return Response.json({
        version: "v6",
        hash: "current",
        synced: true,
        changedFiles: [],
      });
    if (url.endsWith("/config"))
      return Response.json({
        hasKey: true,
        model: "fixture",
        baseUrl: "https://api.deepseek.com",
      });
    return Response.json({
      revision: 0,
      ruleHash: "current",
      ruleVersion: "v6",
      model: "fixture",
      output: {
        kind: "clarification",
        question: "版本与个人化不兼容，请取舍",
        options: ["取消个人化"],
        settingField: "personalize",
      },
    });
  });
  render(<App />);
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "生成五个场景" }));
  await screen.findByText("版本与个人化不兼容，请取舍");
  expect(screen.queryByRole("button", { name: /^取消个人化$/ })).toBeNull();
  expect(screen.getByRole("button", { name: "修改对应设置" })).toBeTruthy();
});
