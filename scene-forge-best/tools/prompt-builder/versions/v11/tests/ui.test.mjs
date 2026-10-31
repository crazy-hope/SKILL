import test from 'node:test';
import assert from 'node:assert/strict';
import {KEY_STORAGE,loadKeys,saveKeys,clearKeys,closeOutsidePickers} from '../输出/ui.mjs';
function store(){const values=new Map();return {getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};}
test('provider keys persist independently after reload and clear',()=>{const s=store();saveKeys(s,{openai:' test-openai ',deepseek:'test-deepseek',unknown:'skip'});assert.deepEqual(loadKeys(s),{openai:'test-openai',deepseek:'test-deepseek'});assert.equal(s.getItem(KEY_STORAGE).includes('skip'),false);clearKeys(s);assert.deepEqual(loadKeys(s),{openai:'',deepseek:''});});
test('storage failure and corrupted keys are surfaced',()=>{assert.throws(()=>saveKeys({setItem(){throw new Error('disabled')}},{openai:'fake'}));assert.throws(()=>loadKeys({getItem(){return '{bad'}}));});
test('outside click closes other pickers while inside remains open',()=>{const inside={};const a={open:true,contains:t=>t===inside},b={open:true,contains:()=>false};closeOutsidePickers([{details:a},{details:b},{}],inside);assert.equal(a.open,true);assert.equal(b.open,false);closeOutsidePickers([{details:a}],null);assert.equal(a.open,false);});
