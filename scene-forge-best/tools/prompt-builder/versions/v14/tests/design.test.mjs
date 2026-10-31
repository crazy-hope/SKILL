import {actualDesign} from './actual-design-fixture.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyBrief,normalizeBrief,readBackup,briefText,snapshot} from '../输出/core.mjs';
import {setElementSetting,clearField} from '../输出/brief.mjs';
const input=()=>({...emptyBrief(),schemaVersion:3,'题材':'云上天宫','元素':'仙女；白鹿；星沙云脊','大致说明':'',elementSettings:[{name:'仙女',role:'辅助',scale:'常规',frame:'全身高度约占画面3%',count:'单个',action:'缓步',position:'下部',depth:'中景',relation:'沿着',target:'星沙云脊'}],designOptions:{exploration:'自动设计',selectionMode:'全部包含',allowExtra:false}});
test('current defaults and empty description survive restore without legacy fields',()=>{
 const b=emptyBrief();assert.equal(b.schemaVersion,3);assert.equal('legacy' in b,false);assert.match(b['大致说明'],/光线柔和漫射/);
 assert.equal(normalizeBrief(input())['大致说明'],'');
});
test('manual motion and spatial settings survive preview, history and backup',()=>{
 const b=input(),r={status:'ready',brief:b,schemes:[{design:actualDesign(),zh:'中文',en:'English'}]};
 const out=readBackup(JSON.stringify({format:'scene-forge-backup-v3',draft:b,presets:[{name:'参考',brief:b}],history:[r]}));
 for(const got of [out.draft,out.presets[0].brief,out.history[0].brief,snapshot(r).brief])assert.deepEqual(got.elementSettings,b.elementSettings);
 assert.match(briefText(b),/动作=缓步/);assert.match(briefText(b),/关系=沿着/);assert.match(briefText(b),/关系对象=星沙云脊/);
});
test('deleting relationship target clears stale relation but retains actor locks',()=>{
 const out=normalizeBrief({...input(),'元素':'仙女；白鹿'});const s=out.elementSettings[0];
 assert.equal(s.target,'');assert.equal(s.relation,'自动');assert.equal(s.action,'缓步');assert.equal(s.frame,'全身高度约占画面3%');
 const restored=normalizeBrief({...out,'元素':'仙女；白鹿；星沙云脊'});assert.equal(restored.elementSettings[0].target,'');
});
test('manual controls update independently; clearing elements drops all settings',()=>{
 const b=setElementSetting(input(),'仙女','action','静立');assert.equal(b.elementSettings[0].action,'静立');assert.equal(b.elementSettings[0].target,'星沙云脊');
 assert.deepEqual(clearField(b,'元素').elementSettings,[]);
});
test('old formats and old briefs in a new backup are rejected',()=>{
 for(const format of ['scene-forge-backup-v1','scene-forge-backup-v2'])assert.throws(()=>readBackup(JSON.stringify({format,draft:input(),presets:[],history:[]})),/V12|旧|版本/);
 assert.throws(()=>normalizeBrief({...input(),schemaVersion:2}),/V12|旧|版本/);
 assert.throws(()=>readBackup(JSON.stringify({format:'scene-forge-backup-v3',draft:input(),presets:[{name:'old',brief:{schemaVersion:2}}],history:[]})));
});
test('unknown key data is not exported and relations cannot reference self or unselected objects',()=>{
 const b=input();b.key='do-not-leak';b.elementSettings[0].key='do-not-leak';b.elementSettings[0].target='仙女';
 const out=normalizeBrief(b);assert.equal(out.elementSettings[0].target,'');assert.equal(out.elementSettings[0].relation,'自动');assert.ok(!JSON.stringify(out).includes('do-not-leak'));
});
