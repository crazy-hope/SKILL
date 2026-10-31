import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyBrief,normalizeBrief,readBackup,briefText,snapshot} from '../输出/core.mjs';
import {clearField} from '../输出/brief.mjs';

test('region survives normalization, presets, history and exported input independently of topic',()=>{
 for(const region of ['东方','西方','中国','']){
  const b={...emptyBrief(),'题材':'赛博朋克','地域':region};
  const record={status:'ready',brief:b,schemes:[{zh:'模拟中文',en:'Mock English'}]};
  const out=readBackup(JSON.stringify({format:'scene-forge-backup-v3',draft:b,presets:[{name:'地域',brief:b}],history:[record]}));
  for(const got of [normalizeBrief(b),out.draft,out.presets[0].brief,out.history[0].brief,snapshot(record).brief]){
   assert.equal(got['地域'],region);
   assert.equal(got['题材'],'赛博朋克');
   assert.match(briefText(got),new RegExp(`题材：赛博朋克\n地域：${region||'未指定'}`));
  }
 }
});
test('clearing panel 01 clears region with topic without changing other inputs',()=>{
 const b={...emptyBrief(),'题材':'赛博朋克','地域':'中国','元素':'霓虹灯管','负面提示词':''};
 const cleared=clearField(b,'题材');
 assert.equal(cleared['题材'],'');assert.equal(cleared['地域'],'');
 assert.equal(cleared['元素'],'霓虹灯管');assert.equal(cleared['负面提示词'],'');
 assert.equal(clearField(b,'大致说明')['地域'],'中国');
});
test('existing V12 history without region stays absent and is not re-labelled as a selected region',()=>{
 const old=emptyBrief();delete old['地域'];
 const record={status:'ready',brief:old,schemes:[{zh:'旧中文',en:'Old English'}]};
 const out=readBackup(JSON.stringify({format:'scene-forge-backup-v3',draft:old,presets:[],history:[record]}));
 assert.equal(Object.hasOwn(out.history[0].brief,'地域'),false);
 assert.equal(Object.hasOwn(normalizeBrief(old),'地域'),false);
 assert.doesNotMatch(briefText(out.history[0].brief),/地域：/);
});
test('invalid or multi-select region values are rejected rather than silently dropped',()=>{
 for(const value of [null,12,[],{},'东方；西方','日本','中国 '])assert.throws(()=>normalizeBrief({...emptyBrief(),'地域':value}));
});
