import express from "express";
import { readFile } from "node:fs/promises";
import { z } from "zod";
import {
  generationSchema,
  missingSettings,
  finalizeVersions,
  parseModelOutput,
} from "../shared/contracts";
import {
  loadConfig,
  saveConfig,
  publicConfig,
  deleteConfigKey,
} from "./config";
import { providerIds } from "../shared/providers";
import { getRuleStatus, readSources, type Manifest } from "./rules";
import {
  PublicError,
  safeOrigin,
  providerFetch,
  decodeCompletion,
  generationPayload,
  decodeResponse,
} from "./provider";
import { buildMessages } from "./prompts";
export function createApp(options: {
  root: string;
  configDir: string;
  manifestPath: string;
  port: number;
}) {
  const app = express();
  app.disable("x-powered-by");
  app.use((req, res, next) => {
    if (
      !safeOrigin(req.headers.host, req.headers.origin, options.port) ||
      req.headers["sec-fetch-site"] === "cross-site"
    ) {
      res.status(403).json({ error: "只允许本机工作台访问" });
      return;
    }
    res.setHeader("X-Content-Type-Options", "nosniff");
    if (req.path.startsWith("/api/")) {
      res.setHeader("Cache-Control", "no-store");
      if (
        ["POST", "PUT", "DELETE"].includes(req.method) &&
        !req.is("application/json")
      ) {
        res.status(415).json({ error: "请求必须使用 JSON" });
        return;
      }
    }
    next();
  });
  app.use((req, res, next) => {
    let pathname: string;
    try {
      pathname = decodeURIComponent(req.path);
    } catch {
      res.status(400).end();
      return;
    }
    if (
      /(?:^|\/)\.(?:local|git)(?:\/|$)/.test(pathname) ||
      /(?:^|\/)\.env/.test(pathname)
    ) {
      res.status(404).end();
      return;
    }
    next();
  });
  app.use(express.json({ limit: "512kb" }));
  const manifest = async () =>
    JSON.parse(await readFile(options.manifestPath, "utf8")) as Manifest;
  app.get("/api/rules", async (_req, res) =>
    res.json(await getRuleStatus(options.root, await manifest())),
  );
  app.get("/api/config", async (req, res) =>
    res.json(
      publicConfig(
        await loadConfig(
          options.configDir,
          z.enum(providerIds).optional().parse(req.query.provider),
        ),
      ),
    ),
  );
  app.put("/api/config", async (req, res) => {
    const patch = z
      .object({
        provider: z.enum(providerIds).optional(),
        baseUrl: z.string().max(2000).optional(),
        model: z.string().trim().max(200).optional(),
        apiKey: z.string().trim().max(2000).optional(),
      })
      .strict()
      .parse(req.body);
    try {
      res.json(await saveConfig(options.configDir, patch));
    } catch (e) {
      throw new PublicError((e as Error).message);
    }
  });
  app.delete("/api/config/key", async (req, res) => {
    const { provider } = z
      .object({ provider: z.enum(providerIds) })
      .strict()
      .parse(req.body);
    res.json(await deleteConfigKey(options.configDir, provider));
  });
  app.post("/api/models", async (req, res) => {
    const { provider } = z
      .object({ provider: z.enum(providerIds).optional() })
      .strict()
      .parse(req.body);
    const data = await providerFetch(
      await loadConfig(options.configDir, provider),
      "/models",
      { method: "GET" },
    );
    const result = z
      .object({
        data: z.array(
          z.object({ id: z.string(), name: z.string().optional() }),
        ),
      })
      .safeParse(data);
    if (!result.success)
      throw new PublicError("无法读取模型列表，可手动填写模型名", 502);
    res.json({
      models: result.data.data.map((m) => ({ id: m.id, name: m.name ?? m.id })),
    });
  });
  app.post("/api/generate", async (req, res) => {
    const input = generationSchema.parse(req.body);
    const m = await manifest();
    const sources = await readSources(options.root, Object.keys(m.files)).catch(
      () => {
        throw new PublicError("skill 来源文件无法读取，请完成同步检查", 409);
      },
    );
    if (sources.hash !== m.hash || sources.hash !== input.ruleHash)
      throw new PublicError("skill 已变化，请完成工作台同步检查后再生成", 409);
    if (input.stage !== "advice" && missingSettings(input.settings).length)
      throw new PublicError("请先完成十项设置");
    if (input.stage === "prompts" && (!input.scene || !input.mode))
      throw new PublicError("请先选择场景与变化方式");
    if (input.stage === "advice" && !input.adviceField)
      throw new PublicError("请选择需要协助的设置");
    const config = await loadConfig(options.configDir);
    if (!config.model) throw new PublicError("请先选择或填写模型名称");
    const abort = new AbortController();
    res.on("close", () => {
      if (!res.writableEnded) abort.abort();
    });
    const payload = generationPayload(
      config,
      buildMessages(input, sources.content),
    );
    const raw = await providerFetch(
      config,
      payload.endpoint,
      {
        method: "POST",
        body: JSON.stringify(payload.body),
      },
      abort.signal,
    );
    let output;
    try {
      output = parseModelOutput(
        config.provider === "openai"
          ? decodeResponse(raw)
          : decodeCompletion(raw),
        input.stage,
      );
      if (output.kind === "prompts")
        output = {
          ...output,
          versions: finalizeVersions(
            output.versions,
            input.settings,
            output.negativeTerms,
          ),
        };
      if (output.kind === "scenes")
        output = {
          ...output,
          scenes: output.scenes.map((s, i) => ({
            ...s,
            id: `${crypto.randomUUID()}-${i + 1}`,
          })),
        };
    } catch (e) {
      throw new PublicError((e as Error).message, 502);
    }
    const latest = await getRuleStatus(options.root, await manifest());
    if (!latest.synced || latest.hash !== sources.hash)
      throw new PublicError("生成期间 skill 发生变化，请同步后重新生成", 409);
    res.json({
      output,
      revision: input.revision,
      ruleHash: sources.hash,
      ruleVersion: sources.version,
      model: config.model,
    });
  });
  app.use("/api", (_req, res) => res.status(404).json({ error: "接口不存在" }));
  app.use(
    (
      err: unknown,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      if (res.headersSent) return;
      const status =
        err instanceof PublicError
          ? err.status
          : err instanceof z.ZodError
            ? 400
            : 500;
      res.status(status).json({
        error:
          err instanceof PublicError
            ? err.message
            : err instanceof z.ZodError
              ? "请求内容缺失或格式不正确"
              : "本地服务出现问题，请检查文件或重启工作台",
      });
    },
  );
  return app;
}
