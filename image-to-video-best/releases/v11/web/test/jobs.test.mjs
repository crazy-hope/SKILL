import test from 'node:test';
import assert from 'node:assert/strict';
import { createJobStore } from '../lib/jobs.mjs';

test('ten jobs run independently, complete out of order and cancel only their own signal', async () => {
  const store = createJobStore();
  const replies = Array.from({length:10}, () => Promise.withResolvers());
  const signals = [];
  const ids = replies.map((reply, i) => store.start(signal => {signals[i]=signal; return reply.promise;}));
  assert.equal(new Set(ids).size,10);
  ids.forEach(id => assert.equal(store.get(id).status,'running'));
  store.remove(ids[1]);
  assert.equal(signals[1].aborted,true);
  assert.equal(signals[9].aborted,false);
  for(const i of [9,7,5,3,0,2,4,6,8]) replies[i].resolve({prompt:`result ${i}`});
  replies[1].resolve({prompt:'cancelled late'});
  await new Promise(setImmediate);
  assert.throws(()=>store.get(ids[1]),/不存在/);
  ids.forEach((id,i)=>{if(i!==1) {assert.equal(store.get(id).data.prompt,`result ${i}`);store.remove(id);}});
});

test('abandoned jobs expire and abort; polling renews their lease', t => {
  t.mock.timers.enable({apis:['setTimeout']});
  const store=createJobStore({ttlMs:100});let signal;
  const id=store.start(s=>{signal=s;return new Promise(()=>{});});
  t.mock.timers.tick(80);assert.equal(store.get(id).status,'running');
  t.mock.timers.tick(80);assert.equal(signal.aborted,false);
  t.mock.timers.tick(21);assert.equal(signal.aborted,true);
  assert.throws(()=>store.get(id),/不存在/);
});

test('job capacity rejects before execution and releases capacity after deletion', () => {
  const store=createJobStore({maxJobs:1});let calls=0;
  const execute=()=>{calls++;return new Promise(()=>{});};
  const id=store.start(execute);
  assert.throws(()=>store.start(execute),/任务较多/);assert.equal(calls,1);
  store.remove(id);store.remove(store.start(execute));assert.equal(calls,2);
});

test('unexpected job errors are sanitized', async () => {
  const store=createJobStore();
  const id=store.start(async()=>{throw Error('PRIVATE_SECRET');});
  await new Promise(setImmediate);
  const result=store.get(id);
  assert.equal(result.status,'failed');
  assert.equal(JSON.stringify(result).includes('PRIVATE_SECRET'),false);
  store.remove(id);
});
