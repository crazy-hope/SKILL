import { z } from "zod";
import type { ProviderId } from "./providers";
const text = z.string().trim().min(1).max(16000);
export const settingsSchema = z.object({
  media: z.array(text).max(20),
  visualStyles: z.array(text).max(20),
  colorTone: z.string().max(2000).default(""),
  genres: z.array(text).max(20),
  culture: z.string().max(2000),
  realism: z.string().max(2000),
  mood: z.array(text).max(20).default([]),
  aspectRatio: z.string().max(50),
  mjVersion: z.string().max(50),
  personalize: z.enum(["", "default", "profile", "off", "inherit"]),
  profileCode: z.string().max(200),
  elements: z.string().max(12000),
  exclusions: z.string().max(6000),
});
export type Settings = z.infer<typeof settingsSchema>;
export type SettingKey =
  | "media"
  | "visualStyles"
  | "colorTone"
  | "genres"
  | "culture"
  | "realism"
  | "mood"
  | "aspectRatio"
  | "mjVersion"
  | "personalize";
export const settingKeys: SettingKey[] = [
  "media",
  "visualStyles",
  "colorTone",
  "genres",
  "culture",
  "realism",
  "mood",
  "aspectRatio",
  "mjVersion",
  "personalize",
];
export function emptySettings(): Settings {
  return {
    media: [],
    visualStyles: [],
    colorTone: "",
    genres: [],
    culture: "",
    realism: "",
    mood: [],
    aspectRatio: "",
    mjVersion: "",
    personalize: "",
    profileCode: "",
    elements: "",
    exclusions: "",
  };
}
export function missingSettings(s: Settings): SettingKey[] {
  return settingKeys.filter((k) => {
    if (k === "aspectRatio") return !/^[1-9]\d{0,3}:[1-9]\d{0,3}$/.test(s[k]);
    if (k === "mjVersion")
      return s[k] !== "inherit" && !/^\d{1,2}(?:\.\d{1,2})?$/.test(s[k]);
    if (k === "personalize")
      return (
        !s[k] ||
        (s[k] === "profile" &&
          (!/^[a-zA-Z0-9_-]+(?:\s+[a-zA-Z0-9_-]+)*$/.test(
            s.profileCode.trim(),
          ) ||
            s.profileCode.includes("--")))
      );
    const value = s[k];
    return Array.isArray(value)
      ? !value.length
      : !value.replace(/^自定义：/, "").trim();
  });
}
export function parameters(s: Settings) {
  if (missingSettings(s).length) throw new Error("请完成十项设置及所需代码");
  return [
    `--ar ${s.aspectRatio}`,
    s.mjVersion === "inherit" ? "" : `--v ${s.mjVersion}`,
    s.personalize === "default"
      ? "--p"
      : s.personalize === "profile"
        ? `--p ${s.profileCode.trim()}`
        : "",
  ]
    .filter(Boolean)
    .join(" ");
}
export const sceneSchema = z.object({
  id: text,
  title: text,
  location: text,
  event: text,
  interaction: text,
  highlight: text,
  style: text,
  reality: text,
  culture: text,
});
export type Scene = z.infer<typeof sceneSchema>;
export const versionSchema = z.object({ title: text, zh: text, en: text });
export type PromptVersion = z.infer<typeof versionSchema>;
export const clarificationSchema = z.object({
  kind: z.literal("clarification"),
  question: text,
  options: z.array(text).max(5),
  settingField: z.enum(["mjVersion", "personalize"]).nullable().default(null),
});
export type Clarification = z.infer<typeof clarificationSchema>;
export const outputSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("scenes"),
    scenes: z.array(sceneSchema).length(5),
  }),
  z.object({
    kind: z.literal("prompts"),
    versions: z.array(versionSchema).length(3),
  }),
  z.object({ kind: z.literal("advice"), explanation: text, value: text }),
  clarificationSchema,
]);
export type ModelOutput = z.infer<typeof outputSchema>;
// Provider drafts are structured; saved/exported versions remain plain text.
const promptBodySchema = z.object({
  genre: text,
  medium: text,
  style: text,
  palette: text,
  subject: text,
  emotion: text,
  camera: text,
});
export const draftVersionSchema = z.object({
  title: text,
  zh: promptBodySchema,
  en: promptBodySchema,
});
const exclusionTerm = z
  .string()
  .trim()
  .min(1)
  .max(200)
  .regex(/^(?!.*--)[^\r\n,，]+$/);
