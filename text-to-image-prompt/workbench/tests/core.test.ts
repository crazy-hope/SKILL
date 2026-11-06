import { draftVersion } from "./prompt-fixture";
import { describe, it, expect } from "vitest";
import {
  emptySettings,
  missingSettings,
  parameters,
  finalizeVersions,
  parseModelOutput,
} from "../shared/contracts";
import {
  freshSession,
  editSettings,
  acceptScenes,
  selectScene,
  acceptPrompts,
} from "../shared/session";
const complete = {
  ...emptySettings(),
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
  elements: "两个人，雨天",
};
const scenes = Array.from({ length: 5 }, (_, i) => ({
  id: `s${i}`,
  title: `场景${i}`,
  location: "书店",
  event: "搬书",
  interaction: "一起托住书箱",
  highlight: "雨与窗光",
  style: "柔和高光",
  reality: "现实世界",
  culture: "东方",
}));
describe("creation contracts", () => {
  it("requires explicit answers and real profile codes", () => {
    expect(missingSettings(emptySettings())).toHaveLength(10);
    expect(missingSettings(complete)).toEqual([]);
    expect(
      missingSettings({ ...complete, personalize: "profile", profileCode: "" }),
    ).toContain("personalize");
    expect(missingSettings({ ...complete, aspectRatio: "0:9" })).toContain(
      "aspectRatio",
    );
    expect(missingSettings({ ...complete, mjVersion: "help" })).toContain(
      "mjVersion",
    );
  });
  it("constructs identical confirmed parameters without invented off codes", () => {
    expect(parameters(complete)).toBe("--ar 16:9");
    expect(
      parameters({
        ...complete,
        mjVersion: "8.2",
        personalize: "profile",
        profileCode: "abc123",
      }),
    ).toBe("--ar 16:9 --v 8.2 --p abc123");
    expect(() =>
      parameters({
        ...complete,
        profileCode: "abc --v 1",
        personalize: "profile",
      }),
    ).toThrow();
  });
  it("rejects incomplete and blank model responses", () => {
    expect(() => parseModelOutput(" ", "scenes")).toThrow();
    expect(() =>
      parseModelOutput(
        JSON.stringify({ kind: "scenes", scenes: scenes.slice(0, 4) }),
        "scenes",
      ),
    ).toThrow();
    expect(
      parseModelOutput(
        JSON.stringify({
          kind: "clarification",
          question: "保留现实世界还是漂浮巨鲸？",
          options: ["现实", "幻想"],
        }),
        "scenes",
      ).kind,
    ).toBe("clarification");
  });
  it("appends canonical parameters to all six blocks and rejects injected parameters", () => {
    const items = [draftVersion, draftVersion, draftVersion];
    const out = finalizeVersions(items, complete, []);
    expect(
      out.every(
        (x) => x.zh.endsWith("--ar 16:9") && x.en.endsWith("--ar 16:9"),
      ),
    ).toBe(true);
    expect(() =>
      finalizeVersions(
        [
          { ...items[0], zh: { ...items[0].zh, subject: "人物 --v 1" } },
          ...items.slice(1),
        ],
        complete,
        [],
      ),
    ).toThrow();
  });
});
describe("stage and revision gates", () => {
  it("keeps all conditions on replacement while clearing selection and mode", () => {
    let s: ReturnType<typeof freshSession> = {
      ...freshSession(),
      settings: complete,
    };
    s = acceptScenes(s, scenes, 0, "hash");
    s = selectScene(s, "s3");
    s = { ...s, mode: "camera" };
    const next = acceptScenes(s, scenes, 0, "hash");
    expect(next.settings).toEqual(complete);
    expect(next.selectedId).toBeNull();
    expect(next.mode).toBeNull();
    expect(next.previousScenes).toHaveLength(5);
  });
  it("invalidates dependent choices and ignores stale responses", () => {
    let s = acceptScenes(
      { ...freshSession(), settings: complete },
      scenes,
      0,
      "hash",
    );
    s = selectScene(s, "s2");
    s = editSettings(s, { ...complete, culture: "西方" });
    expect(s.selectedId).toBeNull();
    expect(s.scenes).toHaveLength(5);
    expect(acceptScenes(s, scenes, 0, "hash")).toBe(s);
    expect(acceptPrompts(s, [], 0, "hash", "m")).toBe(s);
  });
  it("does not select a scene from an earlier rule snapshot", () => {
    const s = acceptScenes(
      { ...freshSession(), settings: complete },
      scenes,
      0,
      "old",
    );
    expect(() => selectScene({ ...s, scenesRevision: -1 }, "s1")).toThrow();
  });
});
it("does not accept a blank custom culture and ignores obsolete profile codes when off", () => {
  expect(missingSettings({ ...complete, culture: "自定义：" })).toContain(
    "culture",
  );
  expect(
    missingSettings({
      ...complete,
      profileCode: "old --invalid",
      personalize: "off",
    }),
  ).toEqual([]);
});
