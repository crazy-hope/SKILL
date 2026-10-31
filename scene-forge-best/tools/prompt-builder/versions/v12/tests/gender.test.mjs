import test from 'node:test';
import assert from 'node:assert/strict';
import * as core from '../输出/core.mjs';
import {setElementSetting,clearField} from '../输出/brief.mjs';

const input=()=>({...core.emptyBrief(),'题材':'赛博朋克','元素':'网络黑客；义体医生；霓虹灯管'});
test('gender locks stay attached to separate people through settings, backup and input export',()=>{
 let b=setElementSetting(input(),'网络黑客','gender','女性');
 b=setElementSetting(b,'义体医生','gender','男性');
 b=setElementSetting(b,'网络黑客','action','静立');
 const record={status:'ready',brief:b,schemes:[{zh:'模拟中文',en:'Mock English'}]};
 const saved=core.readBackup(JSON.stringify({format:'scene-forge-backup-v3',draft:b,presets:[{name:'测试',brief:b}],history:[record]}));
 for(const got of [b,saved.draft,saved.presets[0].brief,saved.history[0].brief,core.snapshot(record).brief]){
  assert.equal(got.elementSettings.find(s=>s.name==='网络黑客').gender,'女性');
  assert.equal(got.elementSettings.find(s=>s.name==='义体医生').gender,'男性');
  assert.match(core.briefText(got),/网络黑客：[^\n]*性别=女性/);
 }
 assert.equal(setElementSetting(b,'网络黑客','gender','自动').elementSettings.find(s=>s.name==='网络黑客').gender,'自动');
 assert.equal(core.normalizeBrief({...b,'元素':'义体医生'}).elementSettings.length,1);
 assert.deepEqual(clearField(b,'元素').elementSettings,[]);
});
test('missing gender in existing V12 records stays missing and custom gender remains bounded',()=>{
 const old=setElementSetting(input(),'网络黑客','role','主体');
 assert.equal(Object.hasOwn(old.elementSettings[0],'gender'),false);
 const record=core.snapshot({status:'ready',brief:old,schemes:[{zh:'中文',en:'English'}]});
 assert.equal(Object.hasOwn(record.brief.elementSettings[0],'gender'),false);
 assert.doesNotMatch(core.briefText(old),/性别=/);
 assert.equal(setElementSetting(old,'网络黑客','gender','一男一女').elementSettings[0].gender,'一男一女');
 for(const gender of [null,123,[], 'x'.repeat(81)])assert.throws(()=>core.normalizeBrief({...old,elementSettings:[{...old.elementSettings[0],gender}]}));
});
test('gender controls are available for identities and custom people but not known objects',()=>{
 assert.equal(typeof core.supportsCharacterGender,'function');
 for(const name of ['网络黑客','义体医生','仿生人','仙女','人物','人群','自定义人物甲'])assert.equal(core.supportsCharacterGender(name),true,name);
 for(const name of ['霓虹灯管','改装摩托','白鹿','披帛'])assert.equal(core.supportsCharacterGender(name),false,name);
});
