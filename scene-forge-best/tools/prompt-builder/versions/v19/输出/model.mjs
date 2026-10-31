import defaults from "./defaults.json" with { type: "json" };
export const LABELS = {
  style: "画风题材",
  color: "色彩",
  camera: "镜头机位",
  mood: "情绪",
  moment: "瞬间状态",
};
export const STORAGE = "scene-forge-workspace-v18";
export const KEY_STORAGE = "scene-forge-api-keys-v1",
  CONNECTION_STORAGE = "scene-forge-connection-v1";
const fields = [...Object.keys(LABELS), "subject", "negative", "target"];
const isObject = (v) =>
  v !== null && typeof v === "object" && !Array.isArray(v);
const text = (v, max = 20000) => typeof v === "string" && v.length <= max;
const nonempty = (v, max = 20000) => text(v, max) && v.trim().length > 0;
const fail = (message) => {
  throw Error(message);
};
export const freshBrief = () => ({
  schemaVersion: 6,
  ...defaults,
  subject: "",
  target: "Midjourney",
  count: 1,
});
export const resetFive = (b) => ({
  ...b,
  ...Object.fromEntries(Object.keys(LABELS).map((k) => [k, defaults[k]])),
});
export function validateBrief(v) {
  if (
    !isObject(v) ||
    v.schemaVersion !== 6 ||
    Object.keys(v).sort().join() !==
      [...fields, "schemaVersion", "count"].sort().join() ||
    fields.some((k) => !text(v[k], k === "subject" ? 12000 : 6000)) ||
    !Number.isInteger(v.count) ||
    v.count < 1 ||
    v.count > 10
  )
    fail("六段输入格式错误；旧格式不会自动迁移。");
  return Object.fromEntries(
    ["schemaVersion", ...fields, "count"].map((k) => [k, v[k]]),
  );
}
export function validateResult(v) {
  if (!isObject(v) || v.status !== "ready") fail("结果格式错误");
  const brief = validateBrief(v.brief);
  if (
    !brief.subject.trim() ||
    !Array.isArray(v.schemes) ||
    v.schemes.length !== brief.count
  )
    fail("结果与主体或方案数量不符");
  const schemes = v.schemes.map((s) => {
    if (
      !isObject(s) ||
      !nonempty(s.title, 200) ||
      !nonempty(s.zh) ||
      !nonempty(s.en) ||
      !/[\u4e00-\u9fff]/.test(s.zh) ||
      !/[A-Za-z]/.test(s.en)
    )
      fail("结果缺少完整双语");
    if (s.usage !== undefined && !text(s.usage, 4000)) fail("使用说明格式错误");
    return {
      title: s.title,
      zh: s.zh,
      en: s.en,
      ...(s.usage !== undefined ? { usage: s.usage } : {}),
    };
  });
  if (
    !isObject(v.spec) ||
    !nonempty(v.spec.version, 50) ||
    !nonempty(v.spec.sha256, 100) ||
    !isObject(v.target)
  )
    fail("结果缺少规范与目标来源");
  const target = {};
  for (const k of ["id", "label", "requested", "scope", "checkedAt"]) {
    if (!text(v.target[k], 6000)) fail("目标来源错误");
    target[k] = v.target[k];
  }
  if (!Array.isArray(v.target.sources) || v.target.sources.length > 10)
    fail("来源列表错误");
  target.sources = v.target.sources.map((s) => {
    if (!isObject(s) || !text(s.title, 300) || !text(s.url, 2000))
      fail("来源错误");
    return { title: s.title, url: s.url };
  });
  if (!text(v.provider, 50) || !text(v.model, 200)) fail("文本模型来源错误");
  return {
    id: nonempty(v.id, 100) ? v.id : crypto.randomUUID(),
    createdAt: nonempty(v.createdAt, 100)
      ? v.createdAt
      : new Date().toISOString(),
    status: "ready",
    brief,
    schemes,
    spec: { version: v.spec.version, sha256: v.spec.sha256 },
    target,
    provider: v.provider,
    model: v.model,
  };
}
export function backup(data) {
  if (
    !isObject(data) ||
    !Array.isArray(data.history) ||
    data.history.length > 100
  )
    fail("记录格式错误");
  return {
    format: "scene-forge-backup-v6",
    draft: validateBrief(data.draft),
    history: data.history.map(validateResult),
  };
}
export function parseBackup(raw) {
  const v = JSON.parse(raw);
  if (!isObject(v) || v.format !== "scene-forge-backup-v6")
    fail("只支持新工作台v6备份。");
  const clean = backup(v);
  return { draft: clean.draft, history: clean.history };
}
export function loadWorkspace(storage) {
  let raw = null;
  try {
    raw = storage.getItem(STORAGE);
    return {
      data:
        raw === null ? { draft: freshBrief(), history: [] } : parseBackup(raw),
      error: "",
      raw,
    };
  } catch {
    return {
      data: { draft: freshBrief(), history: [] },
      error: "原记录无法读取，已暂停自动保存，请导出原始数据或恢复有效v6备份。",
      raw,
    };
  }
}
export function saveWorkspace(storage, data, { replace = false } = {}) {
  if (!replace) {
    const raw = storage.getItem(STORAGE);
    if (raw !== null) parseBackup(raw);
  }
  storage.setItem(STORAGE, JSON.stringify(backup(data)));
}
export function loadConnection(storage) {
  const config = JSON.parse(storage.getItem(CONNECTION_STORAGE) || "{}"),
    keys = JSON.parse(storage.getItem(KEY_STORAGE) || "{}");
  if (!isObject(config) || !isObject(keys))
    fail("接口配置无法读取，原值已保留。");
  return {
    provider: config.provider === "deepseek" ? "deepseek" : "openai",
    profiles: Object.fromEntries(
      ["openai", "deepseek"].map((p) => [
        p,
        {
          model:
            typeof config.profiles?.[p]?.model === "string"
              ? config.profiles[p].model
              : "",
        },
      ]),
    ),
    keys: Object.fromEntries(
      ["openai", "deepseek"].map((p) => [
        p,
        typeof keys[p] === "string" ? keys[p] : "",
      ]),
    ),
  };
}
export function saveConnection(storage, v) {
  const provider = v.provider === "deepseek" ? "deepseek" : "openai";
  const profiles = Object.fromEntries(
    ["openai", "deepseek"].map((p) => [
      p,
      { model: String(v.profiles[p].model).slice(0, 200) },
    ]),
  );
  const keys = Object.fromEntries(
    ["openai", "deepseek"].map((p) => [
      p,
      String(v.keys[p]).trim().slice(0, 1024),
    ]),
  );
  storage.setItem(KEY_STORAGE, JSON.stringify(keys));
  storage.setItem(CONNECTION_STORAGE, JSON.stringify({ provider, profiles }));
}
export function markdown(r) {
  const v = validateResult(r);
  return (
    `# 提示词\n\n规范：${v.spec.version} / ${v.spec.sha256}\n目标模型：${v.target.requested || "通用"}\n\n` +
    `文本服务：${v.provider} / ${v.model}\n方案数量：${v.brief.count}\n适配分支：${v.target.id}\n适用范围：${v.target.scope}\n来源查阅日期：${v.target.checkedAt}（本次未联网核实）\n` +
    v.target.sources
      .map((source) => `${source.title}：${source.url}`)
      .join("\n") +
    "\n\n" +
    Object.entries(LABELS)
      .map(([k, l]) => `${l}：${v.brief[k]}`)
      .join("\n\n") +
    `\n\n主体内容：${v.brief.subject}\n\n负面提示词：${v.brief.negative}\n\n` +
    v.schemes
      .map(
        (s, i) =>
          `## ${i + 1}. ${s.title}\n\n### 中文\n\n${s.zh}\n\n### English\n\n${s.en}${s.usage ? "\n\n使用说明：" + s.usage : ""}`,
      )
      .join("\n\n") +
    "\n\n文本与实际出图效果仍需核验。"
  );
}
