import test from 'node:test';
import assert from 'node:assert/strict';
import { generate } from '../lib/generate.mjs';
import { validateInput } from '../lib/input.mjs';
import { loadSkillContext } from '../lib/catalog.mjs';
import { request, fixture, completion } from './helpers.mjs';
const input=validateInput(request());
const context=await loadSkillContext(input);
const config={ready:true,endpoint:'https://example.com/v1/chat/completions',apiKey:'NEVER-RETURN-THIS-SECRET',model:'fixture-vision',timeoutMs:100};
const response=(data)=>new Response(JSON.stringify(data),{headers:{'Content-Type':'application/json'}});
test('sends real image and chosen Skill; preserves duration/level; strips model-invented metadata', async()=>{
  let sent;
  const result=await generate(input,context,config,{fetchImpl:async(url,options)=>{
    assert.equal(url,config.endpoint); assert.equal(options.redirect,'error');
    assert.equal(options.headers.Authorization,'Bearer NEVER-RETURN-THIS-SECRET');
    sent=JSON.parse(options.body); return response(completion({...fixture, sources:[{url:'https://evil.invalid'}],snapshotDate:'today'}));
  }});
  assert.equal(sent.model,'fixture-vision'); assert.equal(sent.stream,false);
  assert.ok(!('temperature' in sent)); assert.ok(!('response_format' in sent));
  assert.match(sent.messages[0].content,/交付契约/);
  assert.match(sent.messages[0].content,/seedance-2.5.md/);
  assert.equal(sent.messages[1].content[1].image_url.url,input.image);
  const user=JSON.parse(sent.messages[1].content[0].text);
  assert.equal(user.duration,7); assert.equal(user.level,'detailed');
  assert.ok(!JSON.stringify(sent.messages).includes(config.apiKey));
  assert.equal(result.sources,undefined); assert.equal(result.snapshotDate,undefined);
  assert.equal(result.prompt,fixture.prompt);
});
for (const status of [401,403,429,500]) test(`sanitizes upstream ${status}`,async()=>{
  await assert.rejects(generate(input,context,config,{fetchImpl:async()=>new Response(config.apiKey,{status})}),e=>e.name==='AppError'&&!e.message.includes(config.apiKey));
});
for (const [name, data] of Object.entries({malformed:'<script>alert(1)</script>', missing:{level:'detailed'}, wrongLevel:{...fixture,level:'short'}, badSetting:{...fixture,settings:[null]}, huge:{...fixture,prompt:'x'.repeat(60001)}})) {
  test(`rejects invalid result ${name}`,async()=>assert.rejects(generate(input,context,config,{fetchImpl:async()=>response(completion(data))}),{code:'INVALID_RESULT'}));
}
test('rejects upstream truncation even if content is valid JSON',async()=>assert.rejects(generate(input,context,config,{fetchImpl:async()=>response(completion(fixture,'length'))}),{code:'TRUNCATED_RESULT'}));
test('accepts one JSON code fence and clarification instead of fake success',async()=>{
  const result=await generate(input,context,config,{fetchImpl:async()=>response(completion('```json\n'+JSON.stringify({...fixture,status:'needs_clarification',prompt:'',clarificationQuestions:['全身还是面部特写优先？']})+'\n```'))});
  assert.equal(result.status,'needs_clarification'); assert.equal(result.prompt,'');
});
test('time budget covers fetch and aborts slow request',async()=>{
  await assert.rejects(generate(input,context,{...config,timeoutMs:15},{fetchImpl:async(_url,{signal})=>new Promise((_,reject)=>signal.addEventListener('abort',()=>reject(signal.reason),{once:true}))}),{code:'UPSTREAM_TIMEOUT'});
});
test('network failures and non-JSON envelopes are safe',async()=>{
  await assert.rejects(generate(input,context,config,{fetchImpl:async()=>{throw new Error(config.apiKey)}}),e=>e.code==='UPSTREAM_NETWORK'&&!e.message.includes(config.apiKey));
  await assert.rejects(generate(input,context,config,{fetchImpl:async()=>new Response('not-json')}),{code:'INVALID_RESULT'});
});
test('explicit abort cancels without a retry',async()=>{
  const controller=new AbortController(); controller.abort(); let count=0;
  await assert.rejects(generate(input,context,config,{signal:controller.signal,fetchImpl:async()=>{count++;return response(completion());}}),{code:'CANCELLED'});
  assert.equal(count,0);
});
