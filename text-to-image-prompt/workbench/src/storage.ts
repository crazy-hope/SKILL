import { openDB } from "idb";
import { z } from "zod";
import {
  settingsSchema,
  sceneSchema,
  versionSchema,
} from "../shared/contracts";
import type { Session } from "../shared/session";
const sessionSchema = z.object({
  id: z.string(),
  settings: settingsSchema,
  revision: z.number(),
  scenes: z.array(sceneSchema),
  scenesRevision: z.number(),
  selectedId: z.string().nullable(),
  mode: z.enum(["camera", "story"]).nullable(),
  versions: z.array(versionSchema),
  outputRevision: z.number(),
  previousScenes: z.array(z.string()),
  ruleHash: z.string(),
  ruleVersion: z.string(),
  model: z.string(),
  createdAt: z.string(),
  answers: z.array(z.object({ question: z.string(), answer: z.string() })),
});
const db = () =>
  openDB("prompt-director-v1", 1, {
    upgrade(db) {
      db.createObjectStore("draft");
      db.createObjectStore("history", { keyPath: "id" });
    },
  });
export async function saveDraft(session: Session) {
  await (await db()).put("draft", sessionSchema.parse(session), "current");
}
export async function loadDraft(): Promise<Session | null> {
  const value = await (await db()).get("draft", "current");
  if (!value) return null;
  return sessionSchema.parse(value);
}
export async function saveHistory(session: Session) {
  const database = await db();
  const tx = database.transaction("history", "readwrite");
  await tx.store.put(sessionSchema.parse(session));
  const records = await tx.store.getAll();
  records.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  for (const item of records.slice(50)) await tx.store.delete(item.id);
  await tx.done;
}
export async function loadHistory(): Promise<Session[]> {
  const values = await (await db()).getAll("history");
  return values
    .map((v) => sessionSchema.parse(v))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
export async function deleteHistory(id: string) {
  await (await db()).delete("history", id);
}
