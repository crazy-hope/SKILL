import test from 'node:test';
import assert from 'node:assert/strict';
import * as state from '../public/state.js';

function task() {
  assert.equal(typeof state.createGenerationTask, 'function', 'independent generation tasks are available');
  return state.createGenerationTask();
}
function deferred() { return Promise.withResolvers(); }

test('ten tasks run together and keep out-of-order responses in their own result', async () => {
  const tasks = Array.from({length:10}, task);
  const replies = tasks.map(deferred);
  const runs = tasks.map((t, i) => t.run(() => replies[i].promise));
  assert.ok(tasks.every(t => t.busy));
  for (const i of [9, 3, 7, 1, 5, 0, 8, 4, 6, 2]) { replies[i].resolve({prompt:`result ${i}`}); await runs[i]; }
  assert.deepEqual(tasks.map(t => t.record.data.prompt), Array.from({length:10},(_,i)=>`result ${i}`));
  assert.ok(tasks.every(t => !t.busy));
});

test('cancel and late response cannot replace retry or interrupt another task', async () => {
  const a=task(), b=task(), old=deferred(), other=deferred();
  let signal;
  const first=a.run(s=>{signal=s;return old.promise;});
  const second=b.run(()=>other.promise);
  a.cancel(); assert.ok(signal.aborted); assert.ok(b.busy);
  await a.run(async()=>({prompt:'retry'}));
  old.resolve({prompt:'obsolete'}); await first;
  other.resolve({prompt:'other'}); await second;
  assert.equal(a.record.data.prompt,'retry'); assert.equal(b.record.data.prompt,'other');
});

test('edits retain stale result, prevent old response and do not affect another task', async () => {
  const a=task(), b=task();
  await a.run(async()=>({prompt:'saved'}));
  const reply=deferred(); const running=a.run(()=>reply.promise);
  const other=deferred(); const bRun=b.run(()=>other.promise);
  a.changed(); assert.equal(a.stale,true); assert.ok(b.busy);
  reply.resolve({prompt:'late'}); await running;
  assert.equal(a.record.data.prompt,'saved');
  other.resolve({prompt:'B'}); await bRun; assert.equal(b.stale,false);
});

test('duplicate start is ignored, failures stay local, retry succeeds without automatic calls', async () => {
  const a=task(), b=task(), reply=deferred(); let calls=0;
  const first=a.run(()=>{calls++;return reply.promise;});
  await a.run(()=>{calls++;return Promise.resolve({prompt:'duplicate'});});
  await b.run(async()=>({prompt:'B'}));
  reply.reject(new Error('limit')); await first;
  assert.equal(calls,1); assert.equal(a.error,'limit'); assert.equal(a.busy,false);
  assert.equal(b.record.data.prompt,'B');
  await a.run(async()=>({prompt:'recovered'}));
  assert.equal(a.error,''); assert.equal(a.record.data.prompt,'recovered');
});
