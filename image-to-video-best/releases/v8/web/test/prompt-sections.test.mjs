import test from 'node:test';
import assert from 'node:assert/strict';
import {splitPromptSections} from '../public/result.js';
for(const kind of ['plain','numbered','markdown'])test(`renders six headings in ${kind} form without modifying body`,()=>{
 const names=['全局基础硬性设定','场景基底','主体动态细节','运镜规则','同期环境音效','硬性约束'];const text=names.map((n,i)=>`${kind==='numbered'?`${i+1}. `:kind==='markdown'?'## ':''}${n}\n正文${i}：全程大幅摇摆。`).join('\n\n');
 const sections=splitPromptSections(text);assert.equal(sections.length,6);assert.deepEqual(sections.map(x=>x.title),names);for(let i=0;i<6;i++)assert.ok(sections[i].body.includes(`正文${i}：全程大幅摇摆。`));
});
test('single line and embedded heading words remain ordinary prose',()=>{
 const text='全局基础硬性设定是保持原图，场景基底清晰，镜头慢退。';assert.deepEqual(splitPromptSections(text),[{title:null,body:text}]);
});
