// Credentials live outside creative data and are never exported.
export const KEY_STORAGE = "scene-forge-api-keys-v1";
const clean = (value) =>
  Object.fromEntries(
    ["openai", "deepseek"].map((p) => [
      p,
      typeof value?.[p] === "string" ? value[p].trim().slice(0, 1024) : "",
    ]),
  );
export function loadKeys(storage) {
  const raw = storage.getItem(KEY_STORAGE);
  return clean(raw ? JSON.parse(raw) : {});
}
export function saveKeys(storage, keys) {
  storage.setItem(KEY_STORAGE, JSON.stringify(clean(keys)));
}
export function clearKeys(storage) {
  storage.removeItem(KEY_STORAGE);
}
