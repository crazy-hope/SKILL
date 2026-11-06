import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import type { RuleStatus } from "../shared/contracts";
export const sourcePaths = [
  "SKILL.md",
  "references/visual-direction.md",
  "references/creative-engine.md",
  "references/midjourney.md",
];
export type Manifest = {
  version: string;
  hash: string;
  files: Record<string, string>;
};
export async function readSources(root: string, paths = sourcePaths) {
  const files: Record<string, string> = {};
  const content: Record<string, string> = {};
  for (const file of [...paths].sort()) {
    content[file] = await readFile(path.join(root, file), "utf8");
    files[file] = createHash("sha256").update(content[file]).digest("hex");
  }
  const hash = createHash("sha256").update(JSON.stringify(files)).digest("hex");
  const version =
    content["SKILL.md"]?.match(/version:\s*["']?(v\d+)/)?.[1] ?? "unknown";
  return { files, content, hash, version };
}
export async function getRuleStatus(
  root: string,
  manifest: Manifest,
): Promise<RuleStatus> {
  try {
    const current = await readSources(root, Object.keys(manifest.files));
    return {
      version: current.version,
      hash: current.hash,
      synced:
        current.hash === manifest.hash && current.version === manifest.version,
      changedFiles: Object.keys(current.files).filter(
        (f) => current.files[f] !== manifest.files[f],
      ),
    };
  } catch {
    return {
      version: manifest.version,
      hash: "unavailable",
      synced: false,
      changedFiles: ["来源文件缺失或无法读取"],
    };
  }
}
