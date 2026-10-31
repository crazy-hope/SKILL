import test from 'node:test';
import assert from 'node:assert/strict';
import { assertImageSignature } from '../public/image.js';
const png=Uint8Array.of(137,80,78,71,13,10,26,10,0,0,0,13);
const jpeg=Uint8Array.of(255,216,255,224,0,16,74,70,73,70,0,1);
const webp=Uint8Array.of(82,73,70,70,50,0,0,0,87,69,66,80);
test('browser rejects JPEG bytes declared as PNG before accepting preview',()=>{
  assert.throws(()=>assertImageSignature(jpeg,'image/png'),/格式/);
});
test('browser rejects disguised unsupported and truncated image bytes',()=>{
  assert.throws(()=>assertImageSignature(new TextEncoder().encode('GIF89a........'),'image/png'),/格式/);
  assert.throws(()=>assertImageSignature(Uint8Array.of(137,80),'image/png'),/格式/);
});
test('browser accepts matching supported signatures for later decode validation',()=>{
  for(const [bytes,mime] of [[png,'image/png'],[jpeg,'image/jpeg'],[webp,'image/webp']]) assert.doesNotThrow(()=>assertImageSignature(bytes,mime));
});
