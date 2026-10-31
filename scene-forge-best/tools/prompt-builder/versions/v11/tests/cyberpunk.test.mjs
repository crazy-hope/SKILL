import test from 'node:test';
import assert from 'node:assert/strict';
import {TOPICS,catalogGroups,filterGroups,emptyBrief,normalizeBrief,resolveScene,resolveElement} from '../输出/core.mjs';
import {TOPICS as OLD} from '../../v5/输出/catalog.mjs';

test('cyberpunk neon, advertising and holograms are selectable and searchable',()=>{
 const groups=catalogGroups('必须包含',['赛博朋克']);
 for(const query of ['霓虹灯','霓虹招牌','广告牌','全息影像','全息鱼灯','鱼形实体灯笼']){
  assert.ok(filterGroups(groups,query).flatMap(g=>g[1]).length>0,query);
 }
 const fish=filterGroups(groups,'全息鱼灯').flatMap(g=>g[1]);
 assert.ok(fish.includes('全息鱼灯'));
 assert.ok(filterGroups(groups,'全息鱼灯（悬浮游动的鱼形投影）').flatMap(g=>g[1]).includes('全息鱼灯'));
});
test('scene priorities change without losing available elements',()=>{
 const cases=[['','照明与光效'],['全息鱼灯巡游','全息影像与装置'],['雨后夜市','信息与标识'],['街头机械师维修','工具与器物'],['高架车站，列车正在进站','道路与交通设施'],['人物肖像','人物与身份']];
 for(const [scene,first] of cases){
  const groups=catalogGroups('必须包含',['赛博朋克'],scene);
  assert.equal(groups[0][0],first,scene);
  assert.deepEqual(new Set(groups.flatMap(g=>g[1])),new Set(TOPICS['赛博朋克'].elements));
 }
});
test('topic-linked visuals cover several palettes and stay out of other topics',()=>{
 const groups=catalogGroups('视觉偏好',['赛博朋克']);
 for(const word of ['品红','锈褐','钢灰','酸性绿','清晨','霓虹','反射'])assert.ok(groups.flatMap(g=>g[1]).some(s=>s.includes(word)),word);
 const celestial=catalogGroups('视觉偏好',['东方天界幻想']);
 assert.ok(celestial.length>0);assert.ok(celestial.every(([label])=>!label.includes('赛博朋克')));
 assert.deepEqual(catalogGroups('视觉偏好',['未知题材']),[]);
 assert.deepEqual(catalogGroups('视觉偏好',['赛博朋克','东方天界幻想','赛博朋克']),[...groups,...celestial]);
 assert.ok(catalogGroups('视觉偏好',['赛博朋克'],'清晨街区')[0][1][0].includes('清晨'));
 assert.ok(catalogGroups('视觉偏好',['赛博朋克'],'工业维修厂')[0][1][0].includes('工业'));
});
test('recommendations do not select values or erase previous choices',()=>{
 const draft=emptyBrief();draft['题材']='赛博朋克';draft['必须包含']='屋顶植被；全息鱼灯（悬浮游动的鱼形投影）';draft['视觉偏好']='柔和暖色';
 const before=structuredClone(draft);
 catalogGroups('必须包含',['赛博朋克'],'鱼灯巡游');catalogGroups('视觉偏好',['东方天界幻想']);
 assert.deepEqual(draft,before);
 const restored=normalizeBrief({...draft,'题材':'东方天界幻想'});
 assert.equal(restored['必须包含'],before['必须包含']);assert.equal(restored['视觉偏好'],'柔和暖色');
});
test('legacy choices resolve to current names and other topic settings are untouched',()=>{
 for(const [name,t] of Object.entries(OLD)){
  for(const s of t.scene)assert.ok(TOPICS[name].scene.includes(resolveScene(s)),name+' '+s);
  for(const item of t.elements){
   // Celestial identities were replaced and gauze was clarified as an outer layer on 2026-10-18.
   if(name==='东方天界幻想'&&(t.categories['人物与身份'].includes(item)||item==='层叠纱衣'))continue;
   assert.ok(TOPICS[name].elements.includes(resolveElement(item)),name+' '+item);
  }
  if(!['赛博朋克','东方天界幻想'].includes(name)){
   const {scene,...rest}=TOPICS[name];const {scene:oldScene,...oldRest}=t;
   const categories=Object.fromEntries(Object.entries(t.categories).map(([k,v])=>[k,[...new Set(v.map(resolveElement))]]));
   assert.deepEqual(rest,{...oldRest,categories,elements:[...new Set(t.elements.map(resolveElement))]});
  }
 }
});
