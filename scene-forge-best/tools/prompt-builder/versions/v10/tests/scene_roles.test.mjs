import test from 'node:test';
import assert from 'node:assert/strict';
import * as core from '../输出/core.mjs';
import {TOPICS as OLD} from '../../v6/输出/catalog.mjs';
test('core scenes express a subject action or setting relationship',()=>{
 const scenes=core.TOPICS['赛博朋克'].scene;
 assert.ok(scenes.includes('街头机械师正在维修摩托'));
 assert.ok(scenes.includes('摩托骑手穿越高架街区'));
 assert.equal(scenes.includes('街头机械师'),false);
 assert.ok(core.TOPICS['太空探索'].scene.includes('外星考察队穿越岩原'));
 assert.ok(core.TOPICS['赛博朋克'].categories['人物与身份'].includes('义体维修师'));
});
test('legacy scene names find new candidates without duplicating old options',()=>{
 const groups=core.catalogGroups('想画什么',['赛博朋克']);
 assert.ok(groups[0][0].includes('核心画面'));
 const found=core.filterGroups(groups,'城市摩托骑手').flatMap(g=>g[1]);
 assert.deepEqual(found,['摩托骑手穿越高架街区']);
});
test('every original scene remains searchable and original elements resolve to current names',()=>{
 assert.equal(typeof core.resolveScene,'function');
 for(const [name,t] of Object.entries(OLD)){
  if(name!=='东方天界幻想')assert.deepEqual(core.TOPICS[name].elements,[...new Set(t.elements.map(core.resolveElement))]);
  for(const scene of t.scene){
   assert.ok(core.TOPICS[name].scene.includes(core.resolveScene(scene)),scene);
   assert.ok(core.filterGroups(core.catalogGroups('想画什么',[name]),scene).flatMap(g=>g[1]).includes(core.resolveScene(scene)),scene);
  }
 }
});
test('old values survive restore but can be deselected through renamed scene',()=>{
 assert.equal(typeof core.toggleSceneChoice,'function');
 const old=['街头机械师','仙女眺望'];
 assert.equal(core.normalizeBrief({'想画什么':'街头机械师'})['想画什么'],'街头机械师');
 assert.deepEqual(core.toggleSceneChoice(old,'街头机械师正在维修摩托',false),['仙女眺望']);
 assert.deepEqual(core.toggleSceneChoice(old,'街头机械师正在维修摩托',true),['仙女眺望','街头机械师正在维修摩托']);
 assert.deepEqual(old,['街头机械师','仙女眺望']);
 assert.equal(core.resolveScene('constructor'),'constructor');
});
