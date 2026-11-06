import "fake-indexeddb/auto";
import { it, expect } from "vitest";
import {
  saveDraft,
  loadDraft,
  saveHistory,
  loadHistory,
  deleteHistory,
} from "../src/storage";
import { freshSession, exportText } from "../shared/session";
it("restores drafts and retains only the most recent 50 complete records", async () => {
  const draft = freshSession();
  draft.settings.media = ["电影画面", "油画"];
  await saveDraft(draft);
  expect((await loadDraft())?.settings.media).toEqual(["电影画面", "油画"]);
  for (let i = 0; i < 52; i++) {
    await saveHistory({
      ...draft,
      id: `record-${i}`,
      createdAt: new Date(1700000000000 + i * 1000).toISOString(),
    });
  }
  const records = await loadHistory();
  expect(records).toHaveLength(50);
  expect(records[0].id).toBe("record-51");
  expect(records.at(-1)?.id).toBe("record-2");
  await deleteHistory("record-51");
  expect((await loadHistory())[0].id).toBe("record-50");
});
it("exports three independent bilingual blocks without storage credentials", () => {
  const s = {
    ...freshSession(),
    ruleVersion: "v6",
    model: "fixture-model",
    versions: [
      { title: "近景", zh: "中文1", en: "English1" },
      { title: "中景", zh: "中文2", en: "English2" },
      { title: "远景", zh: "中文3", en: "English3" },
    ],
  };
  const md = exportText(s);
  expect(md.match(/```text/g)).toHaveLength(6);
  expect(md.indexOf("中文1")).toBeLessThan(md.indexOf("English1"));
  expect(exportText(s, false)).not.toContain("```");
});
