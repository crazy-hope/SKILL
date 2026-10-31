import {LABELS} from './model.mjs';
export const PARAMETER_LABEL = 'Midjourney 参数（仅目标为 Midjourney 时使用）：';
const aliases={p:'profile',profile:'profile',c:'chaos',chaos:'chaos',ar:'ar',aspect:'ar',raw:'raw',hd:'hd'};
function parameters(text) {
  const tokens=text.trim().split(/\s+/), pairs=[];
  for(let i=0;i<tokens.length;i++) {
    const name=aliases[tokens[i].slice(2)];
    if(!tokens[i].startsWith('--')||!name||pairs.some(p=>p[0]===name))throw Error('基调参数格式错误或重复。');
    const value=['raw','hd'].includes(name)?'':tokens[++i];
    if((name==='profile'&&!/^[a-zA-Z0-9_-]+$/.test(value||'')) ||
       (name==='chaos'&&(!/^\d+$/.test(value||'')||Number(value)>100)) ||
       (name==='ar'&&!/^[1-9]\d*:[1-9]\d*$/.test(value||'')))throw Error('基调参数值无效。');
    pairs.push([name,value]);
  }
  return pairs;
}
export function validateTone(tone) {
  if(!tone||typeof tone.name!=='string'||!tone.name.trim()||tone.name.length>100||
    !tone.values||Object.keys(tone.values).sort().join()!==Object.keys(LABELS).sort().join()||
    Object.keys(LABELS).some(k=>typeof tone.values[k]!=='string'||tone.values[k].length>5000)||
    typeof tone.midjourneyParameters!=='string'||tone.midjourneyParameters.length>500)throw Error('基调文件格式错误。');
  if(tone.midjourneyParameters)parameters(tone.midjourneyParameters);
  return tone;
}
export function applyTone(brief,tone) {
  validateTone(tone);
  return {...brief,...tone.values,style:tone.values.style+(tone.midjourneyParameters?'\n'+PARAMETER_LABEL+tone.midjourneyParameters:'')};
}
export function matchesTone(brief,tone) {
  const applied=applyTone(brief,tone);
  return Object.keys(LABELS).every(k=>brief[k]===applied[k]);
}
// Only called for a new successful response, never while reading existing history.
export function finishToneParameters(result) {
  if(result.target.id!=='midjourney')return result;
  const lines=result.brief.style.split('\n').filter(l=>l.startsWith(PARAMETER_LABEL));
  if(!lines.length)return result;
  if(lines.length!==1)throw Error('存在多组基调参数，请保留一组后重新生成。');
  const suffix=lines[0].slice(PARAMETER_LABEL.length).trim();
  if(!suffix)return result;
  const pairs=parameters(suffix), expected=Object.fromEntries(pairs);
  const append=(text)=>{
    if(expected.hd!==undefined&&/(?:^|\s)--sd(?=\s|$)/.test(text))throw Error('生成结果的清晰度参数与基调冲突，请重新生成。');
    const clean=text.replace(/(?:^|\s)--(?:(profile|p|chaos|c|aspect|ar)(?=\s|$)(?:\s+(?!--)([^\s]+))?|(raw|hd)(?=\s|$))/g,(match,alias,value,booleanFlag)=>{
      const name=aliases[alias||booleanFlag];
      if(expected[name]===undefined)return match;
      if(booleanFlag)return ''; 
      if(value!==expected[name])throw Error('生成结果参数与基调冲突，请检查画幅等条件后重新生成。');
      return '';
    });
    return clean.trim()+' '+suffix;
  };
  return {...result,schemes:result.schemes.map(s=>({...s,zh:append(s.zh),en:append(s.en)}))};
}
