// @vitest-environment jsdom
import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ModelDialog } from "../src/components/ModelDialog";
const deep = {
  provider: "deepseek" as const,
  baseUrl: "https://api.deepseek.com",
  model: "deep-fixture",
  hasKey: true,
};
const open = {
  provider: "openai" as const,
  baseUrl: "https://api.openai.com/v1",
  model: "",
  hasKey: false,
};
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it("switches service, clears unsubmitted keys and model lists, saves and tests only the selected provider", async () => {
  const requests: { url: string; method: string; body: any }[] = [];
  vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
    const body = init?.body ? JSON.parse(init.body as string) : null;
    requests.push({ url, method: init?.method ?? "GET", body });
    if (url === "/api/models")
      return Response.json({
        models: [{ id: "text-fixture", name: "text-fixture" }],
      });
    if (init?.method === "PUT")
      return Response.json({ ...open, model: body.model, hasKey: true });
    return Response.json(url.includes("openai") ? open : deep);
  });
  const onConfig = vi.fn();
  const { rerender } = render(
    <ModelDialog
      open
      onOpenChange={() => {}}
      config={deep}
      onConfig={onConfig}
    />,
  );
  const user = userEvent.setup();
  await waitFor(() =>
    expect((screen.getByLabelText("模型名称") as HTMLInputElement).value).toBe(
      "deep-fixture",
    ),
  );
  await user.type(screen.getByLabelText(/API Key/), "unsaved-deep-secret");
  await user.click(screen.getByRole("button", { name: /^OpenAI/ }));
  await waitFor(() =>
    expect((screen.getByLabelText("接口地址") as HTMLInputElement).value).toBe(
      open.baseUrl,
    ),
  );
  expect((screen.getByLabelText(/API Key/) as HTMLInputElement).value).toBe("");
  expect(
    screen.getByRole("link", { name: /前往 OpenAI/ }).getAttribute("href"),
  ).toBe("https://platform.openai.com/api-keys");
  await user.type(screen.getByLabelText(/API Key/), "open-test-key");
  await user.click(screen.getByRole("button", { name: "保存并测试" }));
  await screen.findByRole("combobox", { name: "可用模型" });
  expect(requests.find((r) => r.method === "PUT")?.body).toMatchObject({
    provider: "openai",
    apiKey: "open-test-key",
    baseUrl: open.baseUrl,
  });
  expect(requests.find((r) => r.url === "/api/models")?.body).toEqual({
    provider: "openai",
  });
  expect((screen.getByLabelText(/API Key/) as HTMLInputElement).value).toBe("");
  await user.click(screen.getByRole("button", { name: /^DeepSeek/ }));
  await waitFor(() =>
    expect((screen.getByLabelText("模型名称") as HTMLInputElement).value).toBe(
      "deep-fixture",
    ),
  );
  expect(screen.queryByRole("combobox", { name: "可用模型" })).toBeNull();
  expect(requests.filter((r) => r.method === "PUT")).toHaveLength(1);
  rerender(
    <ModelDialog
      open={false}
      onOpenChange={() => {}}
      config={deep}
      onConfig={onConfig}
    />,
  );
});
