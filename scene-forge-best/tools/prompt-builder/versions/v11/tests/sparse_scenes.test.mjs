import test from 'node:test';
import assert from 'node:assert/strict';
import {TOPICS,optionGroups,filterGroups,emptyBrief,normalizeBrief,toggleChoice} from '../输出/core.mjs';

// Catches topic-specific filters accidentally hiding generic sparse choices.
test('sparse scenes and negative space remain selectable for every topic including cloud palace',()=>{
 for(const topic of [...Object.keys(TOPICS),'东方幻想世界','自定义题材','']){
  const names=topic?[topic]:[];
  for(const [field,query] of [['想画什么','空旷'],['想画什么','无人空景'],['视觉偏好','留白'],['视觉偏好','低细节']]){
   const hits=filterGroups(optionGroups(field,names),query).flatMap(g=>g[1]);
   assert.ok(hits.length,`${topic||'未指定'} / ${field} / ${query}`);
   const choice=hits[0];
   const brief={...emptyBrief(),'题材':topic,[field]:toggleChoice([],choice,true).join('；')};
   assert.equal(normalizeBrief(brief)[field],choice);
   assert.deepEqual(toggleChoice([choice],choice,false),[]);
  }
 }
});
