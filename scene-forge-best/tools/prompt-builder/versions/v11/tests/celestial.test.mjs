import test from 'node:test';
import assert from 'node:assert/strict';
import * as core from '../输出/core.mjs';
import {TOPICS as OLD} from '../../v9/输出/catalog.mjs';

test('celestial characters, megastructures and spatial visuals are scoped to one topic',()=>{
 const t=core.resolveTopic('东方幻想世界');
 assert.equal(t,core.TOPICS['东方天界幻想']);
 assert.deepEqual(t.categories['人物与身份'],['仙女','多个仙女','男性仙人']);
 assert.ok(t.categories['天界巨构'].length>=8);
 for(const word of ['天门','宫阙','长桥','仙山'])assert.ok(t.scene.some(s=>s.includes(word)),word);
 const visuals=core.catalogGroups('视觉偏好',['东方幻想世界']).flatMap(g=>g[1]);
 for(const word of ['人物','远景','云','冷','暖'])assert.ok(visuals.some(s=>s.includes(word)),word);
 assert.equal(core.catalogGroups('必须包含',['东方幻想世界'],'仙女眺望')[0][0],'天界巨构');
 // The 2026-10-19 name-only maintenance applies across topics; other settings stay scoped.
 for(const [name,old] of Object.entries(OLD))if(name!=='东方天界幻想'){
  const categories=Object.fromEntries(Object.entries(old.categories).map(([k,v])=>[k,[...new Set(v.map(core.resolveElement))]]));
  assert.deepEqual(core.TOPICS[name],{...old,categories,elements:[...new Set(old.elements.map(core.resolveElement))]},name);
 }
});
test('single celestial topic shows only three character options and keeps custom drafts intact',()=>{
 assert.equal(typeof core.optionGroups,'function');
 const groups=core.optionGroups('必须包含',['东方天界幻想']);
 assert.deepEqual(groups.find(([name])=>name==='人物与身份')[1],['仙女','多个仙女','男性仙人']);
 assert.equal(groups.some(([name])=>name==='人物与活动'),false);
 assert.equal(core.optionGroups('想画什么',['东方天界']).flatMap(g=>g[1]).includes('人物肖像'),false);
 assert.ok(core.optionGroups('必须包含',['赛博朋克']).some(([name])=>name==='人物与活动'));
 assert.ok(core.optionGroups('必须包含',['东方天界幻想','赛博朋克']).some(([name])=>name==='人物与活动'));
 const brief={...core.emptyBrief(),'题材':'东方幻想世界','想画什么':'仙官守阁','必须包含':'自定义旅人','视觉偏好':'黄昏'};
 assert.deepEqual(core.normalizeBrief(brief),brief);
 const before=structuredClone(brief);core.optionGroups('必须包含',[brief['题材']]);assert.deepEqual(brief,before);
 assert.ok(core.filterGroups(core.catalogGroups('题材'),'东方幻想世界').flatMap(g=>g[1]).includes('东方天界幻想'));
});
