import test from 'node:test';
import assert from 'node:assert/strict';
import { loadSkillContext } from '../lib/catalog.mjs';
for (const videoModel of ['seedance-2.0','seedance-2.5','runway-gen4.5','wan-3.0']) {
  test(`loads only selected model card: ${videoModel}`, async () => {
    const c = await loadSkillContext({version:'v1',videoModel});
    assert.equal(c.snapshotDate,'2026-10-17');
    assert.equal(c.files.filter(x=>x.includes('/models/')).length,1);
    assert.ok(c.files.includes(`references/models/${videoModel}.md`));
    assert.ok(c.text.includes('交付契约')); assert.ok(c.text.includes('中等'));
    assert.ok(c.sources.length>0); assert.ok(c.sources.every(s=>s.url.startsWith('https://')));
    assert.ok(!c.files.some(x=>x.includes('validation')||x.includes('original-prompt')));
  });
}
test('rejects path traversal and unknown IDs before reading', async()=>{
  await assert.rejects(loadSkillContext({version:'../v1',videoModel:'seedance-2.0'}));
  await assert.rejects(loadSkillContext({version:'v1',videoModel:'../../README'}));
});
