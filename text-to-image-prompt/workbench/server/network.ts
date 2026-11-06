import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { Agent, EnvHttpProxyAgent, type Dispatcher } from "undici";

type ProxySettings = {
  httpProxy?: string;
  httpsProxy?: string;
  noProxy?: string;
};
const execFileAsync = promisify(execFile);
const direct = new Agent();
let cached: { key: string; agent: Dispatcher } | undefined;

export function parseMacProxySettings(source: string): ProxySettings {
  const value = (key: string) =>
    source.match(new RegExp(`^\\s*${key}\\s*:\\s*(.+)$`, "m"))?.[1].trim();
  const proxy = (protocol: "HTTP" | "HTTPS") => {
    if (value(`${protocol}Enable`) !== "1") return undefined;
    const host = value(`${protocol}Proxy`);
    const port = Number(value(`${protocol}Port`));
    if (
      !host ||
      !/^[\w.:[\]-]+$/.test(host) ||
      !Number.isInteger(port) ||
      port < 1 ||
      port > 65535
    )
      return undefined;
    // macOS's Secure Web Proxy is an HTTP CONNECT proxy, not a TLS proxy URL.
    const authority =
      host.includes(":") && !host.startsWith("[") ? `[${host}]` : host;
    return `http://${authority}:${port}`;
  };
  const httpProxy = proxy("HTTP");
  const httpsProxy = proxy("HTTPS");
  const exceptions = source.match(
    /ExceptionsList\s*:\s*<array>\s*\{([^}]+)\}/,
  )?.[1];
  const noProxy = exceptions
    ?.split("\n")
    .map((line) => line.match(/^\s*\d+\s*:\s*(\S+)/)?.[1])
    .filter(Boolean)
    .join(",");
  return {
    ...(httpProxy && { httpProxy }),
    ...(httpsProxy && { httpsProxy }),
    ...(noProxy && { noProxy }),
  };
}

export function resolveProxySettings(
  env: NodeJS.ProcessEnv,
  system: ProxySettings,
): ProxySettings {
  const httpProxy = env.http_proxy ?? env.HTTP_PROXY;
  const httpsProxy = env.https_proxy ?? env.HTTPS_PROXY;
  const noProxy = env.no_proxy ?? env.NO_PROXY;
  if (httpProxy !== undefined || httpsProxy !== undefined)
    return {
      httpProxy: httpProxy ?? "",
      httpsProxy: httpsProxy ?? "",
      noProxy: noProxy ?? "",
    };
  return { ...system, ...(noProxy !== undefined && { noProxy }) };
}

export async function modelDispatcher(url: string): Promise<Dispatcher> {
  const target = new URL(url);
  const host = target.hostname.toLowerCase().replace(/\.$/, "");
  // Local model services must not be sent through an external proxy.
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host === "[::1]" ||
    host.startsWith("127.")
  )
    return direct;
  const env = process.env;
  let system: ProxySettings = {};
  if (
    process.platform === "darwin" &&
    [env.http_proxy, env.HTTP_PROXY, env.https_proxy, env.HTTPS_PROXY].every(
      (value) => value === undefined,
    )
  ) {
    try {
      const { stdout } = await execFileAsync("/usr/sbin/scutil", ["--proxy"], {
        timeout: 2000,
        maxBuffer: 64 * 1024,
      });
      system = parseMacProxySettings(stdout);
      // System proxy switches are independent, unlike HTTP_PROXY's HTTPS fallback.
      if (target.protocol === "https:" && !system.httpsProxy) return direct;
    } catch {
      // Unsupported/unavailable system settings leave ordinary direct access intact.
    }
  }
  const options = resolveProxySettings(env, system);
  if (!options.httpProxy && !options.httpsProxy) return direct;
  const key = JSON.stringify(options);
  if (cached?.key !== key) {
    const previous = cached;
    cached = {
      key,
      agent: new EnvHttpProxyAgent({
        httpProxy: "",
        httpsProxy: "",
        noProxy: "",
        ...options,
      }),
    };
    // Gracefully drain previous requests when proxy settings change.
    void previous?.agent.close().catch(() => {});
  }
  return cached.agent;
}
