import {
  emptySettings,
  type Settings,
  type Scene,
  type PromptVersion,
} from "./contracts";
export type Session = {
  id: string;
  settings: Settings;
  revision: number;
  scenes: Scene[];
  scenesRevision: number;
  selectedId: string | null;
  mode: "camera" | "story" | null;
  versions: PromptVersion[];
  outputRevision: number;
  previousScenes: string[];
  ruleHash: string;
  ruleVersion: string;
  model: string;
  createdAt: string;
  answers: { question: string; answer: string }[];
};
export function freshSession(): Session {
  return {
    id: crypto.randomUUID(),
    settings: emptySettings(),
    revision: 0,
    scenes: [],
    scenesRevision: -1,
    selectedId: null,
    mode: null,
    versions: [],
    outputRevision: -1,
    previousScenes: [],
    ruleHash: "",
    ruleVersion: "",
    model: "",
    createdAt: new Date().toISOString(),
    answers: [],
  };
}
export function editSettings(s: Session, settings: Settings): Session {
  return {
    ...s,
    settings,
    revision: s.revision + 1,
    selectedId: null,
    mode: null,
    answers: [],
  };
}
export function acceptScenes(
  s: Session,
  scenes: Scene[],
  revision: number,
  ruleHash: string,
): Session {
  if (s.revision !== revision) return s;
  return {
    ...s,
    scenes,
    scenesRevision: revision,
    selectedId: null,
    mode: null,
    outputRevision: -1,
    ruleHash,
    previousScenes: [
      ...s.previousScenes,
      ...s.scenes.map((x) => `${x.title}: ${x.event}`.slice(0, 500)),
    ].slice(-100),
  };
}
export function selectScene(s: Session, id: string): Session {
  if (s.scenesRevision !== s.revision || !s.scenes.some((x) => x.id === id))
    throw new Error("请先根据当前设置生成场景");
  return { ...s, selectedId: id, mode: null, outputRevision: -1 };
}
export function acceptPrompts(
  s: Session,
  versions: PromptVersion[],
  revision: number,
  ruleHash: string,
  model: string,
): Session {
  if (s.revision !== revision) return s;
  return {
    ...s,
    versions,
    outputRevision: revision,
    ruleHash,
    model,
    createdAt: new Date().toISOString(),
  };
}
export function exportText(s: Session, markdown = true) {
  const lines = [
    markdown ? "# 画外 · 提示词创作" : "画外 · 提示词创作",
    `Skill ${s.ruleVersion} · ${s.model} · ${new Date(s.createdAt).toLocaleString("zh-CN")}`,
  ];
  s.versions.forEach((v, i) => {
    lines.push(
      "",
      `${markdown ? "## " : ""}${i + 1}. ${v.title}`,
      "",
      "中文",
      markdown ? `\`\`\`text\n${v.zh}\n\`\`\`` : v.zh,
      "",
      "English",
      markdown ? `\`\`\`text\n${v.en}\n\`\`\`` : v.en,
    );
  });
  return lines.join("\n");
}
