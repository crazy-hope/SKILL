import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateInput } from '../lib/input.mjs';
import { readConfig } from '../lib/config.mjs';
const png = readFileSync(new URL('../../v1/image-to-video-best/assets/cases/liquid-goddess/source.png', import.meta.url));
export const image = `data:image/png;base64,${png.toString('base64')}`;
export const request = (patch = {}) => ({ videoModel: 'seedance-2.5', platform: '尚未确定', idea: '人物慢慢抬手，水流持续回旋', image, ...patch });

test('defaults preserve explicit choices and strip unknown fields', () => {
  const a = validateInput(request());
  assert.equal(a.duration, 5); assert.equal(a.level, 'auto'); assert.equal(a.version, 'v5');
  const b = validateInput(request({duration: 7, level: 'detailed', apiKey: 'untrusted'}));
  assert.equal(b.duration, 7); assert.equal(b.level, 'detailed'); assert.equal(b.apiKey, undefined);
  assert.equal(b.imageInfo.width, 1388); assert.equal(b.imageInfo.height, 776);
});
for (const [name, patch] of Object.entries({
  missingImage: { image: undefined }, unknownLevel: {level:'huge'},
  negativeDuration: {duration: -2}, stringDuration: {duration:'7'},
  infiniteDuration: {duration: Infinity}, badVersion: {version:'../../'}, badModel: {videoModel:'seedance-9'},
  longIdea: {idea:'字'.repeat(6001)}, longDetail: {details:{camera:'字'.repeat(2001)}},
  fakePng: {image:'data:image/png;base64,'+Buffer.from('this is not a PNG file').toString('base64')},
  wrongMime: {image:image.replace('image/png','image/jpeg')}, svg: {image:'data:image/svg+xml;base64,PHN2Zz4='},
  invalidBase64: {image:'data:image/png;base64,!!!!'}
})) test(`reject ${name}`, () => assert.throws(() => validateInput(request(patch)), {name:'AppError'}));
test('decoded image size is limited by configuration', () => {
  assert.throws(() => validateInput(request(), {maxImageBytes: 100}), /图片/);
});
test('config requires all three values, accepts API root, never defaults a billed model', () => {
  const c = readConfig({}); assert.equal(c.ready,false); assert.equal(c.port,3210);
  assert.deepEqual(c.missing, ['LLM_BASE_URL','LLM_MODEL','LLM_API_KEY']);
  const d = readConfig({LLM_BASE_URL:'https://example.com/v1/',LLM_MODEL:'vision-model',LLM_API_KEY:'secret'});
  assert.equal(d.endpoint,'https://example.com/v1/chat/completions'); assert.equal(d.ready,true);
});
for (const value of ['file:///tmp/key', 'http://example.com/v1', 'https://user:pass@example.com/v1', 'https://example.com/v1?key=secret', 'https://example.com/v1/chat/completions']) {
  test(`reject unsafe or ambiguous endpoint ${value}`, () => assert.throws(() => readConfig({LLM_BASE_URL:value}), /LLM_BASE_URL/));
}
test('allows loopback HTTP model service and rejects invalid numeric configuration', () => {
  assert.equal(readConfig({LLM_BASE_URL:'http://127.0.0.1:8000/v1'}).endpoint,'http://127.0.0.1:8000/v1/chat/completions');
  for (const env of [{PORT:'-1'}, {PORT:'abc'}, {MAX_IMAGE_MB:'0'}, {MAX_IMAGE_MB:'11'}, {LLM_TIMEOUT_MS:'Infinity'}]) assert.throws(()=>readConfig(env));
});

test('single image accepts automatic design without inventing a brief or platform', () => {
  for (const idea of ['', '   ', undefined]) {
    const input=validateInput(request({idea,platform:''}));
    assert.equal(input.idea,'');assert.equal(input.platform,'尚未确定');
  }
});
