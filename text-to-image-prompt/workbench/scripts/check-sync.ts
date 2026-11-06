import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { getRuleStatus } from "../server/rules";
const base = new URL("../", import.meta.url);
const manifest = JSON.parse(
  await readFile(new URL("skill-manifest.json", base), "utf8"),
);
const status = await getRuleStatus(
  fileURLToPath(new URL("../", base)),
  manifest,
);
console.log(JSON.stringify(status, null, 2));
if (!status.synced) process.exitCode = 1;
