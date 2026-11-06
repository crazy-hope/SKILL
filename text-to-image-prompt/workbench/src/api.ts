export async function api<T>(url: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api/${url}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...init?.headers },
    });
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
    throw new Error("无法连接本地工作台，请检查服务是否运行");
  }
  const data = await response
    .json()
    .catch(() => ({ error: "本地服务返回格式异常，请重试" }));
  if (!response.ok) throw new Error(data.error ?? "请求失败，请重试");
  return data as T;
}
