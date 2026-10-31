import test from 'node:test';
import assert from 'node:assert/strict';
import {FIELDS,emptyBrief,normalizeBrief,briefText,snapshot,readBackup} from '../输出/core.mjs';
test('eight fields keep their order and count means pairs',()=>{
 const brief=emptyBrief(); assert.equal(FIELDS.length,8);assert.equal(brief['数量'],'1条');
 assert.deepEqual(briefText(brief).split('\n').map(x=>x.split('：')[0]),FIELDS);
});
test('history snapshot never retains key and does not mutate with form',()=>{
 const brief=emptyBrief();brief['题材']='赛博朋克';
 const out={status:'ready',provider:'openai',model:'test',spec:{version:'v4',sha256:'test'},brief,schemes:[{name:'a',zh:'中文',en:'English'}],key:'secret'};
 const s=snapshot(out);brief['题材']='太空';out.schemes[0].zh='changed';
 assert.equal(s.brief['题材'],'赛博朋克');assert.equal(s.schemes[0].zh,'中文');assert.equal(JSON.stringify(s).includes('secret'),false);
});
test('bad storage and unknown backup formats rejected',()=>{
 for(const x of ['bad','{}','{"format":"scene-forge-backup-v1","presets":"oops"}']) assert.throws(()=>readBackup(x));
});
test('normalization whitelists fields and restores counts',()=>{
 assert.equal(normalizeBrief({'数量':'999条','key':'secret'})['数量'],'1条');
 assert.equal('key' in normalizeBrief({key:'secret'}),false);
});
test('backup strips unknown fields and API credentials',()=>{
 const out=readBackup(JSON.stringify({format:'scene-forge-backup-v1',presets:[{name:'我的',brief:{'题材':'东方天界幻想',key:'secret'},key:'secret'}],history:[],key:'secret'}));
 assert.equal(out.presets[0].brief['题材'],'东方天界幻想');assert.equal(JSON.stringify(out).includes('secret'),false);
});

test('mixed visual styles remain selected',async()=>{
 const core=await import('../输出/core.mjs');
 assert.deepEqual(core.toggleChoice(['水彩插画'],'工笔重彩',true),['水彩插画','工笔重彩']);
});
test('restoring history clears pending custom text before next generation',async()=>{
 const core=await import('../输出/core.mjs');const pickers={custom:{addValue(){},input:{value:'stale text'}},select:{input:{value:'16:9'}}};
 const brief=core.restoreDraft({'题材':'东方天界幻想'},pickers);
 assert.equal(brief['题材'],'东方天界幻想');assert.equal(pickers.custom.input.value,'');assert.equal(pickers.select.input.value,'16:9');
});
test('import size allowance accommodates the largest internally saved backup',async()=>{
 const core=await import('../输出/core.mjs');
 // 30 histories × 5 schemes × 7 fields × 20k chars × max 6 escaped JSON bytes,
 // plus 100 presets, request snapshots and metadata (conservative upper bound).
 const maxSavedBytes=30*5*7*20000*6+100*8*3000*6+30*8*3000*6+1000000;
 assert.ok(core.MAX_BACKUP_BYTES>=maxSavedBytes);
});
