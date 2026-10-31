import test from 'node:test';
import assert from 'node:assert/strict';
import {TOPICS,resolveTopic,optionGroups,filterGroups,topicGuidance,normalizeBrief} from '../输出/core.mjs';

test('cloud palace is independent, searchable and offers sparse spatial scenes and palettes',()=>{
 const t=resolveTopic('云上天宫');
 assert.ok(t);assert.notEqual(t,TOPICS['东方天界幻想']);
 assert.equal(t.group,'东方幻想');assert.equal(t.scene.length,12);
 assert.ok(filterGroups(optionGroups('题材'),'云上天宫').flatMap(g=>g[1]).includes('云上天宫'));
 const groups=optionGroups('必须包含',['云上天宫'],'仙女');
 assert.equal(groups[0][0],'云上巨构');
 for(const query of ['山石','云海','渺小人物','长袍长裙'])assert.ok(filterGroups(groups,query).length,query);
 assert.equal(groups.some(([name])=>name==='人物与活动'),false);
 assert.deepEqual(optionGroups('想画什么',['云上天宫']).find(g=>g[0]==='画面类型')[1],['建筑环境','叙事场景']);
 const visuals=optionGroups('视觉偏好',['云上天宫']).flatMap(g=>g[1]);
 for(const word of ['主色','辅色','留白','远景','低饱和'])assert.ok(visuals.some(s=>s.includes(word)),word);
 assert.ok(topicGuidance(['云上天宫']).includes('星河云脊'));
 assert.equal(topicGuidance(['山海异境']).includes('云上天宫'),false);
});
test('cloud choices are suggestions and mixed topics retain their own options',()=>{
 const brief=normalizeBrief({'题材':'云上天宫','必须包含':'自定义山石','视觉偏好':'红白色','数量':'5条'});
 const before=structuredClone(brief);
 optionGroups('必须包含',[brief['题材']]);optionGroups('视觉偏好',[brief['题材']]);
 assert.deepEqual(brief,before);
 const mixed=optionGroups('必须包含',['云上天宫','赛博朋克']);
 assert.ok(mixed.flatMap(g=>g[1]).includes('全息导览'));
 assert.ok(mixed.some(g=>g[0]==='云上巨构'));
 assert.equal(optionGroups('必须包含',['东方天界幻想']).some(g=>g[0]==='云上巨构'),false);
});
