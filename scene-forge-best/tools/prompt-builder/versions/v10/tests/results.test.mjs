import test from 'node:test';
import assert from 'node:assert/strict';
import * as ui from '../输出/ui.mjs';
import * as core from '../输出/core.mjs';
function button(){return {attrs:{},handlers:{},setAttribute(k,v){this.attrs[k]=v},addEventListener(k,f){this.handlers[k]=f},click(){this.handlers.click?.()}};}
test('result navigation displays first without copying and activates every explicit click',()=>{
 assert.equal(typeof ui.wireResultNavigation,'function');
 const rows=Array.from({length:10},()=>({button:button(),panel:{hidden:false}}));const clicks=[];
 ui.wireResultNavigation(rows,(i)=>clicks.push(i));
 assert.equal(rows.filter(r=>!r.panel.hidden).length,1);assert.equal(rows[0].panel.hidden,false);assert.deepEqual(clicks,[]);
 rows[9].button.click();assert.equal(rows[9].panel.hidden,false);assert.equal(rows[0].panel.hidden,true);assert.equal(rows[9].button.attrs['aria-pressed'],'true');assert.deepEqual(clicks,[9]);
 rows[9].button.click();assert.deepEqual(clicks,[9,9]);assert.equal(rows[9].panel.hidden,false);
 rows[2].button.click();assert.equal(rows.filter(r=>!r.panel.hidden).length,1);assert.equal(rows[2].panel.hidden,false);
});
test('all quantities through ten survive normalization and ten schemes survive backup',()=>{
 for(let i=1;i<=10;i++)assert.equal(core.normalizeBrief({'数量':i+'条'})['数量'],i+'条');
 const item={status:'ready',brief:{'数量':'10条'},schemes:Array.from({length:10},(_,i)=>({name:'方案'+i,zh:'中文'+i,en:'English '+i}))};
 const out=core.snapshot(item);assert.equal(out.schemes.length,10);assert.equal(out.schemes[9].en,'English 9');
 assert.equal(core.readBackup(JSON.stringify({format:'scene-forge-backup-v1',draft:out.brief,presets:[],history:[out]})).history[0].schemes.length,10);
 assert.throws(()=>core.snapshot({...item,schemes:[...item.schemes,item.schemes[0]]}));
 assert.equal(core.normalizeBrief({'数量':'11条'})['数量'],'1条');
 assert.ok(core.MAX_BACKUP_BYTES>=30*10*7*20000*6+100*9*3000*6+30*9*3000*6+1000000);
});
