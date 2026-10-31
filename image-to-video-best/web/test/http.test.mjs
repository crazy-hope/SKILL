import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer, request as httpRequest } from 'node:http';
import { createApp } from '../lib/http.mjs';
import { readConfig } from '../lib/config.mjs';
import { request, fixture, completion } from './helpers.mjs';
async function listen(handler,t) {
  const server=createServer(handler); await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  t.after(()=>new Promise(resolve=>{server.closeAllConnections();server.close(resolve);}));
  return `http://127.0.0.1:${server.address().port}`;
}
function post(base,data,extra={}) {return fetch(base+'/api/generate',{method:'POST',headers:{'Content-Type':'application/json',Origin:base,...extra},body:JSON.stringify(data)});}
test('config remains usable without credentials and exposes no secret/endpoint',async t=>{
  const base=await listen(createApp({config:readConfig({})}),t);
  const r=await fetch(base+'/api/config'); assert.equal(r.status,200);
  const c=await r.json(); assert.equal(c.ready,false); assert.deepEqual(c.models.map(m=>m.id),['seedance-2.0','seedance-2.5','kling-o3','kling-4.0']);assert.equal(c.appVersion,'0.8.1');assert.equal(c.skillVersion,'v6');
  assert.equal(c.endpoint,undefined); assert.equal(c.apiKey,undefined); assert.equal(c.model,undefined);
  const res=await post(base,request()); assert.equal(res.status,503); assert.equal((await res.json()).error.code,'NOT_CONFIGURED');
});
test('rejects foreign Host/Origin, missing Origin, bad content type and traversal',async t=>{
  const base=await listen(createApp({config:readConfig({})}),t);
  const hostStatus=await new Promise((resolve,reject)=>{
    const req=httpRequest(base+'/api/config',{headers:{Host:'evil.invalid'}},res=>{res.resume();resolve(res.statusCode);});
    req.on('error',reject);req.end();
  });
  assert.equal(hostStatus,403);
  assert.equal((await post(base,request(),{Origin:'https://evil.invalid'})).status,403);
  assert.equal((await fetch(base+'/api/generate',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).status,403);
  assert.equal((await post(base,{}, {'Content-Type':'text/plain'})).status,415);
  for(const p of ['/.env','/../README.md','/%2e%2e/v1/image-to-video-best/SKILL.md']) assert.equal((await fetch(base+p)).status,404);
});
test('oversized request rejected before generation; unexpected errors sanitized',async t=>{
  const config={...readConfig({}),ready:true,maxImageBytes:100};
  let calls=0;
  const base=await listen(createApp({config,generateImpl:async()=>{calls++;throw new Error('PRIVATE_SECRET');}}),t);
  const large=await post(base,{idea:'x'.repeat(150000)}); assert.equal(large.status,413); assert.equal(calls,0);
  const oversizedImage='data:image/png;base64,'+Buffer.from(request().image.split(',')[1],'base64').subarray(0,101).toString('base64');
  const bad=await post(base,request({image:oversizedImage})); assert.equal(bad.status,400); assert.equal(calls,0);
});
test('real route with local simulated upstream carries image and Skill; trusted metadata',async t=>{
  let upstreamRequest;
  const upstream=await listen(async(req,res)=>{
    let raw='';for await(const c of req)raw+=c;upstreamRequest=JSON.parse(raw);
    res.setHeader('Content-Type','application/json');res.end(JSON.stringify(completion({...fixture,snapshotDate:'fake'})));
  },t);
  const config=readConfig({LLM_BASE_URL:upstream+'/v1',LLM_MODEL:'test-vision',LLM_API_KEY:'LOCAL_TEST_ONLY'});
  const base=await listen(createApp({config}),t);
  const res=await post(base,request());assert.equal(res.status,200);
  const data=await res.json(); assert.equal(data.result.prompt,fixture.prompt);
  assert.equal(data.metadata.skillVersion,'v6');assert.equal(data.metadata.snapshotDate,'2026-10-17');
  assert.equal(data.metadata.onlineVerified,false);assert.equal(data.metadata.duration,7);
  assert.equal(upstreamRequest.messages[1].content[1].image_url.url,request().image);
  assert.match(upstreamRequest.messages[0].content,/seedance-2.5.md/);
  assert.ok(!JSON.stringify(data).includes('LOCAL_TEST_ONLY'));
});
test('unexpected server errors never expose implementation details',async t=>{
  const base=await listen(createApp({config:{...readConfig({}),ready:true},generateImpl:async()=>{throw new Error('PRIVATE_SECRET');}}),t);
  const res=await post(base,request());assert.equal(res.status,500);assert.ok(!(await res.text()).includes('PRIVATE_SECRET'));
});

test('UI configuration persists, stays secret, and immediately drives generation',async t=>{
  const {mkdtemp,readFile,stat,rm}=await import('node:fs/promises');
  const {tmpdir}=await import('node:os'); const {join}=await import('node:path');
  const dir=await mkdtemp(join(tmpdir(),'i2v-config-'));t.after(()=>rm(dir,{recursive:true,force:true}));
  const configFile=join(dir,'connection.json');
  let used;
  const handler=()=>createApp({config:readConfig({}),configFile,generateImpl:async(_i,_c,c)=>{used=c;return fixture;}});
  const base=await listen(handler(),t);
  const save=await fetch(base+'/api/connection',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({baseUrl:'https://vision.example/v1',model:'vision-a',apiKey:'TEST_PRIVATE_KEY'})});
  assert.equal(save.status,200);assert.ok(!(await save.text()).includes('TEST_PRIVATE_KEY'));
  const settings=await (await fetch(base+'/api/config')).json();
  assert.equal(settings.ready,true);assert.equal(settings.connection.baseUrl,'https://vision.example/v1');assert.equal(settings.connection.hasKey,true);
  assert.ok(!JSON.stringify(settings).includes('TEST_PRIVATE_KEY'));
  assert.equal((await stat(configFile)).mode&0o777,0o600);
  assert.equal(JSON.parse(await readFile(configFile,'utf8')).apiKey,'TEST_PRIVATE_KEY');
  assert.equal((await post(base,request())).status,200);assert.equal(used.apiKey,'TEST_PRIVATE_KEY');assert.equal(used.model,'vision-a');
  const restarted=await listen(handler(),t);
  assert.equal((await (await fetch(restarted+'/api/config')).json()).ready,true);
  const update=body=>fetch(restarted+'/api/connection',{method:'POST',headers:{Origin:restarted,'Content-Type':'application/json'},body:JSON.stringify(body)});
  assert.equal((await update({baseUrl:'https://vision.example/v1/',model:'vision-b',apiKey:''})).status,200);
  assert.equal((await update({baseUrl:'https://other.example/v1',model:'vision-b',apiKey:''})).status,400);
  assert.equal((await fetch(restarted+'/api/connection/clear',{method:'POST',headers:{Origin:restarted,'Content-Type':'application/json'},body:'{}'})).status,200);
  assert.equal((await (await fetch(restarted+'/api/config')).json()).ready,false);
  assert.ok(!(await readFile(configFile,'utf8')).includes('TEST_PRIVATE_KEY'));
  const cleared=await listen(handler(),t);assert.equal((await (await fetch(cleared+'/api/config')).json()).ready,false);
});

