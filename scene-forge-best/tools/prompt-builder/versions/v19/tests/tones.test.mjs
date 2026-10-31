import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {applyTone,finishToneParameters} from '../输出/tones.mjs';
import {freshBrief,validateBrief,backup,parseBackup} from '../输出/model.mjs';
const tone=JSON.parse(readFileSync(new URL('../../../../../基调/巨构荷塘-写实柔和.json',import.meta.url)));
test('preset changes only five visible fields and survives existing backup format',()=>{
 const b={...freshBrief(),subject:'我的内容',negative:'',target:'FLUX',count:10};
 const applied=applyTone(b,tone);assert.equal(applied.subject,b.subject);assert.equal(applied.negative,'');assert.equal(applied.target,'FLUX');assert.equal(applied.count,10);
 assert.ok(applied.style.includes(tone.midjourneyParameters));assert.deepEqual(validateBrief(applied),applied);
 assert.deepEqual(parseBackup(JSON.stringify(backup({draft:applied,history:[]}))).draft,applied);
});
const result=(id='midjourney',zh='完整中文',en='Complete English')=>({brief:applyTone(freshBrief(),tone),target:{id},schemes:[{zh,en}]});
test('each bilingual prompt gets exact parameters once; matching model flags deduplicate',()=>{
 const r=result('midjourney','完整中文 --ar 16:9','Complete English '+tone.midjourneyParameters);
 const out=finishToneParameters(r);
 for(const s of out.schemes)for(const k of ['zh','en']){assert.ok(s[k].endsWith(tone.midjourneyParameters));for(const flag of ['profile','chaos','ar','raw','hd'])assert.equal(s[k].match(new RegExp('--'+flag,'g')).length,1);}
 assert.equal(r.schemes[0].zh,'完整中文 --ar 16:9');
});
test('non-MJ and no selected parameters keep output untouched; conflicting output is rejected',()=>{
 const r=result('flux');assert.deepEqual(finishToneParameters(r),r);
 const plain=result();plain.brief=freshBrief();assert.deepEqual(finishToneParameters(plain),plain);
 assert.throws(()=>finishToneParameters(result('midjourney','完整中文 --ar 1:1')),/冲突/);
 assert.throws(()=>finishToneParameters(result('midjourney','完整中文 --sd')),/冲突/);
});
