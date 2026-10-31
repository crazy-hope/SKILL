import test from 'node:test';
import assert from 'node:assert/strict';
import * as core from '../输出/core.mjs';
import {setElementSetting, describeBrief, clearField} from '../输出/brief.mjs';
import {actualDesign} from './actual-design-fixture.mjs';
import {resultMarkdown} from '../输出/src/export.mjs';
const attributes={gender:'女性',count:'2人',age:'青年',hairstyle:'高马尾',clothing:'交领长袍',clothingColor:'青色',clothingMaterial:'丝绸',accessories:'玉佩'};
test('all topics have balanced searchable categories and retain V13 candidates',async()=>{
 const old=await import('../../v13/输出/core.mjs');
 assert.equal(Object.keys(core.TOPICS).length,33);
 for(const [name,t] of Object.entries(core.TOPICS)){
  for(const [category,items] of Object.entries(t.categories)){
   const minimum=name==='超自然现象'||['人物与身份','服装与配饰'].includes(category)?8:5;
   assert.ok(items.length>=minimum,`${name}/${category}: ${items.length} < ${minimum}`);
   assert.equal(new Set(items).size,items.length);
   assert.ok(old.TOPICS[name].categories[category]?.every(v=>items.includes(v))??true);
   for(const item of items) assert.ok(core.filterGroups(core.catalogGroups('必须包含',[name]),item).flatMap(g=>g[1]).includes(item));
  }
  assert.ok(t.categories['人物与身份'].every(core.supportsCharacterGender));
  assert.equal(new Set(t.elements).size,t.elements.length);
 }
});
test('independent character settings survive normalization backup history and export',()=>{
 let b={...core.emptyBrief(),题材:'云上天宫',元素:'仙人；旅人甲；白鹿'};
 for(const [key,value] of Object.entries(attributes))b=setElementSetting(b,'仙人',key,value);
 b=setElementSetting(b,'旅人甲','clothing','皮衣');
 const result=core.snapshot({status:'ready',brief:b,schemes:[{zh:'模拟中文',en:'Mock English',design:actualDesign()}]});
 const backup=core.readBackup(JSON.stringify({format:'scene-forge-backup-v3',draft:b,presets:[{name:'人物',brief:b}],history:[result]}));
 for(const got of [b,backup.draft,backup.presets[0].brief,backup.history[0].brief]){
  const s=got.elementSettings.find(s=>s.name==='仙人');
  for(const [k,v] of Object.entries(attributes))assert.equal(s[k],v,k);
  assert.equal(got.elementSettings.find(s=>s.name==='旅人甲').clothing,'皮衣');
 }
 assert.match(describeBrief(b),/衣服款式=交领长袍/);
 assert.match(resultMarkdown(result),/材质=丝绸/);
 assert.equal(clearField(b,'元素').elementSettings.length,0);
 assert.equal(core.supportsCharacterGender('白鹿'),false);
});
test('new optional attributes remain missing in old records and reject invalid values',()=>{
 const b=setElementSetting({...core.emptyBrief(),元素:'仙人'},'仙人','role','主体');
 for(const key of Object.keys(attributes).filter(k=>!['count','gender'].includes(k))){
  assert.equal(Object.hasOwn(core.normalizeBrief(b).elementSettings[0],key),false);
  for(const v of [null,123,[],{},'x'.repeat(81)])assert.throws(()=>core.normalizeBrief({...b,elementSettings:[{...b.elementSettings[0],[key]:v}]}),key);
 }
});
