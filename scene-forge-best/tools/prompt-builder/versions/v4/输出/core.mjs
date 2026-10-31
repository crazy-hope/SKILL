import {TOPICS,catalogGroups} from './catalog.mjs';
export {TOPICS,resolveTopic,catalogGroups,filterGroups} from './catalog.mjs';
export const FIELDS=['题材','想画什么','必须包含','视觉偏好','画幅','目标模型','数量','创作自由度','负面提示词'];
export const DEFAULT_NEGATIVE='不要有水印，不要有logo，不要有变形，不要有空白黑边';
export const COUNTS=['1条','2条','3条','5条'];
export function emptyBrief(){return Object.fromEntries(FIELDS.map(k=>[k,k==='数量'?'1条':k==='创作自由度'?'其余由你设计':k==='负面提示词'?DEFAULT_NEGATIVE:'']));}
export function normalizeBrief(value){const out=emptyBrief();if(value&&typeof value==='object')for(const k of FIELDS)if(typeof value[k]==='string')out[k]=value[k].slice(0,3000);if(!COUNTS.includes(out['数量']))out['数量']='1条';return out;}
export function briefText(brief){return FIELDS.filter(k=>k!=='负面提示词'||Object.hasOwn(brief,k)).map(k=>`${k}：${k==='负面提示词'?(brief[k].trim()||'无（已清空）'):(brief[k]||'由你设计')}`).join('\n');}
const text=(v,max=20000)=>typeof v==='string'?v.slice(0,max):'';
export function snapshot(value){
 if(!value||value.status!=='ready'||!Array.isArray(value.schemes)||!value.schemes.length||value.schemes.length>5)throw new Error('历史结果格式错误');
 const schemes=value.schemes.map(item=>{if(!item||!text(item.zh)||!text(item.en))throw new Error('历史缺少双语提示词');return Object.fromEntries(['name','concept','specs','zh','en','config','checks'].map(k=>[k,text(item[k])]))});
 const brief=normalizeBrief(value.brief);
 // Old generated records must not claim a newly introduced default was used.
 if(!Object.hasOwn(value.brief||{},'负面提示词'))delete brief['负面提示词'];
 return {id:text(value.id,100)||globalThis.crypto.randomUUID(),createdAt:text(value.createdAt,100)||new Date().toISOString(),status:'ready',spec:{version:text(value.spec?.version,50),sha256:text(value.spec?.sha256,100)},provider:text(value.provider,50),model:text(value.model,200),brief,schemes};
}
export function readBackup(raw){
 const v=JSON.parse(raw);
 if(!v||v.format!=='scene-forge-backup-v1'||!Array.isArray(v.presets)||!Array.isArray(v.history)||v.presets.length>100||v.history.length>100)throw new Error('不是有效的工作台备份（最多 100 项）');
 return {draft:normalizeBrief(v.draft),presets:v.presets.map(p=>{if(!p||!text(p.name,80)||!p.brief||typeof p.brief!=='object')throw new Error('预设格式错误');return {id:text(p.id,100)||globalThis.crypto.randomUUID(),name:text(p.name,80),brief:normalizeBrief(p.brief)}}),history:v.history.map(snapshot)};
}
export const OPTIONS={
 '题材':catalogGroups('题材'),
 '想画什么':[['画面类型',['人物肖像','建筑环境','载具展示','叙事场景','产品静物','抽象构成']]],
 '必须包含':[['空间与环境',['山体','水面','桥梁','道路','植被']],['人物与活动',['行人','工作中的人群','休憩的人物']],['物件与信息',['照明设施','指示标识','工具','交通设施']]],
 '视觉偏好':[['表现媒介',['写实电影感','纪实摄影','水彩插画','工笔重彩','三维渲染','平面设计']],['时间',['清晨','正午','黄昏','夜晚']],['光色',['冷灰色与局部暖光','低饱和自然色','高对比黑白','柔和暖色','蓝紫与琥珀色']],['氛围',['宁静','宏伟','神秘','生活气息','紧张动感']]],
 '创作自由度':[['开放设计',['其余由你设计','建筑造型由你设计','人物服装由你设计','载具结构由你设计','镜头构图由你设计','严格遵循已填要求，仅补齐缺项']]]
};

export const MAX_BACKUP_BYTES=160*1024*1024;
export function toggleChoice(selected,value,checked){const next=selected.filter(v=>v!==value);if(checked)next.push(value);return [...new Set(next)];}
export function restoreDraft(value,pickers){for(const p of Object.values(pickers))if(p.addValue)p.input.value='';return normalizeBrief(value);}
