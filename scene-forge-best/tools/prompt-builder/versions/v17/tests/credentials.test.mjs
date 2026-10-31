import test from 'node:test';
import assert from 'node:assert/strict';
import {KEY_STORAGE,loadKeys,saveKeys,clearKeys} from '../输出/src/credentials.mjs';
test('provider keys retain their own storage and can be cleared without touching creative data',()=>{
 const map=new Map([['scene-forge-workspace-v15','creative-data']]);const s={getItem:k=>map.get(k),setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};
 saveKeys(s,{openai:' first ',deepseek:'second',other:'ignored'});assert.deepEqual(loadKeys(s),{openai:'first',deepseek:'second'});assert.equal(KEY_STORAGE,'scene-forge-api-keys-v1');clearKeys(s);assert.deepEqual(loadKeys(s),{openai:'',deepseek:''});assert.equal(map.get('scene-forge-workspace-v15'),'creative-data');
});
test('unreadable credentials and storage failures remain observable',()=>{
 assert.throws(()=>loadKeys({getItem:()=>'{'}));assert.throws(()=>saveKeys({setItem(){throw Error('quota');}},{}));assert.throws(()=>clearKeys({removeItem(){throw Error('blocked');}}));
});
