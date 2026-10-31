import React from "react";
import { it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { App as AntApp } from "antd";
import Workbench from "../App.jsx";
import { STORAGE } from "../workspace.mjs";

afterEach(() => { cleanup(); localStorage.clear(); vi.unstubAllGlobals(); });

it("persists the selected DeepSeek connection across reload while invalid creative records remain protected", async () => {
  localStorage.setItem(STORAGE, "broken-creative-records");
  const requests = [];
  vi.stubGlobal("fetch", vi.fn(async (url, options) => {
    if (url === "/api/config") return { ok: true, json: async () => ({ token: "mock-local", spec: { version: "v11" }, providers: { openai: "https://api.openai.com/v1", deepseek: "https://api.deepseek.com" } }) };
    requests.push({url, body: JSON.parse(options.body)});
    return { ok: true, json: async () => ({ models: ["mock-deepseek-model"] }) };
  }));
  const mount = () => render(<AntApp><Workbench /></AntApp>);
  mount();
  fireEvent.click(screen.getByRole("button", {name: "配置模型接口"}));
  fireEvent.click(screen.getByRole("radio", {name: "DeepSeek"}));
  fireEvent.change(screen.getByLabelText("API Key", {exact: true}), {target: {value: "mock-deepseek-key"}});
  fireEvent.change(screen.getByLabelText("文本模型 ID", {exact: true}), {target: {value: "mock-deepseek-model"}});
  await waitFor(() => expect(screen.getByRole("button", {name: "测试连接 / 获取模型"})).toBeEnabled());
  fireEvent.click(screen.getByRole("button", {name: "测试连接 / 获取模型"}));
  await screen.findByText(/连接成功/);
  expect(requests).toEqual([{url: "/api/models", body: {provider: "deepseek", key: "mock-deepseek-key"}}]);
  fireEvent.click(screen.getByRole("button", {name: "保存配置"}));
  await screen.findByRole("button", {name: "DeepSeek 已配置"});
  expect(localStorage.getItem(STORAGE)).toBe("broken-creative-records");
  cleanup();
  mount();
  expect(screen.getByRole("button", {name: "DeepSeek 已配置"})).toBeVisible();
  fireEvent.click(screen.getByRole("button", {name: "DeepSeek 已配置"}));
  expect(screen.getByRole("radio", {name: "DeepSeek"})).toBeChecked();
  expect(screen.getByLabelText("文本模型 ID", {exact: true})).toHaveValue("mock-deepseek-model");
  fireEvent.click(screen.getByRole("radio", {name: "OpenAI"}));
  expect(screen.getByLabelText("API Key", {exact: true})).toHaveValue("");
  expect(screen.getByLabelText("文本模型 ID", {exact: true})).toHaveValue("");
  expect(localStorage.getItem(STORAGE)).toBe("broken-creative-records");
});