const negativeTermsSchema = z
  .array(z.object({ zh: exclusionTerm, en: exclusionTerm }))
  .max(30);
const modelOutputSchema = z.discriminatedUnion("kind", [
  outputSchema.options[0],
  z.object({
    kind: z.literal("prompts"),
    versions: z.array(draftVersionSchema).length(3),
    negativeTerms: negativeTermsSchema,
  }),
  outputSchema.options[2],
  clarificationSchema,
]);
export function parseModelOutput(
  raw: string,
  stage: "scenes" | "prompts" | "advice",
) {
  if (!raw.trim()) throw new Error("模型返回空内容，请重试");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("模型返回的格式不完整，请重试");
  }
  const result = modelOutputSchema.safeParse(parsed);
  if (!result.success) throw new Error("模型返回内容缺项或数量不符，请重试");
  if (result.data.kind !== stage && result.data.kind !== "clarification")
    throw new Error("模型返回了错误阶段的内容，请重试");
  return result.data;
}
export function finalizeVersions(
  items: z.infer<typeof draftVersionSchema>[],
  s: Settings,
  negativeTerms: z.infer<typeof negativeTermsSchema>,
) {
  const suffix = parameters(s);
  const exclusions = negativeTermsSchema.parse(negativeTerms);
  return z
    .array(draftVersionSchema)
    .length(3)
    .parse(items)
    .map((item) => {
      if (
        Object.values(item.zh)
          .concat(Object.values(item.en))
          .some((part) => /--[a-zA-Z]/.test(part))
      )
        throw new Error("模型正文混入了未确认参数，请重试");
      const assemble = (language: "zh" | "en") => {
        const body = item[language];
        const opening = [body.genre, body.medium, body.style, body.palette]
          .map((clause, index) => {
            if (/[。！？.!?，,；;…]$/u.test(clause)) return clause;
            if (index === 3) return clause + (language === "zh" ? "。" : ".");
            return clause + (language === "zh" ? "，" : ",");
          })
          .join(language === "zh" ? "" : " ");
        return [
          opening,
          body.subject,
          body.emotion,
          body.camera,
          suffix,
          exclusions.length
            ? `--no ${exclusions.map((term) => term[language]).join(", ")}`
            : "",
        ]
          .filter(Boolean)
          .join("\n\n");
      };
      return {
        title: item.title,
        zh: assemble("zh"),
        en: assemble("en"),
      };
    });
}
export const generationSchema = z.object({
  stage: z.enum(["scenes", "prompts", "advice"]),
  settings: settingsSchema,
  revision: z.number().int().nonnegative(),
  ruleHash: text,
  scene: sceneSchema.nullable().optional(),
  mode: z.enum(["camera", "story"]).nullable().optional(),
  previousScenes: z.array(z.string().max(500)).max(100).default([]),
  amendment: z.string().max(6000).default(""),
  answers: z
    .array(z.object({ question: text, answer: text }))
    .max(20)
    .default([]),
  adviceField: z.enum(["aspectRatio", "mjVersion"]).optional(),
});
export type GenerationRequest = z.infer<typeof generationSchema>;
export type RuleStatus = {
  version: string;
  hash: string;
  synced: boolean;
  changedFiles: string[];
};
export type PublicConfig = {
  provider: ProviderId;
  baseUrl: string;
  model: string;
  hasKey: boolean;
};
export type GenerationResponse = {
  output: ModelOutput;
  revision: number;
  ruleHash: string;
  ruleVersion: string;
  model: string;
};
