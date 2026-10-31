import {actualDesign,selectedBrief} from './actual-design-fixture.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyBrief} from '../输出/brief.mjs';
import {loadWorkspace,saveWorkspace,saveConnection,backupPayload,STORAGE,CONNECTION_STORAGE} from '../输出/src/workspace.mjs';
import {resultMarkdown} from '../输出/src/export.mjs';
const storage=()=>{const values=new Map();return {getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v),values};};
const record=()=>({id:'old',createdAt:'2026-10-22T00:00:00Z',status:'ready',brief:selectedBrief({...emptyBrief(),题材:'旧题材',负面提示词:''}),schemes:[{design:actualDesign(),name:'旧方案',zh:'完整中文',en:'Complete English'}],spec:{version:'v9',sha256:'old-sha'},provider:'openai',model:'old-model'});
test('V16 reads its schema5 store without filling historical missing region or changing provenance',()=>{
 const s=storage(),item=record();delete item.brief.地域;
 s.setItem(STORAGE,JSON.stringify({format:'scene-forge-backup-v5',draft:item.brief,presets:[{id:'p',name:'原预设',brief:item.brief}],history:[item],provider:'deepseek',profiles:{deepseek:{model:'custom'}}}));
 const got=loadWorkspace(s);assert.equal(STORAGE,'scene-forge-workspace-v16');assert.equal(got.error,'');assert.equal(got.data.draft.负面提示词,'');assert.equal(got.data.history[0].spec.version,'v9');assert.equal(Object.hasOwn(got.data.history[0].brief,'地域'),false);assert.equal(got.data.profiles.deepseek.model,'custom');
});
test('invalid store is surfaced and not overwritten during load',()=>{
 const s=storage();s.setItem(STORAGE,'broken');const got=loadWorkspace(s);assert.ok(got.error);assert.equal(s.getItem(STORAGE),'broken');
});
test('invalid history does not reset current-schema DeepSeek connection or alter protected data',()=>{
 const s=storage(),r=record();delete r.schemes[0].design;
 const raw=JSON.stringify({format:'scene-forge-backup-v5',draft:r.brief,presets:[],history:[r],provider:'deepseek',profiles:{deepseek:{model:'selected-deepseek-model'}}});
 s.setItem(STORAGE,raw);
 const got=loadWorkspace(s);
 assert.ok(got.error);assert.equal(got.data.provider,'deepseek');
 assert.equal(got.data.profiles.deepseek.model,'selected-deepseek-model');
 assert.deepEqual(got.data.history,[]);assert.equal(s.getItem(STORAGE),raw);
});
test('connection saves only provider/model, supersedes workspace settings and works without creative storage',()=>{
 const s=storage();
 saveConnection(s,{provider:'deepseek',key:'secret',profiles:{openai:{model:'openai-choice'},deepseek:{model:'deepseek-choice',key:'secret'}}});
 assert.doesNotMatch(s.getItem(CONNECTION_STORAGE),/secret/);
 assert.equal(s.getItem(STORAGE),null);
 assert.equal(loadWorkspace(s).data.provider,'deepseek');
 const data=loadWorkspace(storage()).data;saveWorkspace(s,data);
 const got=loadWorkspace(s);
 assert.equal(got.data.provider,'deepseek');assert.equal(got.data.profiles.deepseek.model,'deepseek-choice');
 assert.equal(got.data.profiles.openai.model,'openai-choice');
 assert.doesNotMatch(JSON.stringify(backupPayload(got.data)),/deepseek-choice|openai-choice/);
});
test('malformed connection is reported independently and storage failure is observable',()=>{
 const s=storage(),data=loadWorkspace(s).data;data.draft.题材='赛博朋克';saveWorkspace(s,data);
 s.setItem(CONNECTION_STORAGE,'broken-connection');
 const got=loadWorkspace(s);assert.ok(got.connectionError);assert.equal(got.error,'');assert.equal(got.data.draft.题材,'赛博朋克');
 assert.equal(s.getItem(CONNECTION_STORAGE),'broken-connection');
 assert.throws(()=>saveConnection({setItem(){throw Error('quota');}},data),/quota/);
});
test('backup and persisted state whitelist data and exclude credentials at every level',()=>{
 const s=storage(),data=loadWorkspace(s).data;data.keys={openai:'secret'};data.draft.key='secret';data.profiles.openai={model:'m',key:'secret'};data.history=[{...record(),key:'secret'}];
 saveWorkspace(s,data);assert.doesNotMatch(s.getItem(STORAGE),/secret/);assert.doesNotMatch(JSON.stringify(backupPayload(data)),/secret/);assert.equal(Object.hasOwn(backupPayload(data),'profiles'),false);assert.equal(Object.hasOwn(backupPayload(data),'provider'),false);assert.equal(JSON.parse(s.getItem(STORAGE)).profiles.openai.model,'m');
});
test('storage failure is thrown for UI to report, never swallowed',()=>{assert.throws(()=>saveWorkspace({setItem(){throw Error('quota');}},loadWorkspace(storage()).data),/quota/);});
test('download uses saved input and adaptive fences, retains both languages and provenance',()=>{
 const r=record();r.brief.大致说明='```\n注释';const md=resultMarkdown(r);assert.match(md,/题材：旧题材/);assert.match(md,/````text/);assert.match(md,/完整中文/);assert.match(md,/Complete English/);assert.match(md,/v9 \/ SHA-256 old-sha/);
});

