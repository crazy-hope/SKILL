import React from "react";
import { it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { Button, ConfigProvider } from "antd";
import { studioTheme } from "../theme.js";
afterEach(cleanup);

it("keeps workbench theme rules when an extension mounts with the default CSS variable key", () => {
  render(
    <ConfigProvider theme={studioTheme}>
      <Button>工作台按钮</Button>
    </ConfigProvider>,
  );
  const button = screen.getByRole("button", { name: "工作台按钮" });
  const key = [...button.classList].find(
    (c) => c.startsWith("css-var-") || c === "scene-forge-v19",
  );
  const globalStyle = () =>
    [...document.querySelectorAll("style[data-token-hash]")].find(
      (s) =>
        s.getAttribute("data-token-hash") === key &&
        s.textContent.startsWith(`.${key}{`),
    )?.textContent;
  const before = globalStyle();
  expect(before).toMatch(/--(?:ant|scene-forge)-control-height:38px/);
  // Browser extensions use a separate React runtime and can restart useId at _r_0_.
  const extension = render(
    <ConfigProvider
      theme={{ cssVar: { key: "css-var-_r_0_", prefix: "qingai-extension" } }}
    >
      <Button>扩展按钮</Button>
    </ConfigProvider>,
  );
  expect(globalStyle()).toBe(before);
  extension.unmount();
  expect(globalStyle()).toBe(before);
});
