import { mkdir, readFile, writeFile, rename, chmod } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { providerIds, providers, type ProviderId } from "../shared/providers";
const configSchema = z.object({
  baseUrl: z.string(),
  model: z.string().max(200),
  apiKey: z.string().max(2000),
});
export type Config = z.infer<typeof configSchema> & { provider: ProviderId };
export function normalizeBaseUrl(value: string) {
  let u: URL;
  try {
    u = new URL(value.trim());
  } catch {
    throw new Error("请输入完整的接口地址");
  }
  if (u.username || u.password || u.search || u.hash)
    throw new Error("接口地址不能包含认证信息或查询参数");
  if (
    u.protocol !== "https:" &&
    !(
      u.protocol === "http:" &&
      ["localhost", "127.0.0.1", "[::1]"].includes(u.hostname)
    )
  )
    throw new Error("非本机接口必须使用 HTTPS");
  return u.toString().replace(/\/$/, "");
}
const storeSchema = z.object({
  activeProvider: z.enum(providerIds),
  profiles: z.object({ deepseek: configSchema, openai: configSchema }),
});
type ConfigStore = z.infer<typeof storeSchema>;
const emptyStore = (): ConfigStore => ({
  activeProvider: "deepseek",
  profiles: {
    deepseek: { baseUrl: providers.deepseek.baseUrl, model: "", apiKey: "" },
    openai: { baseUrl: providers.openai.baseUrl, model: "", apiKey: "" },
  },
});
async function readStore(dir: string): Promise<ConfigStore> {
  try {
    const raw = JSON.parse(
      await readFile(path.join(dir, "config.json"), "utf8"),
    );
    if ("profiles" in raw) return storeSchema.parse(raw);
    const legacy = configSchema.parse(raw);
    const store = emptyStore();
    const provider =
      new URL(legacy.baseUrl).hostname === "api.openai.com"
        ? "openai"
        : "deepseek";
    store.activeProvider = provider;
    store.profiles[provider] = legacy;
    return store;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return emptyStore();
    throw new Error("本机模型配置无法读取，请检查配置文件");
  }
}
export async function loadConfig(
  dir: string,
  provider?: ProviderId,
): Promise<Config> {
  const store = await readStore(dir);
  const selected = provider ?? store.activeProvider;
  return { ...store.profiles[selected], provider: selected };
}
export function publicConfig(c: Config) {
  return {
    provider: c.provider,
    baseUrl: c.baseUrl,
    model: c.model,
    hasKey: !!c.apiKey,
  };
}
async function writeStore(dir: string, store: ConfigStore) {
  await mkdir(dir, { recursive: true, mode: 0o700 });
  await chmod(dir, 0o700);
  const tmp = path.join(dir, `config-${crypto.randomUUID()}.tmp`);
  await writeFile(tmp, JSON.stringify(store, null, 2), { mode: 0o600 });
  await rename(tmp, path.join(dir, "config.json"));
  await chmod(path.join(dir, "config.json"), 0o600);
}
// Serialize read/modify/write so simultaneous provider changes cannot drop another key.
const pending = new Map<string, Promise<unknown>>();
function updateStore<T>(
  dir: string,
  run: (store: ConfigStore) => Promise<T>,
): Promise<T> {
  const next = (pending.get(dir) ?? Promise.resolve())
    .catch(() => {})
    .then(async () => run(await readStore(dir)));
  pending.set(dir, next);
  void next
    .finally(() => {
      if (pending.get(dir) === next) pending.delete(dir);
    })
    .catch(() => {});
  return next;
}
export function saveConfig(dir: string, patch: Partial<Config>) {
  return updateStore(dir, async (store) => {
    const selected = patch.provider ?? store.activeProvider;
    const current = store.profiles[selected];
    const next = configSchema.parse({ ...current, ...patch });
    next.baseUrl = normalizeBaseUrl(next.baseUrl);
    if (
      next.baseUrl !== normalizeBaseUrl(current.baseUrl) &&
      patch.apiKey === undefined
    )
      next.apiKey = "";
    store.profiles[selected] = next;
    store.activeProvider = selected;
    await writeStore(dir, store);
    return publicConfig({ ...next, provider: selected });
  });
}
export function deleteConfigKey(dir: string, provider: ProviderId) {
  return updateStore(dir, async (store) => {
    store.profiles[provider].apiKey = "";
    await writeStore(dir, store);
    return publicConfig({ ...store.profiles[provider], provider });
  });
}
