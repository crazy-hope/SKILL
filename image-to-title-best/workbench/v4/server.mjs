import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, resolve, join, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes, createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import sharp from 'sharp';
import { z } from 'zod';
import { AppError, loadSkill, runModel, PROVIDERS } from './lib/core.mjs';
import { validateImageBatch, MAX_IMAGES, MAX_IMAGE_BYTES, MAX_TOTAL_BYTES } from './shared/images.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(here, '../..');
const APP_ID = 'image-to-title-workbench';
const appVersion = /^v\d+$/.test(here.split(sep).at(-1)) ? here.split(sep).at(-1) : 'v1';
const instance = createHash('sha256').update(here).digest('hex').slice(0, 16);
// Allow Base64 expansion plus data URL prefixes, JSON and request metadata.
const MAX_ENCODED_IMAGE = 4 * Math.ceil(MAX_IMAGE_BYTES / 3) + 64;
const MAX_BODY = 4 * Math.ceil(MAX_TOTAL_BYTES / 3) + 1024 * 1024;
const inputSchema = z.object({
  images: z.array(z.string().max(MAX_ENCODED_IMAGE)).min(1).max(MAX_IMAGES), description: z.string().max(2000).default(''),
  config: z.object({ provider: z.enum(['openai', 'deepseek', 'custom']), apiKey: z.string().max(4096).optional(), model: z.string().max(150).optional(), baseUrl: z.string().max(2000).optional() }).strict(),
}).strict();

async function readJson(req) {
  if (!req.headers['content-type']?.startsWith('application/json')) throw new AppError('请求格式需要为 JSON。', 415);
  if (Number(req.headers['content-length']) > MAX_BODY) throw new AppError('请求过大，图片合计不能超过 100 MB。', 413);
  let size = 0; const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY) throw new AppError('请求过大，图片合计不能超过 100 MB。', 413);
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString()); }
  catch { throw new AppError('请求数据无法解析。'); }
}

export async function validateImage(image) {
  const m = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(image);
  if (!m) throw new AppError('请选择 JPG、PNG 或 WebP 图片。');
  const bytes = Buffer.from(m[2], 'base64');
  if (bytes.length > MAX_IMAGE_BYTES) throw new AppError('图片不能超过 100 MB。', 413);
  try {
    const decoder = sharp(bytes, { limitInputPixels: 40000000, animated: false, failOn: 'warning' });
    const metadata = await decoder.metadata();
    if (metadata.format !== m[1] || !metadata.width || !metadata.height || (metadata.pages || 1) > 1) throw new Error('format');
    // Decode the actual pixels to reject truncated files. A tiny output avoids retaining a full decoded bitmap.
    await decoder.resize(1, 1).toBuffer();
  } catch { throw new AppError('图片无法读取、格式不符或像素过大，请使用 4000 万像素以内的静态图片。'); }
}

export async function validateImages(images) {
  try {
    validateImageBatch(Array.isArray(images) ? images.map(image => {
      const match = typeof image === 'string' && /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(image);
      return match ? { type: match[1], size: Buffer.byteLength(match[2], 'base64') } : { type: '', size: 0 };
    }) : images);
  } catch (error) { throw new AppError(error.message); }
  for (const [index, image] of images.entries()) {
    try { await validateImage(image); }
    catch (error) { throw new AppError(`第 ${index + 1} 张：${error.message}`, error.status || 400); }
  }
}

