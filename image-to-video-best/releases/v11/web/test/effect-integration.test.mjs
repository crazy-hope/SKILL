import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {loadSkillContext,CURRENT_VERSION} from '../lib/catalog.mjs';
import {generate} from '../lib/generate.mjs';
import {validateInput} from '../lib/input.mjs';
import {request,fixture,completion} from './helpers.mjs';
const config={ready:true,endpoint:'https://example.invalid/v1/chat/completions',apiKey:'dummy',model:'mock',timeoutMs:1000};
test('current v6 loads full effect guide, historical v5 remains available without it',async()=>{
 assert.equal(CURRENT_VERSION,'v6');
 const guide=await readFile(new URL('../../v6/image-to-video-best/references/effect-direction.md',import.meta.url),'utf8');
 for(const videoModel of ['seedance-2.0','seedance-2.5','kling-o3','kling-4.0']){const c=await loadSkillContext({version:'v6',videoModel});assert.ok(c.text.includes(guide));assert.equal(c.files.filter(x=>x.includes('/models/')).length,1);const old=await loadSkillContext({version:'v5',videoModel});assert.ok(!old.files.includes('references/effect-direction.md'));}
});
test('one provider call returns inspectable effect evidence with untouched intent and guide',async()=>{
 const input=validateInput(request({idea:'近远景长叶全程大幅摇摆，镜头慢退。',details:{ending:'环境不停'},level:'medium'}));const context=await loadSkillContext(input);let calls=0;
 const prompt='近远景长叶全程大幅摇摆，镜头慢退。';const checks=[{requirement:'植物全程大幅运动',source:'user',sourceText:'近远景长叶全程大幅摇摆',promptText:'近远景长叶全程大幅摇摆',submissionText:'',status:'self_checked',note:'模型自检'}];
 const result=await generate(input,context,config,{fetchImpl:async(_url,options)=>{calls++;const body=JSON.parse(options.body);assert.match(body.messages[0].content,/effectChecks/);assert.match(body.messages[0].content,/运动强度/);assert.equal(JSON.parse(body.messages[1].content[0].text).idea,input.idea);return new Response(JSON.stringify(completion({...fixture,level:'medium',prompt,submissionPrompt:'',effectChecks:checks})));}});
 assert.equal(calls,1);assert.equal(result.effectChecks[0].status,'self_checked');assert.deepEqual(result.reviewWarnings,[]);
});
test('missing effect review warns without throwing away result or secretly retrying',async()=>{
 const input=validateInput(request());let calls=0;const result=await generate(input,await loadSkillContext(input),config,{fetchImpl:async()=>{calls++;return new Response(JSON.stringify(completion(fixture)));}});assert.equal(calls,1);assert.equal(result.prompt,fixture.prompt);assert.ok(result.reviewWarnings.length);assert.deepEqual(result.effectChecks,[]);
});
