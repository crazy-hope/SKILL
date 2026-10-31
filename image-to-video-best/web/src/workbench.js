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
export async function api(path, { body, signal, method } = {}) {
  const response = await fetch(`/api/${path}`, {
    method: method || (body === undefined ? "GET" : "POST"),
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
  });
  const data = await response.json();
  if (!response.ok)
    throw new Error(data.error?.message || "请求失败，请重试。");
  return data;
}

export async function generateRequest(payload, signal) {
  // Receive the job ID even if the user cancels during upload, then cancel that job.
  const { id } = await api("generate-jobs", {
    body: payload,
    signal: AbortSignal.timeout(30000),
  });
  const path = `generate-jobs/${id}`;
  try {
    while (true) {
      signal.throwIfAborted();
      const job = await api(path, { method: "POST", body: {}, signal });
      if (job.status === "completed") return job.data;
      if (job.status === "failed") throw Error(job.error.message);
      await new Promise((resolve, reject) => {
        const cancel = () => { clearTimeout(timer); reject(signal.reason); };
        const timer = setTimeout(() => {
          signal.removeEventListener("abort", cancel);
          resolve();
        }, 400);
        signal.addEventListener("abort", cancel, { once: true });
        if (signal.aborted) cancel();
      });
    }
  } finally {
    // Best effort cleanup; a missing client is also handled by the server lease.
    await api(path, { method: "DELETE", signal: AbortSignal.timeout(5000) }).catch(() => {});
  }
}