export function createApp({ root = projectRoot, env = process.env, fetchImpl = fetch } = {}) {
  const token = randomBytes(24).toString('hex');
  let active = 0;
  return http.createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Cache-Control', 'no-store');
    const json = (status, value) => { if (!res.destroyed) { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(value)); } };
    try {
      const host = req.headers.host || '';
      if (!/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(host)) throw new AppError('此工作台仅支持本机访问。', 403);
      const origin = req.headers.origin;
      if ((origin && origin !== `http://${host}`) || req.headers['sec-fetch-site'] === 'cross-site') throw new AppError('请求来源不受信任，请从本地工作台访问。', 403);
      const path = new URL(req.url, `http://${host}`).pathname;
      if (req.method === 'GET' && path === '/api/health') return json(200, { app: APP_ID, version: appVersion, instance });
      if (req.method === 'GET' && path === '/api/config') {
        const skill = await loadSkill(root);
        return json(200, { token, appVersion, skillVersion: skill.version, providers: PROVIDERS, configured: { openai: Boolean(env.OPENAI_API_KEY), deepseek: Boolean(env.DEEPSEEK_API_KEY), custom: false } });
      }
      if (req.method === 'POST' && ['/api/generate', '/api/probe'].includes(path)) {
        if (req.headers['x-workbench-token'] !== token) throw new AppError('页面会话已失效，请刷新后重试。', 403);
        if (active >= 2) throw new AppError('已有请求正在处理中，请稍后再试。', 429);
        const controller = new AbortController();
        req.on('aborted', () => controller.abort());
        res.on('close', () => { if (!res.writableEnded) controller.abort(); });
        active++;
        try {
          const raw = await readJson(req);
          const parsed = inputSchema.safeParse(raw);
          if (!parsed.success) throw new AppError('请提供 1—9 张图片、2000 字以内的描述及完整模型设置。');
          const input = parsed.data;
          await validateImages(input.images);
          const skill = await loadSkill(root);
          const output = await runModel({ ...input, skill, purpose: path === '/api/probe' ? 'probe' : 'generate', signal: controller.signal }, { env, fetchImpl });
          return json(200, output);
        } finally { active--; }
      }
      if (path.startsWith('/api/')) return json(404, { error: '接口不存在。' });
      if (req.method !== 'GET' && req.method !== 'HEAD') return json(405, { error: '请求方法不支持。' });
      const dist = join(here, 'dist');
      const file = resolve(dist, '.' + decodeURIComponent(path === '/' ? '/index.html' : path));
      if (!file.startsWith(dist + sep)) throw new AppError('文件不存在。', 404);
      let contents;
      try { if (!(await stat(file)).isFile()) throw new Error(); contents = await readFile(file); }
      catch { throw new AppError('页面文件不存在，请先运行 npm run build。', 404); }
      const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' };
      res.setHeader('Content-Type', types[extname(file)] || 'application/octet-stream');
      res.end(req.method === 'HEAD' ? undefined : contents);
    } catch (error) {
      if (error.name === 'AbortError') return;
      json(error instanceof AppError ? error.status : 500, { error: error instanceof AppError ? error.message : '本地服务发生错误，请检查 Skill 版本和文件是否完整。' });
    }
  });
}

async function start() {
  const envFile = resolve(here, '../.env');
  if (existsSync(envFile)) process.loadEnvFile(envFile);
  const app = createApp();
  const initial = Number(process.env.PORT || 4831);
  if (!Number.isInteger(initial) || initial < 1024 || initial > 65525) throw new Error('PORT 需为 1024—65525 的整数。');
  for (let port = initial; port < initial + 10; port++) {
    try {
      await new Promise((ok, fail) => { app.once('error', fail); app.listen(port, '127.0.0.1', () => { app.removeListener('error', fail); ok(); }); });
      const url = `http://127.0.0.1:${port}`;
      console.log(`画语工作台 ${appVersion} 已启动：${url}\n按 Control+C 停止服务。`);
      if (process.argv.includes('--open')) execFile('open', [url], () => {});
      return;
    } catch (error) {
      if (error.code !== 'EADDRINUSE') throw error;
      try {
        const existing = await fetch(`http://127.0.0.1:${port}/api/health`, { signal: AbortSignal.timeout(800) }).then(r => r.json());
        if (existing.app === APP_ID && existing.instance === instance) {
          const url = `http://127.0.0.1:${port}`;
          console.log(`工作台已运行：${url}`);
          if (process.argv.includes('--open')) execFile('open', [url], () => {});
          return;
        }
      } catch { /* try the next port without touching another process */ }
    }
  }
  throw new Error('可用端口均被占用，请通过 PORT 指定其他端口。');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) start().catch(error => { console.error(error.message); process.exitCode = 1; });
