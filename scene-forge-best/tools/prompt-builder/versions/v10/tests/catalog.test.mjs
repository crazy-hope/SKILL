import test from 'node:test';
import assert from 'node:assert/strict';
import * as core from '../输出/core.mjs';

test('catalog covers thirty-one topics with useful scenes and classified elements',()=>{
 assert.equal(Object.keys(core.TOPICS).length,31);
 for(const [name,t] of Object.entries(core.TOPICS)){
  assert.ok(t.scene.length>=10&&t.scene.length<=15,name+' scenes');
  // Topic depth need not fit the former uniform 50-item ceiling.
  assert.ok(t.elements.length>=30,name+' elements');
  assert.equal(new Set(t.elements).size,t.elements.length,name+' duplicates');
  assert.ok(Object.keys(t.categories).length>=6,name+' categories');
 }
 assert.equal(new Set(Object.values(core.TOPICS).map(t=>t.group)).size,6);
});
test('legacy topics and options remain available without rewriting stored input',()=>{
 assert.equal(typeof core.resolveTopic,'function');
 for(const old of ['自然写实','古代生活','太空科幻'])assert.ok(core.resolveTopic(old));
 assert.ok(core.resolveTopic('东方天界幻想').elements.includes('宋代建筑'));
 assert.ok(core.resolveTopic('赛博朋克').elements.includes('全息导览'));
 assert.equal(core.normalizeBrief({'题材':'太空科幻'})['题材'],'太空科幻');
});
test('scene recommendations rank traffic and portrait categories without dropping other elements',()=>{
 assert.equal(typeof core.catalogGroups,'function');
 const station=core.catalogGroups('必须包含',['赛博朋克'],'高架车站，列车正在进站');
 const portrait=core.catalogGroups('必须包含',['赛博朋克'],'人物肖像');
 assert.equal(station[0][0],'道路与交通设施');
 assert.equal(portrait[0][0],'人物与身份');
 assert.deepEqual(new Set(station.flatMap(g=>g[1])),new Set(portrait.flatMap(g=>g[1])));
 assert.equal(core.catalogGroups('必须包含',['未知自定义题材'],'').length,0);
});
test('search matches item or category and handles empty results',()=>{
 assert.equal(typeof core.filterGroups,'function');
 const groups=[['道路与交通设施',['悬挂轨道','磁悬浮道岔']],['人物与身份',['义体维修师']]];
 assert.deepEqual(core.filterGroups(groups,'轨道',''),[['道路与交通设施',['悬挂轨道']]]);
 assert.deepEqual(core.filterGroups(groups,'人物',''),[groups[1]]);
 assert.deepEqual(core.filterGroups(groups,'','道路与交通设施'),[groups[0]]);
 assert.deepEqual(core.filterGroups(groups,'不存在',''),[]);
});
test('search understands legacy topic names and item topic membership',()=>{
 const topics=core.filterGroups(core.catalogGroups('题材'),'太空科幻');
 assert.deepEqual(topics,[['科幻未来',['太空探索']]]);
 const groups=core.catalogGroups('必须包含',['赛博朋克','龙宫水府'],'');
 const found=core.filterGroups(groups,'赛博朋克').flatMap(g=>g[1]);
 assert.ok(found.includes('全息导览'));assert.equal(found.includes('贝舟'),false);
});
