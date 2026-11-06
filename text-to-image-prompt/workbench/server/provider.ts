import { z } from "zod";
import type { Config } from "./config";
import { providers } from "../shared/providers";
import { modelDispatcher } from "./network";
export class PublicError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export function safeOrigin(
  host: string | undefined,
  origin: string | undefined,
  port: number,
) {
  if (
    !host ||
    ![`127.0.0.1:${port}`, `localhost:${port}`, `[::1]:${port}`].includes(host)
  )
    return false;
  return !origin || origin === `http://${host}`;
}
export function decodeCompletion(value: unknown) {
  const parsed = z
    .object({
      choices: z
        .array(
          z.object({
            finish_reason: z.string().nullable(),
            message: z.object({ content: z.string().nullable() }),
          }),
        )
        .min(1),
    })
    .safeParse(value);
  if (!parsed.success) throw new PublicError("模型返回格式异常，请重试", 502);
  const choice = parsed.data.choices[0];
  if (choice.finish_reason === "length")
    throw new PublicError(
      "模型输出被截断，请重试或选择输出容量更大的模型",
      502,
    );
  if (choice.finish_reason !== "stop")
    throw new PublicError("模型未正常完成输出，请重试", 502);
  if (!choice.message.content?.trim())
    throw new PublicError("模型返回空内容，请重试", 502);
  return choice.message.content;
}
export function generationPayload(
  config: Pick<Config, "provider" | "model">,
  messages: { role: string; content: string }[],
) {
  return config.provider === "openai"
    ? {
        endpoint: "/responses",
        body: {
          model: config.model,
          input: messages,
          text: { format: { type: "json_object" } },
          max_output_tokens: 16384,
          store: false,
          stream: false,
        },
      }
    : {
        endpoint: "/chat/completions",
        body: {
          model: config.model,
          messages,
          response_format: { type: "json_object" },
          max_tokens: 8192,
          thinking: { type: "disabled" },
          stream: false,
        },
      };
}
export function decodeResponse(value: unknown) {
  const parsed = z
    .object({
      status: z.string(),
      incomplete_details: z
        .object({ reason: z.string() })
        .nullable()
        .optional(),
      output: z.array(
        z.object({
          type: z.string(),
          content: z
            .array(z.object({ type: z.string(), text: z.string().optional() }))
            .optional(),
        }),
      ),
    })
    .safeParse(value);
  if (!parsed.success) throw new PublicError("模型返回格式异常，请重试", 502);
  const result = parsed.data;
  if (
    result.status === "incomplete" &&
    result.incomplete_details?.reason === "max_output_tokens"
  )
    throw new PublicError(
      "模型输出被截断，请重试或选择输出容量更大的模型",
      502,
    );
  if (result.status !== "completed")
    throw new PublicError("模型未正常完成输出，请重试", 502);
  const content = result.output
    .filter((item) => item.type === "message")
    .flatMap((item) => item.content ?? []);
  if (content.some((item) => item.type === "refusal"))
    throw new PublicError("模型拒绝了本次请求，请调整内容后重试", 502);
  const text = content
    .filter((item) => item.type === "output_text")
    .map((item) => item.text ?? "")
    .join("");
  if (!text.trim()) throw new PublicError("模型返回空内容，请重试", 502);
  return text;
}
export async function providerFetch(
  config: Config,
  endpoint: string,
  init: RequestInit,
  signal?: AbortSignal,
) {
  if (!config.apiKey) throw new PublicError("请先在模型设置中填写 API Key");
  const timeout = AbortSignal.timeout(180000);
  try {
    const requestSignal = signal ? AbortSignal.any([signal, timeout]) : timeout;
    requestSignal.throwIfAborted();
    const url = `${config.baseUrl}${endpoint}`;
    const dispatcher = await modelDispatcher(url);
    requestSignal.throwIfAborted();
    const options = {
      ...init,
      redirect: "error" as const,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      signal: requestSignal,
      dispatcher,
    };
    const response = await fetch(url, options);
    if (!response.ok) {
      const messages: Record<number, string> = {
        401: "API Key 无效，请检查模型设置",
        400: "模型不支持当前请求格式，请选择支持文本和 JSON 输出的模型并检查接口地址",
        402: `账户余额不足，请检查 ${providers[config.provider].name} 账户`,
        403: "接口拒绝访问，请检查权限",
        404: "模型或接口不存在，请检查地址和模型名",
        429: "请求受限，请稍后重试或检查账户额度",
      };
      throw new PublicError(
        messages[response.status] ??
          `模型服务暂时不可用（${response.status}），请稍后重试`,
        502,
      );
    }
    return await response.json();
  } catch (e) {
    if (e instanceof PublicError) throw e;
    if (signal?.aborted) throw new PublicError("已取消生成", 499);
    if (timeout.aborted)
      throw new PublicError("生成超时，设置已保留，请重试", 504);
    throw new PublicError("无法连接模型服务，请检查网络与接口地址", 502);
  }
}
