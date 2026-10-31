import {validateTone} from '../tones.mjs';
const files=import.meta.glob('../../../../../../基调/*.json',{eager:true,import:'default'});
export const tones=Object.values(files).map(validateTone).sort((a,b)=>a.name.localeCompare(b.name,'zh-CN'));
if(new Set(tones.map(t=>t.name)).size!==tones.length)throw Error('基调名称重复。');