test('model-list test uses unsaved connection, never saves or generates, sanitizes errors',async t=>{
  let auth,path;
  const upstream=await listen((req,res)=>{auth=req.headers.authorization;path=req.url;res.setHeader('Content-Type','application/json');res.end(JSON.stringify({data:[{id:'vision-model'},{id:'text-only'},{id:'vision-model'}]}));},t);
  const base=await listen(createApp({config:readConfig({})}),t);
  const draft={baseUrl:upstream+'/v1',apiKey:'TEST_DRAFT_KEY',model:''};
  const send=(value,origin=base)=>fetch(base+'/api/connection/models',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(value)});
  const res=await send(draft);assert.equal(res.status,200);assert.deepEqual((await res.json()).models,['text-only','vision-model']);assert.equal(path,'/v1/models');assert.equal(auth,'Bearer TEST_DRAFT_KEY');
  assert.equal((await (await fetch(base+'/api/config')).json()).ready,false);
  assert.equal((await send(draft,'https://evil.invalid')).status,403);
  for(const patch of [{baseUrl:'http://remote.example/v1'},{baseUrl:'https://host/v1?key=secret'},{apiKey:'bad\nkey'}]) assert.equal((await send({...draft,...patch})).status,400);
  const failing=await listen((_q,r)=>{r.writeHead(401);r.end('TEST_DRAFT_KEY');},t);
  const error=await send({...draft,baseUrl:failing+'/v1'});assert.equal(error.status,502);assert.ok(!(await error.text()).includes('TEST_DRAFT_KEY'));
});

test('serves built entry/assets with safe CSP while refusing source, secrets and traversal',async t=>{
  const base=await listen(createApp({config:readConfig({})}),t);
  const res=await fetch(base+'/');assert.equal(res.status,200);
  const csp=res.headers.get('content-security-policy');
  assert.match(csp,/style-src 'self' 'unsafe-inline'/);assert.match(csp,/script-src 'self';/);
  const html=await res.text();
  const urls=[...html.matchAll(/(?:src|href)="(\/assets\/[^" ]+)"/g)].map(m=>m[1]);
  assert.ok(urls.some(x=>x.endsWith('.js')),'built script is referenced');
  for(const url of urls) {
    const asset=await fetch(base+url);assert.equal(asset.status,200);
    if(url.endsWith('.js'))assert.match(asset.headers.get('content-type'),/javascript/);
    if(url.endsWith('.css'))assert.match(asset.headers.get('content-type'),/text\/css/);
  }
  for(const path of ['/src/main.jsx','/app.js','/package.json','/.local-connection.json','/assets/../.env','/assets/%2e%2e%2f.env','/assets/missing.js','/assets/source.js.map']) assert.equal((await fetch(base+path)).status,404,path);
});

test('current and historical selections return their own label and source date',async t=>{
  const base=await listen(createApp({config:{...readConfig({}),ready:true},generateImpl:async()=>fixture}),t);
  for(const [version,videoModel,label,date] of [
    ['v5','kling-o3','Kling O3','2026-10-25'],['v5','kling-4.0','Kling 4.0','2026-10-25'],
    ['v2','runway-gen4.5','Runway Gen-4.5','2026-10-17'],['v1','wan-3.0','Wan 3.0','2026-10-17']
  ]) {
    const response=await post(base,request({version,videoModel}));assert.equal(response.status,200);
    const {metadata}=await response.json();assert.equal(metadata.videoModel,label);assert.equal(metadata.snapshotDate,date);assert.equal(metadata.onlineVerified,false);
    assert.ok(metadata.sources.length>0);
  }
});
