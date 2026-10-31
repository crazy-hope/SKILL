import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareImageBatch, validateImageBatch, MAX_IMAGES, MAX_TOTAL_BYTES } from '../shared/images.mjs';

const file = size => ({ type: 'image/png', size });
test('a collection accepts 1–9 images and limits aggregate bytes before decoding', () => {
  assert.doesNotThrow(() => validateImageBatch([file(10)]));
  assert.doesNotThrow(() => validateImageBatch(Array.from({ length: MAX_IMAGES }, () => file(1024))));
  assert.doesNotThrow(() => validateImageBatch([file(10*1024*1024),file(10*1024*1024),file(10*1024*1024)]));
  assert.doesNotThrow(() => validateImageBatch([file(100*1024*1024)]));
  assert.doesNotThrow(() => validateImageBatch([file(60*1024*1024), file(40*1024*1024)]));
  assert.throws(() => validateImageBatch([file(60*1024*1024), file(40*1024*1024+1)]), /合计.*100 MB/);
  assert.throws(() => validateImageBatch([]), /至少/);
  assert.throws(() => validateImageBatch(Array.from({ length: MAX_IMAGES+1 }, () => file(10))), /最多/);
  assert.throws(() => validateImageBatch([file(100*1024*1024+1)]), /单张/);
  assert.throws(() => validateImageBatch(Array.from({ length: 4 }, () => file(MAX_TOTAL_BYTES/4+1))), /合计/);
  assert.throws(() => validateImageBatch([file(10), { type:'text/plain',size:10 }]), /第 2 张/);
});

test('appends an entire ordered batch, does not mutate the existing collection on read failure', async () => {
  const existing = [{ ...file(10), name: 'old.png' }];
  const additions = [{ ...file(10), name: 'a.png' }, { ...file(10), name: 'b.png' }];
  const seen = [];
  const result = await prepareImageBatch(existing, additions, async f => { seen.push(f.name); return { ...f, url: f.name }; });
  assert.deepEqual(result.map(f => f.name), ['old.png', 'a.png', 'b.png']);
  assert.deepEqual(seen, ['a.png', 'b.png']);
  await assert.rejects(prepareImageBatch(existing, additions, async f => { if (f.name === 'b.png') throw new Error(); return f; }), /第 3 张/);
  assert.equal(existing.length, 1);
  assert.equal(additions.length, 2);
  let reads = 0;
  await assert.rejects(prepareImageBatch(existing, [additions[0], { type: 'image/gif', size: 10, name: 'bad.gif' }], async f => { reads++; return f; }), /第 3 张格式不支持/);
  assert.equal(reads, 0);
  assert.equal(existing.length, 1);
});
