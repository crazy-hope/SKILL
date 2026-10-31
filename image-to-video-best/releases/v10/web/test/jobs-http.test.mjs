import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createApp } from '../lib/http.mjs';
import { readConfig } from '../lib/config.mjs';
import { request, fixture } from './helpers.mjs';

async function setup(t, generateImpl) {
  const server=createServer(createApp({config:{...readConfig({}),ready:true},generateImpl}));
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  t.after(()=>new Promise(resolve=>{server.closeAllConnections();server.close(resolve);}));
  const base=`http://127.0.0.1:${server.address().port}`;
  const send=(path='',{method='POST',data={},origin=base}={})=>fetch(`${base}/api/generate-jobs${path}`,{method,headers:{Origin:origin,'Content-Type':'application/json'},body:method==='DELETE'?undefined:JSON.stringify(data)});
  return send;
}

test('HTTP submission releases connections before ten jobs finish; cancellation, failures and metadata stay isolated', async t=>{
  const pending=new Map();let peak=0,active=0;
  const send=await setup(t, async(input,context,config,{signal})=>{
    active++;peak=Math.max(peak,active);
    const reply=Promise.withResolvers();pending.set(input.idea,{...reply,signal});
    signal.addEventListener('abort',()=>reply.reject(Error('aborted')),{once:true});
    try {await reply.promise;return {...fixture,prompt:input.idea};}finally{active--;}
  });
  const ids=[];
  t.after(async()=>{for(const id of ids)await send('/'+id,{method:'DELETE'}).catch(()=>{});});
  for(let i=0;i<10;i++){
    const response=await send('',{data:request({idea:`job ${i}`})});
    assert.equal(response.status,202);ids.push((await response.json()).id);
  }
  assert.equal(peak,10);assert.equal(active,10);
  const poll=async i=>(await send('/'+ids[i])).json();
  assert.equal((await poll(0)).status,'running');
  await send('/'+ids[0],{method:'DELETE'});
  assert.equal(pending.get('job 0').signal.aborted,true);
  assert.equal(pending.get('job 9').signal.aborted,false);
  pending.get('job 1').reject(Error('PRIVATE_SECRET'));
  pending.get('job 9').resolve();
  await new Promise(setImmediate);
  const last=await poll(9);assert.equal(last.status,'completed');
  assert.equal(last.data.result.prompt,'job 9');assert.equal(last.data.metadata.skillVersion,'v6');
  const failed=await poll(1);assert.equal(failed.status,'failed');assert.ok(!JSON.stringify(failed).includes('PRIVATE_SECRET'));
  assert.equal((await poll(2)).status,'running');
  assert.equal((await send('/'+ids[0])).status,404);
  for(const id of ids)await send('/'+id,{method:'DELETE'});
});

test('job endpoints enforce origin, input validation and opaque IDs', async t=>{
  let calls=0;const send=await setup(t,async()=>{calls++;return fixture;});
  assert.equal((await send('',{data:request(),origin:'https://evil.invalid'})).status,403);
  assert.equal((await send('',{data:{}})).status,400);assert.equal(calls,0);
  const {id}=await (await send('',{data:request()})).json();
  try {
    assert.equal((await send('/'+id,{origin:'https://evil.invalid'})).status,403);
    assert.equal((await send('/'+id,{method:'DELETE',origin:'https://evil.invalid'})).status,403);
    assert.equal((await send('/00000000-0000-0000-0000-000000000000')).status,404);
    assert.equal((await send('/'+id,{data:{padding:'x'.repeat(20000)}})).status,413);
  } finally {await send('/'+id,{method:'DELETE'});}
});
