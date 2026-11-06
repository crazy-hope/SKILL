// @vitest-environment jsdom
import { draftVersion as version } from "./prompt-fixture";
import React, { useState } from "react";
import "fake-indexeddb/auto";
import { openDB } from "idb";
import { afterEach, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  emptySettings,
  settingsSchema,
  missingSettings,
  finalizeVersions,
  parseModelOutput,
} from "../shared/contracts";
import { SettingsPanel } from "../src/components/SettingsPanel";
import { loadDraft, loadHistory } from "../src/storage";
import { freshSession } from "../shared/session";
afterEach(cleanup);
const settings = {
  ...emptySettings(),
  media: ["电影画面"],
  visualStyles: ["柔和光学"],
  colorTone: "自然中性",
  genres: ["生活"],
  culture: "东方",
  realism: "现实世界",
  mood: ["温暖治愈"],
  aspectRatio: "16:9",
  mjVersion: "inherit",
  personalize: "off" as const,
};
it("requires an explicit mood choice when restoring older drafts and history", async () => {
  const legacy = JSON.parse(
    JSON.stringify({
      ...freshSession(),
      settings,
      versions: [{ title: "旧成品", zh: "旧中文", en: "Old output" }],
    }),
  );
  delete legacy.settings.mood;
  expect(settingsSchema.parse(legacy.settings).mood).toEqual([]);
  expect(missingSettings(settingsSchema.parse(legacy.settings))).toEqual([
    "mood",
  ]);
  const db = await openDB("prompt-director-v1", 1, {
    upgrade(db) {
      db.createObjectStore("draft");
      db.createObjectStore("history", { keyPath: "id" });
    },
  });
  await db.put("draft", legacy, "current");
  await db.put("history", legacy);
  expect((await loadDraft())?.versions).toEqual(legacy.versions);
  expect(
    (await loadHistory()).find((x) => x.id === legacy.id)?.settings.mood,
  ).toEqual([]);
  db.close();
});
it("offers mood chips, explanations, custom combinations and removal without preselection", async () => {
  function Harness() {
    const [s, set] = useState(emptySettings());
    return (
      <SettingsPanel
        settings={s}
        onChange={set}
        onAdvice={() => {}}
        errors={[]}
        disabled={false}
      />
    );
  }
  render(<Harness />);
  const user = userEvent.setup();
  const group = within(screen.getByRole("group", { name: "情绪／氛围" }));
  const warm = group.getByRole("button", { name: "温暖治愈" });
  expect(warm.getAttribute("aria-pressed")).toBe("false");
  await user.hover(warm);
  expect((await screen.findByRole("tooltip")).textContent).toContain(
    "提示词表达示例",
  );
  await user.click(warm);
  await user.click(group.getByRole("button", { name: "亲密默契" }));
  await user.click(group.getByRole("button", { name: "生活化自然" }));
  expect(group.getByRole("button", { name: "移除亲密默契" })).toBeTruthy();
  expect(group.getByRole("button", { name: "移除生活化自然" })).toBeTruthy();
  await user.type(
    group.getByLabelText("搜索情绪／氛围"),
    "孤独但有希望{Enter}",
  );
  expect(group.getByRole("button", { name: "移除孤独但有希望" })).toBeTruthy();
  await user.click(group.getByRole("button", { name: "移除温暖治愈" }));
  expect(
    group
      .getByRole("button", { name: "温暖治愈" })
      .getAttribute("aria-pressed"),
  ).toBe("false");
});
it("assembles all three bilingual versions in the required prose order before parameters and exclusions", () => {
  const versions = [1, 2, 3].map((i) => ({
    ...version,
    zh: { ...version.zh, camera: `拍法${i}。` },
    en: { ...version.en, camera: `Camera setup ${i}.` },
  }));
  const result = finalizeVersions(versions, settings, [
    { zh: "路人", en: "passersby" },
  ]);
  const opening = {
    zh: "市井生活题材取自江南书铺的日常，以电影画面结合油画笔触呈现，窗光在细密的笔触间柔和过渡，自然中性色调保留木纹与纸页的本色。",
    en: "A slice of daily life in a Jiangnan bookshop, rendered in a blend of cinema and oil painting, with window light softening across fine brushstrokes, and a neutral palette that preserves the colors of wood and paper.",
  };
  for (const [index, item] of result.entries())
    for (const lang of ["zh", "en"] as const) {
      const body = versions[index][lang];
      expect(item[lang]).toBe(
        [
          opening[lang],
          body.subject,
          body.emotion,
          body.camera,
          "--ar 16:9",
          `--no ${lang === "zh" ? "路人" : "passersby"}`,
        ].join("\n\n"),
      );
    }
});
it("rejects missing sections, flat legacy model responses, and injected parameters", () => {
  const raw = {
    kind: "prompts",
    versions: [version, version, version],
    negativeTerms: [],
  };
  expect(parseModelOutput(JSON.stringify(raw), "prompts").kind).toBe("prompts");
  for (const lang of ["zh", "en"] as const) {
    for (const section of Object.keys(version[lang])) {
      const incomplete = {
        ...version,
        [lang]: { ...version[lang], [section]: "  " },
      };
      expect(() =>
        parseModelOutput(
          JSON.stringify({
            ...raw,
            versions: [version, incomplete, version],
          }),
          "prompts",
        ),
      ).toThrow(/缺项/);
    }
  }
  expect(() =>
    parseModelOutput(
      JSON.stringify({
        ...raw,
        versions: raw.versions.map((v) => ({ ...v, zh: "旧格式" })),
      }),
      "prompts",
    ),
  ).toThrow();
  expect(() =>
    finalizeVersions(
      [
        version,
        version,
        { ...version, en: { ...version.en, subject: "Subject --v 1" } },
      ],
      settings,
      [],
    ),
  ).toThrow();
  expect(() =>
    finalizeVersions([version, version, version], settings, [
      { zh: "路人", en: "passersby --v 1" },
    ]),
  ).toThrow();
  expect(
    finalizeVersions([version, version, version], settings, [])[0].zh,
  ).not.toContain("--no");
});
