import { readFileSync } from 'node:fs';
export const image = `data:image/png;base64,${readFileSync(new URL('../../v1/image-to-video-best/assets/cases/liquid-goddess/source.png',import.meta.url)).toString('base64')}`;
export const request = (patch={})=>({videoModel:'seedance-2.5',platform:'尚未确定',idea:'人物抬手，水流回旋',image,duration:7,level:'detailed',...patch});
export const fixture = JSON.parse(readFileSync(new URL('./fixtures/result.json',import.meta.url),'utf8'));
export function completion(result=fixture, finish='stop') {
  return {id:'test-completion',object:'chat.completion',created:1,model:'fixture-vision',choices:[{index:0,message:{role:'assistant',content:typeof result==='string'?result:JSON.stringify(result)},finish_reason:finish}]};
}
