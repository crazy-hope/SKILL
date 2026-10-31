import test from 'node:test';
import assert from 'node:assert/strict';
import { toMarkdown } from '../public/result.js';
import { createRevisionGate } from '../public/state.js';
import { fixture } from './helpers.mjs';
const meta={skillVersion:'v1',videoModel:'Seedance 2.5',platform:'尚未确定',duration:7,aspectRatio:'original',snapshotDate:'2026-10-17',onlineVerified:false,sources:[{title:'官方来源',url:'https://example.com/official'}]};
test('exports full prompt, submission, omitted details, settings and honest evidence',()=>{
  const md=toMarkdown(fixture,meta);
  for(const value of [fixture.prompt,fixture.submissionPrompt,fixture.designReason,fixture.omissions[0],'7秒','用户目标','2026-10-17','本次未在线复核','https://example.com/official']) assert.ok(md.includes(value),value);
});
test('empty optional sections do not invent submission or omissions',()=>{
  const md=toMarkdown({...fixture,submissionPrompt:'',omissions:[],clarificationQuestions:[]},meta);
  assert.ok(!md.includes('## 提交版'));assert.ok(!md.includes('## 合并与省略'));assert.ok(!md.includes('undefined'));
});
test('older requests cannot win after edits, cancellation or a newer request',()=>{
  const gate=createRevisionGate(); const first=gate.begin(); assert.ok(gate.current(first));
  gate.touch(); assert.ok(!gate.current(first));
  const second=gate.begin(); const third=gate.begin();
  assert.ok(!gate.current(second));assert.ok(gate.current(third));
  gate.touch();assert.ok(!gate.current(third));
});
