// @vitest-environment jsdom
import React, { useState } from "react";
import "fake-indexeddb/auto";
import { openDB } from "idb";
import { it, expect, afterEach } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  emptySettings,
  missingSettings,
  settingsSchema,
  settingKeys,
} from "../shared/contracts";
import { freshSession } from "../shared/session";
import { SettingsPanel } from "../src/components/SettingsPanel";
import { loadDraft, loadHistory } from "../src/storage";
import { buildMessages } from "../server/prompts";
afterEach(cleanup);
it("requires a separate color choice after visual style, including for old settings", () => {
  const old = { ...emptySettings() } as Record<string, unknown>;
  delete old.colorTone;
  const restored = settingsSchema.parse(old);
  expect(restored.colorTone).toBe("");
  expect(missingSettings(restored)).toContain("colorTone");
  expect(settingKeys.slice(0, 4)).toEqual([
    "media",
    "visualStyles",
    "colorTone",
    "genres",
  ]);
});
it("offers palette choice and accepts a custom overall color direction", async () => {
  function Harness() {
    const [settings, set] = useState(emptySettings());
    return (
      <SettingsPanel
        settings={settings}
        onChange={set}
        onAdvice={() => {}}
        errors={[]}
        disabled={false}
      />
    );
  }
  render(<Harness />);
  const user = userEvent.setup();
  const field = within(screen.getByRole("group", { name: "整体色彩／色调" }));
  expect(field.queryByRole("combobox")).toBeNull();
  const cool = "清冷青绿：玉绿、冷青、乳白，少量淡粉";
  const dark = "深沉暗调：深色为主，少量亮色点缀";
  expect(
    field.getByRole("button", { name: cool }).getAttribute("aria-pressed"),
  ).toBe("false");
  await user.click(field.getByRole("button", { name: cool }));
  await user.click(field.getByRole("button", { name: dark }));
  expect(field.getByRole("button", { name: `移除${cool}` })).toBeTruthy();
  expect(field.getByRole("button", { name: `移除${dark}` })).toBeTruthy();
  await user.type(
    field.getByLabelText("搜索整体色彩／色调"),
    "米白与赭石为主，暖调低饱和{Enter}",
  );
  expect(
    field.getByRole("button", { name: "移除米白与赭石为主，暖调低饱和" }),
  ).toBeTruthy();
  expect(field.getByRole("button", { name: `移除${cool}` })).toBeTruthy();
  await user.click(field.getByRole("button", { name: `移除${cool}` }));
  expect(field.queryByRole("button", { name: `移除${cool}` })).toBeNull();
  expect(field.getByRole("button", { name: `移除${dark}` })).toBeTruthy();
});
it("reads legacy draft and history without erasing outputs or inventing a palette", async () => {
  const s = freshSession();
  s.versions = [{ title: "旧成品", zh: "旧中文", en: "Old output" }];
  const legacy = JSON.parse(JSON.stringify(s));
  delete legacy.settings.colorTone;
  const db = await openDB("prompt-director-v1", 1, {
    upgrade(db) {
      db.createObjectStore("draft");
      db.createObjectStore("history", { keyPath: "id" });
    },
  });
  await db.put("draft", legacy, "current");
  await db.put("history", legacy);
  const draft = await loadDraft();
  expect(draft?.versions).toEqual(s.versions);
  expect(draft?.settings.colorTone).toBe("");
  expect(missingSettings(draft!.settings)).toContain("colorTone");
  expect((await loadHistory()).find((x) => x.id === s.id)?.versions).toEqual(
    s.versions,
  );
  db.close();
});
it("passes the selected color direction to the generation engine", () => {
  const settings = { ...emptySettings(), colorTone: "黑白灰阶" };
  const messages = buildMessages(
    {
      stage: "prompts",
      settings,
      revision: 0,
      ruleHash: "fixture",
      scene: null,
      mode: "camera",
      previousScenes: [],
      amendment: "",
      answers: [],
    },
    {},
  );
  expect(JSON.parse(messages[1].content).settings.colorTone).toBe("黑白灰阶");
  expect(messages[0].content).toContain("整体色调概括");
});
