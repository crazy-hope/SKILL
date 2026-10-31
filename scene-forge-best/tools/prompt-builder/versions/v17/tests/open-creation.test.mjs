import test from 'node:test';
import assert from 'node:assert/strict';
import * as brief from '../输出/brief.mjs';
import {readBackup} from '../输出/core.mjs';
import {loadWorkspace,STORAGE} from '../输出/src/workspace.mjs';
const draft=()=>brief.normalizeBrief({...brief.emptyBrief(),元素:'白鹿；道路',大致说明:'安静、辽阔'});
test('open creation defaults and per-element presence',()=>{
 const b=draft();assert.equal(b.schemaVersion,5);assert.equal(brief.emptyBrief().大致说明,'');
 assert.deepEqual(b.designOptions,{exploration:'自动设计'});
 assert.deepEqual(b.elementSettings.map(s=>s.presence),['reference','reference']);
 const locked=brief.setElementSetting(b,'白鹿','presence','required');
 assert.equal(locked.elementSettings[0].presence,'required');
 assert.equal(locked.elementSettings[1].presence,'reference');
 assert.match(brief.describeBrief(locked),/必须出现：白鹿/);
 assert.match(brief.describeBrief(locked),/灵感参考：道路/);
});
test('conditional attributes do not promote references and dependencies are explicit',()=>{
 let b=brief.setElementSetting(draft(),'白鹿','count','2只');
 assert.equal(b.elementSettings[0].presence,'reference');
 b=brief.setElementSetting(b,'白鹿','target','道路');
 b=brief.setElementSetting(b,'白鹿','presence','required');
 assert.deepEqual(brief.requiredDependencies(b),['道路']);
 assert.throws(()=>brief.validateBrief(b),/必须/);
 b=brief.setRequiredElements(b,['白鹿','道路']);assert.doesNotThrow(()=>brief.validateBrief(b));
 b=brief.setElementSetting(b,'道路','target','白鹿');
 assert.deepEqual(brief.requiredDependencies(b),[]);
 assert.doesNotThrow(()=>brief.validateBrief(b));
});
test('malformed new backups cannot silently lose required semantics',()=>{
 const b=draft();
 for(const mutate of [x=>x.elementSettings[0].presence='unknown',x=>delete x.elementSettings[0].presence,x=>x.elementSettings.pop(),x=>x.elementSettings.push(x.elementSettings[0]),x=>x.designOptions.allowExtra=false,x=>x.schemaVersion=3]){
  const bad=structuredClone(b);mutate(bad);
  assert.throws(()=>readBackup(JSON.stringify({format:'scene-forge-backup-v5',draft:bad,presets:[],history:[]})));
 }
 const restored=readBackup(JSON.stringify({format:'scene-forge-backup-v5',draft:b,presets:[{name:'意图',brief:b}],history:[]}));
 assert.deepEqual(restored.draft,b);assert.deepEqual(restored.presets[0].brief,b);
});
test('new workspace does not read or overwrite old creative storage',()=>{
 assert.equal(STORAGE,'scene-forge-workspace-v16');
 const gets=[];const old='old-v3-records';
 const result=loadWorkspace({getItem:k=>{gets.push(k);return k==='scene-forge-workspace-v12'?old:null;}});
 assert.ok(!gets.includes('scene-forge-workspace-v12'));assert.equal(result.data.draft.schemaVersion,5);
});
test('topic guidance describes open intent without old character or size locks',async()=>{
 const {topicGuidance}=await import('../输出/core.mjs');
 for(const topic of ['东方奇幻世界','东方天界幻想','云上天宫','超自然现象']){
  assert.doesNotMatch(topicGuidance([topic]),/未选人物不补人物|只有选中|1%—3%|主体来自已选/);
 }
});
