import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,writeFile,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {ConnectionStore,listModels} from '../lib/connection.mjs';
import {readConfig} from '../lib/config.mjs';
const draft={baseUrl:'https://vision.example/v1',model:'vision',apiKey:'TEST_ONLY_KEY'};
const environment=()=>readConfig({LLM_BASE_URL:draft.baseUrl,LLM_MODEL:draft.model,LLM_API_KEY:draft.apiKey});
async function folder(t){const dir=await mkdtemp(join(tmpdir(),'i2v-store-'));t.after(()=>rm(dir,{recursive:true,force:true}));return dir;}
test('clearing before setup can be reloaded without breaking startup',async t=>{
  const file=join(await folder(t),'connection.json');
  new ConnectionStore(readConfig({}),file).clear();
  const restarted=new ConnectionStore(readConfig({}),file);
  assert.equal(restarted.current.ready,false);assert.equal(restarted.current.apiKey,'');
});
test('clearing an environment key remains cleared after restart',async t=>{
  const file=join(await folder(t),'connection.json');
  new ConnectionStore(environment(),file).clear();
  const restarted=new ConnectionStore(environment(),file);
  assert.equal(restarted.current.apiKey,'');assert.equal(restarted.current.ready,false);
  assert.throws(()=>restarted.save({...draft,apiKey:''}),{code:'CONNECTION_INVALID'});
});
test('failed disk write keeps previous active config and never returns a secret',async t=>{
  const store=new ConnectionStore(environment(),join(await folder(t),'missing','connection.json'));
  assert.throws(()=>store.save({...draft,model:'new'}),{code:'CONFIG_WRITE'});
  assert.equal(store.current.model,'vision');
});
test('malformed config is not silently discarded or echoed',async t=>{
  const file=join(await folder(t),'connection.json');await writeFile(file,'{"apiKey":"PRIVATE_MALFORMED"');
  assert.throws(()=>new ConnectionStore(readConfig({}),file),e=>e.code==='CONFIG_READ'&&!e.message.includes('PRIVATE_MALFORMED'));
});
test('invalid save keeps persisted and active config unchanged',async t=>{
  const file=join(await folder(t),'connection.json');const store=new ConnectionStore(readConfig({}),file);store.save(draft);
  const before=await readFile(file,'utf8');
  for(const input of [null,[],{...draft,baseUrl:''},{...draft,model:''},{...draft,apiKey:'x\ny'},{...draft,baseUrl:'https://host/v1/chat/completions'}])assert.throws(()=>store.save(input),{code:'CONNECTION_INVALID'});
  assert.equal(await readFile(file,'utf8'),before);assert.equal(store.current.model,'vision');
});
test('model lists reject malformed, oversized, redirected and aborting upstreams safely',async()=>{
  for(const body of ['not json',JSON.stringify({data:{}}),'a'.repeat(1024*1024+1)]){
    await assert.rejects(()=>listModels(environment(),{fetchImpl:async()=>new Response(body)}),{code:'MODEL_LIST_ERROR'});
  }
  await assert.rejects(()=>listModels(environment(),{fetchImpl:async(_url,options)=>{
    assert.equal(options.redirect,'error');throw new Error('PRIVATE_UPSTREAM_ERROR');
  }}),e=>e.code==='MODEL_LIST_ERROR'&&!e.message.includes('PRIVATE_UPSTREAM_ERROR'));
  const controller=new AbortController();controller.abort();
  await assert.rejects(()=>listModels(environment(),{signal:controller.signal,fetchImpl:async(_url,options)=>{options.signal.throwIfAborted();}}),{code:'MODEL_LIST_ERROR'});
});
