import test from 'node:test';
import assert from 'node:assert/strict';
import {freshBrief,validateBrief,validateResult,loadWorkspace,saveWorkspace,backup,parseBackup,STORAGE,markdown} from '../输出/model.mjs';
const store=()=>{const m=new Map();return {getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k),m};};
const result=()=>({status:'ready',id:'r',createdAt:'2026-10-30T00:00:00Z',brief:{...freshBrief(),subject:'一只青蛙'},schemes:[{title:'水畔',zh:'完整中文画面',en:'Complete scene.'}],spec:{version:'v16',sha256:'a'.repeat(64)},target:{id:'midjourney',label:'Midjourney',requested:'Midjourney',scope:'家族规则',checkedAt:'2026-10-22',sources:[]},provider:'openai',model:'mock'});
test('exact visible defaults are real values with one pair and no old aspect override',()=>{
 const b=freshBrief();assert.equal(b.style,'16:9横向电影画幅，真人电影实拍级写实，具有90年代东方仙侠和古典神话电影的柔和光学质感，真实人物、真实植物材质、真实雨水，不是现代仙侠滤镜，不是广告摆拍。');
 assert.equal(b.color,'整体色彩以玉绿、冷青、乳白、淡粉为主，雨天环境光偏冷，花瓣透过日光提供暖白柔和的透射光，在人物皮肤和湿润衣料上形成细腻高光。');
 assert.equal(b.camera,'摄影机采用低机位35mm中大全景。');assert.equal(b.mood,'画面情绪轻松、亲密、生活化。');
 assert.equal(b.moment,'重点表现一个暂时停顿却仍有目标的瞬间:雨挡住了她们继续追赶，但也让长纱因为吸水变重，不再继续飘远。');
 assert.equal(b.subject,'');assert.equal(b.count,1);assert.equal(b.target,'Midjourney');assert.equal(b.aspect,undefined);assert.equal(b.scene,undefined);
});
test('edited and cleared paragraphs survive reload without default filling',()=>{const s=store(),b=freshBrief();b.style='水彩';b.color='';b.negative='';saveWorkspace(s,{draft:b,history:[]});assert.deepEqual(loadWorkspace(s).data.draft,b);});
test('missing fields, old schemas and illegal counts fail closed',()=>{const b=freshBrief();for(const bad of [{...b,schemaVersion:5},{...b,count:true},{...b,count:11},{...b,subject:[]},{...b,key:'secret'}])assert.throws(()=>validateBrief(bad));delete b.camera;assert.throws(()=>validateBrief(b));});
test('old stores are ignored; corrupt current data is untouched and blocks saving',()=>{const s=store();s.setItem('scene-forge-workspace-v16','old');assert.equal(loadWorkspace(s).data.history.length,0);assert.equal(s.getItem(STORAGE),null);s.setItem(STORAGE,'broken');const got=loadWorkspace(s);assert.ok(got.error);assert.equal(got.raw,'broken');assert.equal(s.getItem(STORAGE),'broken');assert.throws(()=>saveWorkspace(s,got.data));assert.equal(s.getItem(STORAGE),'broken');});
test('new backup round-trips results and excludes external credential fields',()=>{const r=result(),data={draft:r.brief,history:[{...r,key:'secret'}],keys:{openai:'secret'}};const raw=JSON.stringify(backup(data));assert.doesNotMatch(raw,/secret/);const got=parseBackup(raw);assert.equal(got.history[0].schemes[0].zh,r.schemes[0].zh);assert.throws(()=>parseBackup('{"format":"scene-forge-backup-v5"}'));});
test('bad bilingual result and mismatched count cannot be saved as history',()=>{const r=result();r.schemes[0].en='';assert.throws(()=>validateResult(r));const s=result();s.brief.count=2;assert.throws(()=>validateResult(s));});
test('valid backup can replace corrupt new storage explicitly',()=>{const s=store();s.setItem(STORAGE,'bad');const data=parseBackup(JSON.stringify(backup({draft:freshBrief(),history:[]})));saveWorkspace(s,data,{replace:true});assert.equal(loadWorkspace(s).error,'');});

test('download retains original target adaptation source and text provider',()=>{const r=result();r.target.sources=[{title:'Official source',url:'https://example.com/docs'}];const text=markdown(r);for(const expected of ['midjourney','家族规则','2026-10-22','https://example.com/docs','openai / mock'])assert.ok(text.includes(expected),expected);});

test('model input guidance survives history and download outside the copyable prompt',()=>{const r=result();r.schemes[0].usage='将正向和负向分别粘贴到对应栏位。';const clean=validateResult(r);assert.equal(clean.schemes[0].usage,r.schemes[0].usage);assert.ok(markdown(clean).includes(r.schemes[0].usage));r.schemes[0].usage={bad:true};assert.throws(()=>validateResult(r));});
