import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyBrief,normalizeBrief,validateBrief,describeBrief} from '../输出/brief.mjs';
import {backupPayload,emptyWorkspace,loadWorkspace,saveWorkspace,STORAGE} from '../输出/src/workspace.mjs';
import {readBackup} from '../输出/core.mjs';
const idea={title:'叶下',summary:'水面与叶片之间形成庇护空间',relationship:'叶片遮挡雨线',variation:'叶下向外观察'};
test('scene intent and selected idea survive normalize save refresh backup and text export',()=>{
 const b=emptyBrief();assert.equal(b.schemaVersion,5);assert.equal(b.scene.selected,null);
 Object.assign(b.scene,{core:'荷塘',backdrop:'远处古镇',keep:'无人',change:'水面视点',selected:idea});b.负面提示词='';
 assert.deepEqual(normalizeBrief(b),b);assert.equal(validateBrief(b).scene.core,'荷塘');
 const ws={...emptyWorkspace(),draft:b,presets:[{id:'p',name:'我的荷塘',brief:b}]};
 const memory=new Map([['scene-forge-workspace-v15','old untouched']]);const storage={getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v)};
 saveWorkspace(storage,ws);assert.deepEqual(loadWorkspace(storage).data.draft,b);assert.equal(memory.get('scene-forge-workspace-v15'),'old untouched');assert.equal(STORAGE,'scene-forge-workspace-v16');
 const copy=readBackup(JSON.stringify(backupPayload(ws)));assert.deepEqual(copy.presets[0].brief.scene,b.scene);assert.equal(copy.draft.负面提示词,'');
 const text=describeBrief(b);for(const term of ['荷塘','远处古镇','无人','叶片遮挡雨线','叶下向外观察'])assert.ok(text.includes(term));
});
test('malformed scenes and old backups are rejected rather than repaired',()=>{
 for(const change of [b=>delete b.scene,b=>b.scene=[],b=>b.scene.core=12,b=>b.scene.core='x'.repeat(1001),b=>b.scene.selected={},b=>b.scene.selected={...idea,summary:' '},b=>b.scene.selected={...idea,key:'secret'},b=>b.scene.extra='x',b=>b.schemaVersion=4]){
  const b=emptyBrief();change(b);assert.throws(()=>validateBrief(b));assert.throws(()=>normalizeBrief(b));
 }
 assert.throws(()=>readBackup(JSON.stringify({format:'scene-forge-backup-v4',draft:emptyBrief(),presets:[],history:[]})));
});
test('ready history must retain a selected concept; empty draft remains valid',async()=>{
 const {snapshot}=await import('../输出/core.mjs');const {actualDesign}=await import('./actual-design-fixture.mjs');
 const b=emptyBrief();const record={status:'ready',brief:b,schemes:[{name:'测试',zh:'中文',en:'English',design:actualDesign()}]};
 assert.throws(()=>snapshot(record),/构思/);
 assert.throws(()=>readBackup(JSON.stringify({format:'scene-forge-backup-v5',draft:b,presets:[],history:[record]})),/构思/);
 b.scene.selected=idea;assert.deepEqual(snapshot(record).brief.scene.selected,idea);
 assert.doesNotThrow(()=>validateBrief(emptyBrief()));
});
