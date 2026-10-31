import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { mkdtemp, mkdir, copyFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { createApp, validateImage } from '../server.mjs';
import { fixture } from './fixture.mjs';

test('rejects invalid image bytes even when the MIME declaration is allowed', async () => {
  await assert.rejects(validateImage('data:image/png;base64,' + Buffer.from('not a png').toString('base64')), /图片无法读取/);
  const jpeg = await sharp({ create: { width: 10, height: 10, channels: 3, background: '#c34449' } }).jpeg().toBuffer();
  await assert.rejects(validateImage('data:image/png;base64,' + jpeg.toString('base64')), /格式不符/);
});

test('HTTP chain protects session, sends actual image and skill, supports probe, and masks upstream failure', async t => {
  const generated = fixture('v3');
  generated.candidates[0].zh.title = '生活一定要一直赶路吗？';
  generated.candidates[0].en.title = 'Does life always have to be a rush?';
  let received, badStatus = false, calls = 0;
  const upstream = http.createServer(async (req, res) => {
    let raw = ''; for await (const c of req) raw += c;
    received = { headers: req.headers, body: JSON.parse(raw) };
    calls++;
    if (badStatus) { res.writeHead(401); return res.end('fake-sensitive-key'); }
    const probe = received.body.messages[0].content.includes('"summary"');
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify(probe ? { summary: '图1红色方块，图2蓝色方块。' } : generated) } }] }));
  });
  upstream.listen(0, '127.0.0.1'); await once(upstream, 'listening');
  t.after(() => { upstream.closeAllConnections(); upstream.close(); });
  const root = await mkdtemp(join(tmpdir(), 'title-http-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, 'v3/image-to-title-best'), { recursive: true });
  await writeFile(join(root, 'CURRENT'), 'v3');
  await copyFile(new URL('../../../v3/image-to-title-best/SKILL.md', import.meta.url), join(root, 'v3/image-to-title-best/SKILL.md'));
  const app = createApp({ root, env: { OPENAI_API_KEY: 'must-not-be-exposed' } });
  app.listen(0, '127.0.0.1'); await once(app, 'listening');
  t.after(async () => { app.closeAllConnections(); upstream.closeAllConnections(); await Promise.all([new Promise(r => app.close(r)), new Promise(r => upstream.close(r))]); await rm(root, { recursive: true, force: true }); });
  const origin = `http://127.0.0.1:${app.address().port}`;
  const configResponse = await fetch(origin + '/api/config');
  const config = await configResponse.json();
  assert.ok(config.token); assert.equal(config.configured.openai, true);
  assert.ok(!JSON.stringify(config).includes('must-not-be-exposed'));
  const image = 'data:image/png;base64,' + (await sharp({ create: { width: 10, height: 10, channels: 3, background: '#c34449' } }).png().toBuffer()).toString('base64');
  const blue = 'data:image/png;base64,' + (await sharp({ create: { width: 10, height: 10, channels: 3, background: '#3366cc' } }).png().toBuffer()).toString('base64');
  const body = { images: [image, blue], description: '我的颜色示意图', config: { provider: 'custom', baseUrl: `http://127.0.0.1:${upstream.address().port}`, model: 'test-vision', apiKey: 'test-only-key' } };
  const post = (path, extra = {}) => fetch(origin + path, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Workbench-Token': config.token, ...extra }, body: JSON.stringify(body) });
  assert.equal((await post('/api/generate', { 'X-Workbench-Token': 'wrong' })).status, 403);
  assert.equal((await post('/api/generate', { Origin: 'https://outside.example' })).status, 403);
  const response = await post('/api/generate');
  assert.equal(response.status, 200);
  const out = await response.json(); assert.equal(out.candidates.length, 5);
  assert.equal(out.skill_version, 'v3');
  assert.equal(out.candidates[0].zh.title, generated.candidates[0].zh.title);
  assert.equal(calls, 1);
  assert.deepEqual(received.body.messages[1].content.filter(p => p.type === 'image_url').map(p => p.image_url.url), [image, blue]);
  assert.match(received.body.messages[0].content, /image-to-title-best/);
  assert.match(received.body.messages[1].content[0].text, /我的颜色示意图/);
  assert.equal(received.headers.authorization, 'Bearer test-only-key');
  const probe = await post('/api/probe'); assert.match((await probe.json()).summary, /图2蓝色/);
  assert.deepEqual(received.body.messages[1].content.filter(p => p.type === 'image_url').map(p => p.image_url.url), [image, blue]);
  const callCount = calls;
  for (const invalid of [[], Array(10).fill(image), [image, 'data:image/png;base64,YmFk']]) {
    body.images = invalid;
    assert.equal((await post('/api/generate')).status, 400);
    assert.equal(calls, callCount);
  }
  body.images = [image];
  assert.equal((await post('/api/generate')).status, 200);
  assert.equal(received.body.messages[1].content.filter(p => p.type === 'image_url').length, 1);
  badStatus = true;
  const failure = await post('/api/generate'); assert.equal(failure.status, 502);
  assert.doesNotMatch(await failure.text(), /fake-sensitive-key/);
});
