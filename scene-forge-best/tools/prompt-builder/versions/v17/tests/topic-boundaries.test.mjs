import test from 'node:test';
import assert from 'node:assert/strict';
import {topicGuidance} from '../输出/core.mjs';
test('topic guidance preserves cultural boundary while allowing original objects',()=>{
 const text=topicGuidance(['东方奇幻世界']);
 assert.match(text,/题材.*文化.*边界/);
 assert.match(text,/不自行混入西方/);
 assert.match(text,/明确.*融合/);
 assert.match(text,/库外/);
 assert.equal(topicGuidance([]),'');
 assert.match(topicGuidance(['自定义幻想世界']),/题材.*边界/);
 assert.doesNotMatch(topicGuidance(['自定义幻想世界']),/东方奇幻世界|不自行混入西方/);
});
