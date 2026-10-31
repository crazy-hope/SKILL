import { AppError } from './errors.mjs';
function number(env, name, fallback, min, max) {
  const n = env[name] === undefined || env[name] === '' ? fallback : Number(env[name]);
  if (!Number.isFinite(n) || n < min || n > max || (name !== 'MAX_IMAGE_MB' && !Number.isInteger(n))) {
    throw new AppError('CONFIG_INVALID', `${name} 配置无效。`, 503);
  }
  return n;
}
export function readConfig(env = process.env) {
  const base = (env.LLM_BASE_URL || '').trim();
  let endpoint = '';
  if (base) {
    try {
      const u = new URL(base);
      const local = ['127.0.0.1', 'localhost', '[::1]'].includes(u.hostname);
      if ((u.protocol !== 'https:' && !(u.protocol === 'http:' && local)) || u.username || u.password || u.search || u.hash || /\/chat\/completions\/?$/.test(u.pathname)) throw new Error();
      endpoint = `${u.href.replace(/\/+$/, '')}/chat/completions`;
    } catch { throw new AppError('CONFIG_INVALID', 'LLM_BASE_URL 应为 HTTPS API 根地址（本机可用 HTTP），不含凭据、查询参数或 /chat/completions。', 503); }
  }
  const model = (env.LLM_MODEL || '').trim();
  const apiKey = (env.LLM_API_KEY || '').trim();
  const missing = [['LLM_BASE_URL',base],['LLM_MODEL',model],['LLM_API_KEY',apiKey]].filter(([,v])=>!v).map(([k])=>k);
  return { endpoint, model, apiKey, missing, ready: missing.length === 0,
    port: number(env, 'PORT', 3210, 1, 65535),
    timeoutMs: number(env, 'LLM_TIMEOUT_MS', 120000, 1000, 600000),
    maxImageBytes: Math.floor(number(env, 'MAX_IMAGE_MB', 10, 0.01, 10) * 1024 * 1024) };
}
