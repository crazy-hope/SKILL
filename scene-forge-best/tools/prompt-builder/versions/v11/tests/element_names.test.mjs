import test from 'node:test';
import assert from 'node:assert/strict';
import * as c from '../输出/core.mjs';

const crane='引风青鸾（绕山门舒翼回旋，尾羽顺风展开）';
const dragon='中国龙（无翼长身、鹿角与长须，盘绕天门外侧）';
const otherDragon='行云中国龙（无翼长身穿行层云，龙尾隐入远山）';

test('must-have choices use names across all topics and old labels find the new names',()=>{
 for(const name of ['',...Object.keys(c.TOPICS)]){
  const items=c.optionGroups('必须包含',name?[name]:[]).flatMap(g=>g[1]);
  for(const item of items)assert.doesNotMatch(item,/[（）()，,；;]/,`${name}: ${item}`);
  assert.equal(new Set(c.TOPICS[name]?.elements||[]).size,(c.TOPICS[name]?.elements||[]).length);
 }
 const animals=c.optionGroups('必须包含',['东方天界幻想']).find(g=>g[0]==='生物与伙伴')[1];
 for(const name of ['青鸾','麒麟','白鹿','中国龙','玉兔','玄龟'])assert.ok(animals.includes(name),name);
 assert.ok(!animals.some(x=>/山门|天门|莲台|石径|巡天|引风|衔芝/.test(x)));
 assert.deepEqual(c.filterGroups(c.optionGroups('必须包含',['东方天界幻想']),crane).flatMap(g=>g[1]),['青鸾']);
});

test('draft reuse simplifies only exact built-in labels; saved history and custom constraints stay factual',()=>{
 const custom='自定义青鸾（停在我的船头，必须保留红色羽毛）';
 const brief={...c.emptyBrief(),'题材':'东方天界幻想','必须包含':[crane,dragon,otherDragon,custom].join('；')};
 const original=structuredClone(brief);
 const restored=c.restoreDraft(brief,{});
 assert.equal(restored['必须包含'],`青鸾；中国龙；${custom}`);
 assert.deepEqual(brief,original);
 const record={id:'old',status:'ready',createdAt:'2026-10-18',brief,schemes:[{zh:'旧中文',en:'Old English'}]};
 const backup=c.readBackup(JSON.stringify({format:'scene-forge-backup-v1',draft:brief,presets:[{id:'p',name:'旧预设',brief}],history:[record]}));
 assert.equal(backup.draft['必须包含'],restored['必须包含']);
 assert.equal(backup.history[0].brief['必须包含'],brief['必须包含']);
 assert.equal(backup.presets[0].brief['必须包含'],brief['必须包含']);
 assert.equal(c.restoreDraft(backup.presets[0].brief,{})['必须包含'],restored['必须包含']);
 assert.equal(backup.history[0].schemes[0].zh,'旧中文');
});
