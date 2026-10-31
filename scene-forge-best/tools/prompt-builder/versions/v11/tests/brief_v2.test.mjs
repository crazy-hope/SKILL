import test from 'node:test';
import assert from 'node:assert/strict';
import * as core from '../输出/core.mjs';
// These test observable round trips and would fail if new attributes were discarded.
const b=()=>({schemaVersion:2,'题材':'云上天宫','元素':'白鹿；仙女','视觉偏好':'时间：日出','镜头':'景别：大远景','风格与复杂度':'表现风格：电影 CG；复杂度：简约','构图':'对角线','目标模型':'Midjourney','画幅':'9:16','数量':'5条','大致说明':'同行','负面提示词':'',elementSettings:[{name:'白鹿',role:'主体',scale:'巨大',frame:'突出',count:'单个'},{name:'仙女',role:'辅助',scale:'常规',frame:'渺小',count:'单个'}],designOptions:{exploration:'自动设计',selectionMode:'全部包含',allowExtra:false},legacy:{}});
test('v2 normalization preserves independent role, scale, frame and empty negative',()=>{
 const out=core.normalizeBrief(b());assert.equal(out.schemaVersion,2);assert.equal(out['数量'],'5条');assert.deepEqual(out.elementSettings,b().elementSettings);assert.equal(out['负面提示词'],'');
});
test('removed element loses its attributes; unknown data cannot enter backup',()=>{
 const input=b();input['元素']='白鹿';input.key='secret';input.elementSettings[0].key='secret';input.elementSettings.push({name:'宫殿',role:'主体'});
 const out=core.normalizeBrief(input);assert.deepEqual(out.elementSettings,[b().elementSettings[0]]);assert.equal(JSON.stringify(out).includes('secret'),false);
});
test('new history and preset preserve full settings without changing old history defaults',()=>{
 const old={'题材':'旧作品','想画什么':'仙女眺望；灵兽栖息','必须包含':'白鹿','视觉偏好':'纪实摄影','画幅':'','目标模型':'','数量':'1条','创作自由度':'服装由你设计','负面提示词':''};
 const result=brief=>({status:'ready',brief,schemes:[{zh:'中文',en:'English'}]});
 const out=core.readBackup(JSON.stringify({format:'scene-forge-backup-v1',draft:b(),presets:[{name:'test',brief:b()}],history:[result(old),result(b())]}));
 assert.deepEqual(out.history[0].brief,old);assert.deepEqual(out.draft,b());assert.deepEqual(out.presets[0].brief,b());assert.deepEqual(out.history[1].brief,b());assert.match(core.briefText(b()),/白鹿.*主体.*巨大/);
});
import {emptyV2,migrateBrief,setElementSetting,GROUPS} from '../输出/brief-v2.mjs';
import {TOPICS,optionGroups,filterGroups} from '../输出/core.mjs';
test('fresh defaults and legacy migration differ without rewriting original',()=>{
 const fresh=emptyV2();assert.equal(fresh['数量'],'5条');assert.equal(fresh['目标模型'],'Midjourney');assert.equal(fresh['画幅'],'9:16');assert.deepEqual(fresh.elementSettings,[]);
 const old={'想画什么':'仙女眺望；灵兽栖息','必须包含':'白鹿','视觉偏好':'油画，深夜','创作自由度':'只补缺项','目标模型':'','画幅':'','数量':'3条','负面提示词':''};const copy=structuredClone(old);const out=migrateBrief(old);
 assert.deepEqual(old,copy);assert.equal(out['元素'],'白鹿');assert.deepEqual(out.legacy,{'场景候选':old['想画什么'],'视觉偏好':old['视觉偏好'],'创作自由度':old['创作自由度']});assert.equal(out['目标模型'],'');assert.equal(out['数量'],'3条');assert.equal(out['负面提示词'],'');
});
test('custom frame height survives edits and deleted object cannot regain stale settings',()=>{
 let out=setElementSetting(b(),'仙女','frame','全身高度约占画面3%');assert.equal(out.elementSettings.find(x=>x.name==='仙女').scale,'常规');
 out=core.normalizeBrief({...out,'元素':'白鹿'});out=core.normalizeBrief({...out,'元素':'白鹿；仙女'});assert.equal(out.elementSettings.some(x=>x.name==='仙女'),false);
 assert.deepEqual(setElementSetting(out,'宫殿','role','主体'),out);
});
test('reference elements searchable and style choices independent from density',()=>{
 const groups=optionGroups('必须包含',['云上天宫']);for(const name of ['星河','星沙云脊','白鹿','仙女','星枝鹿角','竹青斗篷','交领仙袍','拖地长裙','云髻','素玉簪','披帛','丝带'])assert.ok(filterGroups(groups,name).flatMap(g=>g[1]).includes(name),name);
 for(const style of ['卡通','纪实摄影','电影 CG','油画'])assert.ok(GROUPS['风格与复杂度'][0][1].includes(style));assert.deepEqual(GROUPS['风格与复杂度'][1][1],['简约','适中','密集']);
 assert.equal(TOPICS['赛博朋克'].elements.includes('星沙云脊'),false);
});
import * as inputV2 from '../输出/brief-v2.mjs';
import {topicGuidance} from '../输出/core.mjs';
test('clear visual panel also removes migrated visual constraints without changing other legacy input',()=>{
 assert.equal(typeof inputV2.clearV2Field,'function');
 const old=migrateBrief({'题材':'云上天宫','想画什么':'灵兽栖息','视觉偏好':'深夜，油画','创作自由度':'仅补缺项'});const out=inputV2.clearV2Field(old,'视觉偏好');
 assert.equal(out['视觉偏好'],'');assert.equal('视觉偏好' in out.legacy,false);assert.equal(out.legacy['场景候选'],'灵兽栖息');assert.equal(old.legacy['视觉偏好'],'深夜，油画');
});
test('v2 backup is versioned and readable while old reader will not mistake it for v1',()=>{
 const out=core.readBackup(JSON.stringify({format:'scene-forge-backup-v2',draft:b(),presets:[],history:[]}));assert.deepEqual(out.draft,b());
});
test('celestial page guidance does not promise default buildings or people',()=>{
 assert.doesNotMatch(topicGuidance(['东方天界幻想']),/默认：仙境巨构主导/);
});
