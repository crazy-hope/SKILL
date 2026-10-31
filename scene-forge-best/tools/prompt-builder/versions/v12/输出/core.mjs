import {normalizeBrief,describeBrief} from './brief.mjs';
import {TOPICS,catalogGroups,resolveScene,resolveTopic,resolveElement} from './catalog.mjs';
export {TOPICS,resolveTopic,catalogGroups,filterGroups,resolveScene,resolveElement} from './catalog.mjs';
export {FIELDS,DEFAULT_NEGATIVE,emptyBrief,normalizeBrief} from './brief.mjs';
export const COUNTS=Array.from({length:10},(_,i)=>(i+1)+'条');
export const reusableBrief=normalizeBrief;
export const briefText=describeBrief;
// Use the saved result, not the currently edited form. One batch shares one timestamp.
export function promptDownloadBase(result, downloadedAt=new Date()){
 const safePart=(value,fallback,maxBytes)=>{
  const clean=String(value||'').trim().replace(/[<>:"/\\|?*\u0000-\u001f\u007f]/g,'-').replace(/[；;]/g,'-').replace(/\s+/g,' ').replace(/^[ .]+|[ .]+$/g,'')||fallback;
  let out='';for(const char of clean){if(new TextEncoder().encode(out+char).length>maxBytes)break;out+=char;}return out.trim();
 };
 const parts=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(downloadedAt).map(p=>[p.type,p.value]));
 const stamp=['year','month','day','hour','minute','second'].map(k=>parts[k]).join('');
 const brief=result.brief||{};
 return [safePart(brief['题材'],'未指定题材',60),safePart(brief['目标模型'],'通用模型',60),safePart(String(brief['画幅']||'').replace(/[:：]/g,'x'),'未指定画幅',24),stamp].join('_');
}
const text=(v,max=20000)=>typeof v==='string'?v.slice(0,max):'';
function targetSnapshot(v){
 if(!v||typeof v!=='object'||!text(v.id,80))return undefined;
 const out=Object.fromEntries(['id','label','requested','scope','checkedAt','notice'].map(k=>[k,text(v[k],k==='requested'?3000:1000)]));
 out.sources=Array.isArray(v.sources)?v.sources.slice(0,10).filter(s=>s&&typeof s==='object').map(s=>({title:text(s.title,200),url:text(s.url,2000)})):[];
 return out;
}
export function targetText(target){
 if(!target)return '目标模型适配来源：未记录';
 return `目标图像模型：${target.requested||'未指定'}\n适配规则：${target.label}\n资料范围：${target.scope}\n规则查阅日期：${target.checkedAt||'未核实'}\n${target.notice}\n官方来源：\n${target.sources.map(s=>`${s.title}：${s.url}`).join('\n')||'无已核实来源'}`;
}
export function snapshot(value){
 if(!value||value.status!=='ready'||!Array.isArray(value.schemes)||!value.schemes.length||value.schemes.length>10)throw new Error('历史结果格式错误');
 const schemes=value.schemes.map(item=>{if(!item||!text(item.zh)||!text(item.en))throw new Error('历史缺少双语提示词');return Object.fromEntries(['name','concept','specs','zh','en','config','checks'].map(k=>[k,text(item[k])]))});
 const brief=normalizeBrief(value.brief);
 const target=targetSnapshot(value.target);
 return {id:text(value.id,100)||globalThis.crypto.randomUUID(),createdAt:text(value.createdAt,100)||new Date().toISOString(),status:'ready',spec:{version:text(value.spec?.version,50),sha256:text(value.spec?.sha256,100)},provider:text(value.provider,50),model:text(value.model,200),brief,schemes,...(target?{target}:{})};
}
export function readBackup(raw){
 const v=JSON.parse(raw);
 if(!v||v.format!=='scene-forge-backup-v3'||!Array.isArray(v.presets)||!Array.isArray(v.history)||v.presets.length>100||v.history.length>100)throw new Error('V12仅支持当前版本备份（最多 100 项），不兼容旧备份');
 return {draft:reusableBrief(v.draft),presets:v.presets.map(p=>{if(!p||!text(p.name,80)||!p.brief||typeof p.brief!=='object')throw new Error('预设格式错误');return {id:text(p.id,100)||globalThis.crypto.randomUUID(),name:text(p.name,80),brief:normalizeBrief(p.brief)}}),history:v.history.map(snapshot)};
}
export const OPTIONS={
 '题材':catalogGroups('题材'),
 '想画什么':[['画面类型',['人物肖像','建筑环境','载具展示','叙事场景','产品静物','抽象构成']],['空旷与简约场景',['单一主体置于开阔环境，周围保留大片低细节空间','空旷环境中仅有一处主要景物，其余区域疏朗留白','无人空景，少量景物之间保留开阔空间']]],
 '必须包含':[['空间与环境',['山体','水面','桥梁','道路','植被']],['人物与活动',['行人','人群','人物']],['物件与信息',['照明设施','指示标识','工具','交通设施']]],
 '视觉偏好':[['构图与疏密',['简约构图，突出一个视觉中心','大面积留白（低细节空间，不限定白色背景）','疏朗布局，主体之间保持清晰间距','背景低细节，避免装饰堆叠']],['表现媒介',['写实电影感','纪实摄影','水彩插画','工笔重彩','三维渲染','平面设计']],['时间',['清晨','正午','黄昏','夜晚']],['光色',['冷灰色与局部暖光','低饱和自然色','高对比黑白','柔和暖色','蓝紫与琥珀色']],['氛围',['宁静','宏伟','神秘','生活气息','紧张动感']]],
 '创作自由度':[['开放设计',['其余由你设计','建筑造型由你设计','人物服装由你设计','载具结构由你设计','镜头构图由你设计','严格遵循已填要求，仅补齐缺项']]]
};

// Known objects do not need gender controls; custom names may describe a person.
const characterNames=new Set([...Object.values(TOPICS).flatMap(t=>t.categories['人物与身份']||[]),'行人','人群','人物']);
const catalogElementNames=new Set(Object.values(TOPICS).flatMap(t=>t.elements));
export function supportsCharacterGender(name){return characterNames.has(name)||!catalogElementNames.has(name);}

export const MAX_BACKUP_BYTES=320*1024*1024;
export function optionGroups(field,names=[],scene=''){
 let generic=OPTIONS[field]||[];
 const celestialOnly=names.length>0&&names.every(name=>[TOPICS['东方天界幻想'],TOPICS['云上天宫']].includes(resolveTopic(name)));
 if(celestialOnly&&field==='必须包含')generic=generic.filter(([label])=>label!=='人物与活动');
 if(celestialOnly&&field==='想画什么')generic=generic.map(([label,items])=>[label,items.filter(item=>item!=='人物肖像')]);
 if(names.length>0&&names.every(name=>resolveTopic(name)===TOPICS['云上天宫'])&&field==='想画什么')generic=generic.map(([label,items])=>[label,label==='画面类型'?items.filter(item=>['建筑环境','叙事场景'].includes(item)):items]);
 return ['想画什么','必须包含','视觉偏好'].includes(field)?[...catalogGroups(field,names,scene),...generic]:generic;
}
export function topicGuidance(names=[]){return [...new Set(names.map(resolveTopic).filter(Boolean).map(t=>t.direction).filter(Boolean))].join(' ');}
export function toggleChoice(selected,value,checked){const next=selected.filter(v=>v!==value);if(checked)next.push(value);return [...new Set(next)];}
export function toggleSceneChoice(selected,value,checked){const next=selected.filter(v=>resolveScene(v)!==resolveScene(value));if(checked)next.push(value);return [...new Set(next)];}
export function restoreDraft(value,pickers){for(const p of Object.values(pickers))if(p.addValue)p.input.value='';return reusableBrief(value);}