test('actual design survives history, backup and downloads without contaminating inputs',()=>{
 const r=record(),s=storage(),data=loadWorkspace(s).data;
 r.brief.元素='';r.schemes[0].design={题材:'东方奇幻世界',地域:'不限定地域',元素:'悬浮折光石环、镜面水池',视觉偏好:'清晨冷灰',镜头:'俯视远景',风格与复杂度:'写实疏朗',构图:'环形视觉中心',key:'secret'};
 data.history=[r];saveWorkspace(s,data);
 const restored=loadWorkspace(s).data,scheme=restored.history[0].schemes[0];
 assert.equal(scheme.design?.元素,'悬浮折光石环、镜面水池');assert.equal(scheme.design?.key,undefined);
 assert.equal(restored.history[0].brief.元素,'');
 assert.deepEqual(backupPayload(restored).history[0].schemes[0].design,scheme.design);
 assert.match(resultMarkdown(restored.history[0]),/本方案实际设计[\s\S]*悬浮折光石环/);
 assert.doesNotMatch(s.getItem(STORAGE),/secret/);
});

test('missing or incomplete actual design is rejected without migrating or overwriting the store',()=>{
 for(const design of [undefined,{}, {元素:'石环'}, {...actualDesign(),镜头:'自动设计'}, {...actualDesign(),元素:'x'.repeat(3001)}]){
  const r=record();r.schemes[0].design=design;
  const raw=JSON.stringify({format:'scene-forge-backup-v5',draft:r.brief,presets:[],history:[r]});
  const s=storage();s.setItem(STORAGE,raw);
  assert.ok(loadWorkspace(s).error);assert.equal(s.getItem(STORAGE),raw);
  assert.throws(()=>backupPayload({draft:r.brief,presets:[],history:[r]}),/实际设计/);
  assert.throws(()=>resultMarkdown(r),/实际设计/);
 }
});


test('V17 review notes survive save/backup/download while old results gain no review',()=>{
 const s=storage(),data=loadWorkspace(s).data,old=record(),fresh=record();
 old.spec.version='v14';old.schemes[0].checks='原待出图检查';
 fresh.id='new';fresh.spec.version='v15';fresh.schemes[0].checks='文本审校记录（模型判断，非出图验证）：材料与颜色有依据。';
 data.history=[fresh,old];saveWorkspace(s,data);
 const restored=loadWorkspace(s).data;
 assert.equal(restored.history[0].schemes[0].checks,fresh.schemes[0].checks);
 assert.equal(backupPayload(restored).history[0].schemes[0].checks,fresh.schemes[0].checks);
 assert.match(resultMarkdown(restored.history[0]),/材料与颜色有依据/);
 assert.equal(restored.history[1].schemes[0].checks,'原待出图检查');
 assert.equal(restored.history[1].spec.version,'v14');
 assert.doesNotMatch(resultMarkdown(restored.history[1]),/文本审校/);
});
