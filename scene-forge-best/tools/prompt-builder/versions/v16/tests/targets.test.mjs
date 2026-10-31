import {actualDesign,selectedBrief} from './actual-design-fixture.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import * as core from '../输出/core.mjs';
const result=()=>({status:'ready',brief:selectedBrief(core.emptyBrief()),spec:{version:'v6',sha256:'abc'},schemes:[{design:actualDesign(),name:'样例',zh:'中文',en:'English'}]});
test('target provenance survives history and backup without extra secrets',()=>{
 const r=result();r.target={id:'flux',requested:'FLUX.2 pro',label:'FLUX',checkedAt:'2026-10-16',scope:'FLUX.2 pro/max',notice:'版本待核实',sources:[{title:'BFL',url:'https://docs.bfl.ai/guides/prompting_guide_flux2',key:'secret'}],key:'secret'};
 const s=core.snapshot(r);
 assert.equal(s.target?.requested,'FLUX.2 pro');assert.equal(s.target.sources[0].title,'BFL');
 assert.ok(!JSON.stringify(s).includes('secret'));
 r.target.sources[0].title='changed';assert.equal(s.target.sources[0].title,'BFL');
 const restored=core.readBackup(JSON.stringify({format:'scene-forge-backup-v5',draft:core.emptyBrief(),presets:[],history:[s]}));
 assert.deepEqual(restored.history[0].target,s.target);
});
test('missing provenance is not invented',()=>{
 assert.equal(Object.hasOwn(core.snapshot(result()),'target'),false);
});
test('download includes target and sources for combined or individual schemes',()=>{
 assert.equal(typeof core.targetText,'function');
 const r=result();r.target={requested:'FLUX',label:'FLUX',scope:'FLUX.2',checkedAt:'2026-10-16',notice:'待核实',sources:[{title:'BFL',url:'https://docs.bfl.ai/guides/prompting_guide_flux2'}]};
 const text=core.targetText(r.target);
 assert.ok(text.includes('FLUX'));assert.ok(text.includes('2026-10-16'));assert.ok(text.includes('https://docs.bfl.ai/'));
 assert.ok(core.targetText(undefined).includes('未记录'));
});
