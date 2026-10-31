import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import sharp from 'sharp';
import { createApp, validateImage } from '../server.mjs';
import { fixture } from './fixture.mjs';

test('rejects invalid image bytes even when the MIME declaration is allowed', async () => {
  await assert.rejects(validateImage('data:image/png;base64,' + Buffer.from('not a png').toString('base64')), /图片无法读取/);
  const jpeg = await sharp({ create: { width: 10, height: 10, channels: 3, background: '#c34449' } }).jpeg().toBuffer();
  await assert.rejects(validateImage('data:image/png;base64,' + jpeg.toString('base64')), /格式不符/);
});

test('HTTP chain protects session, sends actual image and skill, supports probe, and masks upstream failure', async t => {
  let received, badStatus = false;
  const upstream = http.createServer(async (req, res) => {
    let raw = ''; for await (const c of req) raw += c;
    received = { headers: req.headers, body: JSON.parse(raw) };
    if (badStatus) { res.writeHead(401); return res.end('fake-sensitive-key'); }
    const probe = received.body.messages[0].content.includes('"summary"');
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify(probe ? { summary: '红色方块。' } : fixture()) } }] }));
  });
  upstream.listen(0, '127.0.0.1'); await once(upstream, 'listening');
  const app = createApp({ env: { OPENAI_API_KEY: 'must-not-be-exposed' } });
  app.listen(0, '127.0.0.1'); await once(app, 'listening');
  t.after(async () => { app.closeAllConnections(); upstream.closeAllConnections(); await Promise.all([new Promise(r => app.close(r)), new Promise(r => upstream.close(r))]); });
  const origin = `http://127.0.0.1:${app.address().port}`;
  const configResponse = await fetch(origin + '/api/config');
  const config = await configResponse.json();
  assert.ok(config.token); assert.equal(config.configured.openai, true);
  assert.ok(!JSON.stringify(config).includes('must-not-be-exposed'));
  const image = 'data:image/png;base64,' + (await sharp({ create: { width: 10, height: 10, channels: 3, background: '#c34449' } }).png().toBuffer()).toString('base64');
  const body = { image, description: '我的颜色示意图', config: { provider: 'custom', baseUrl: `http://127.0.0.1:${upstream.address().port}`, model: 'test-vision', apiKey: 'test-only-key' } };
  const post = (path, extra = {}) => fetch(origin + path, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Workbench-Token': config.token, ...extra }, body: JSON.stringify(body) });
  assert.equal((await post('/api/generate', { 'X-Workbench-Token': 'wrong' })).status, 403);
  assert.equal((await post('/api/generate', { Origin: 'https://outside.example' })).status, 403);
  const response = await post('/api/generate');
  assert.equal(response.status, 200);
  const out = await response.json(); assert.equal(out.candidates.length, 5);
  assert.equal(received.body.messages[1].content[1].image_url.url, image);
  assert.match(received.body.messages[0].content, /image-to-title-best/);
  assert.match(received.body.messages[1].content[0].text, /我的颜色示意图/);
  assert.equal(received.headers.authorization, 'Bearer test-only-key');
  const probe = await post('/api/probe'); assert.equal((await probe.json()).summary, '红色方块。');
  badStatus = true;
  const failure = await post('/api/generate'); assert.equal(failure.status, 502);
  assert.doesNotMatch(await failure.text(), /fake-sensitive-key/);
});
