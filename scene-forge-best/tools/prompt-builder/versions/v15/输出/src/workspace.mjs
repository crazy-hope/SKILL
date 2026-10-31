import { emptyBrief, validateBrief } from "../brief.mjs";
import { readBackup } from "../core.mjs";
export const STORAGE = "scene-forge-workspace-v15";
export const CONNECTION_STORAGE = "scene-forge-connection-v1";
function connectionConfig(saved) {
  return {
    provider: saved.provider === "deepseek" ? "deepseek" : "openai",
    profiles: Object.fromEntries(["openai", "deepseek"].map((p) => [p, {
      model: typeof saved.profiles?.[p]?.model === "string"
        ? saved.profiles[p].model.slice(0, 200) : "",
    }])),
  };
}
export function saveConnection(storage, data) {
  storage.setItem(CONNECTION_STORAGE, JSON.stringify(connectionConfig(data)));
}
export const emptyWorkspace = () => ({
  draft: emptyBrief(),
  presets: [],
  history: [],
  provider: "openai",
  profiles: { openai: { model: "" }, deepseek: { model: "" } },
});
export function backupPayload(data) {
  const clean = readBackup(
    JSON.stringify({
      format: "scene-forge-backup-v4",
      draft: validateBrief(data.draft),
      presets: data.presets,
      history: data.history,
    }),
  );
  return { format: "scene-forge-backup-v4", ...clean };
}
export function loadWorkspace(storage) {
  let data = emptyWorkspace(), error = "", connectionError = "";
  try {
    const raw = storage.getItem(STORAGE);
    if (raw) {
      const saved = JSON.parse(raw);
      // Current-format connection settings are independent of result validity.
      if (saved?.format === "scene-forge-backup-v4")
        Object.assign(data, connectionConfig(saved));
      const clean = readBackup(raw);
      data = { ...data, ...clean, history: clean.history.slice(0, 30) };
    }
  } catch {
    error = "本地创作记录无法读取，原记录已保留。请先导出原记录，再恢复有效备份或明确重置。";
  }
  try {
    const raw = storage.getItem(CONNECTION_STORAGE);
    if (raw) {
      const saved = JSON.parse(raw);
      if (!saved || !["openai", "deepseek"].includes(saved.provider))
        throw Error("Invalid connection");
      Object.assign(data, connectionConfig(saved));
    }
  } catch {
    connectionError = "独立接口配置无法读取，请打开配置重新选择服务商和模型并保存。";
  }
  return { data, error, connectionError };
}
export function saveWorkspace(storage, data) {
  const profiles = Object.fromEntries(
    ["openai", "deepseek"].map((p) => [
      p,
      { model: String(data.profiles?.[p]?.model || "").slice(0, 200) },
    ]),
  );
  storage.setItem(
    STORAGE,
    JSON.stringify({
      ...backupPayload(data),
      provider: data.provider === "deepseek" ? "deepseek" : "openai",
      profiles,
    }),
  );
}
