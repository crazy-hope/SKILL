import { createGenerationTask } from "../public/state.js";
export const DETAIL_FIELDS = {
  action: "人物 / 主体动作",
  camera: "运镜方向与速度",
  ending: "收尾状态",
  environment: "环境与持续动态",
  mood: "画风与氛围",
  gesture: "手部与道具",
  sound: "声音要求",
  preserve: "必须保留",
  avoid: "需要避免",
};
export function makeTask(id, notify, source) {
  return {
    id,
    title: `镜头 ${id}`,
    image: source?.image || "",
    imageName: source?.imageName || "",
    imageLoading: false,
    imageSequence: 0,
    input: source
      ? structuredClone(source.input)
      : {
          idea: "",
          videoModel: "seedance-2.5",
          platform: "尚未确定",
          level: "auto",
          duration: 5,
          aspectRatio: "original",
          details: Object.fromEntries(
            Object.keys(DETAIL_FIELDS).map((k) => [k, ""]),
          ),
        },
    generation: createGenerationTask(notify),
  };
}
export function canGenerate(task, config) {
  return Boolean(
    config?.ready &&
    task.image &&
    !task.imageLoading &&
    !task.generation.busy &&
    Number.isFinite(task.input.duration) &&
    task.input.duration > 0,
  );
}
export function batchCandidates(tasks, config) {
  return tasks.filter(
    (t) =>
      canGenerate(t, config) &&
      !t.generation.error &&
      (!t.generation.record || t.generation.stale),
  );
}
export async function api(path, { body, signal } = {}) {
  const response = await fetch(`/api/${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: body === undefined ? {} : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
  });
  const data = await response.json();
  if (!response.ok)
    throw new Error(data.error?.message || "请求失败，请重试。");
  return data;
}
