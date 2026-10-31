import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { startWorkbench } from '../lib/startup.mjs';
import { readConfig } from '../lib/config.mjs';

const config=()=>({...readConfig({}),port:0});
const close=server=>new Promise(resolve=>{server.closeAllConnections();server.close(resolve);});

test('opens the actual listening URL only after the workbench is ready',async t=>{
  let opened,ready;
  const running=await startWorkbench(config(),{openPage:async url=>{
    opened=url;const response=await fetch(`${url}/api/config`);
    ready={status:response.status,data:await response.json()};
  }});
  t.after(()=>close(running.server));
  assert.equal(opened,running.url);assert.equal(running.existing,false);
  assert.equal(ready.status,200);assert.equal(ready.data.skillVersion,'v5');
});

test('a second launcher opens the existing workbench without owning or stopping it',async t=>{
  const first=await startWorkbench(config());t.after(()=>close(first.server));
  const urls=[];
  const second=await startWorkbench({...config(),port:first.server.address().port},{openPage:async url=>urls.push(url)});
  assert.equal(second.existing,true);assert.equal(second.server,null);assert.deepEqual(urls,[first.url]);
  assert.equal((await fetch(first.url)).status,200);
});

test('an unrelated occupied port is not opened or terminated',async t=>{
  const other=createServer((_req,res)=>res.end('{"ready":true}'));
  await new Promise(resolve=>other.listen(0,'127.0.0.1',resolve));t.after(()=>close(other));
  let opened=false;
  await assert.rejects(startWorkbench({...config(),port:other.address().port},{openPage:async()=>{opened=true;}}),{code:'EADDRINUSE'});
  assert.equal(opened,false);assert.ok(other.listening);
});

test('browser launch failure leaves the new service available and reports a safe message',async t=>{
  const warnings=[];
  const running=await startWorkbench(config(),{openPage:async()=>{throw new Error('do not echo arbitrary process errors');},warn:text=>warnings.push(text)});
  t.after(()=>close(running.server));
  assert.equal((await fetch(running.url)).status,200);
  assert.ok(warnings[0].includes(running.url));assert.ok(!warnings[0].includes('arbitrary'));
});
