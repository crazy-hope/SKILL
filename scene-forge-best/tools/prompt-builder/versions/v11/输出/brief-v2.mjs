// Versioned input contract; historical records are never migrated in place.
import {resolveElement} from './catalog.mjs';
export const PANEL_FIELDS=['题材','元素','视觉偏好','镜头','风格与复杂度','构图','目标模型','画幅','数量','大致说明'];
export const V2_FIELDS=[...PANEL_FIELDS,'负面提示词'];
export const DEFAULT_NEGATIVE='不要有水印，不要有logo，不要有变形，不要有空白黑边';
export const DEFAULT_DESCRIPTION='光线柔和漫射，空间层次分明，阴影清晰可辨，细节丰富。';
export const ATTRIBUTE_OPTIONS={role:['自动','主体','辅助','背景'],scale:['自动','常规','巨大','微型'],frame:['自动','渺小','适中','突出'],count:['自动','单个','多个']};
export const GROUPS={
 '视觉偏好':[['时间',['日出','清晨','正午','下午','日落','傍晚','深夜']],['配色',['冷蓝','冷青','朱砂红','墨黑','米白','鎏金色','乳白','星空蓝紫','朱砂红为主、墨黑为辅、米白留白']],['照明',['暖光','局部暖光','柔和漫射光','逆光','侧光','电影灯光']],['氛围',['神秘','宁静','宏伟','梦幻','紧张','生活气息']]],
 '镜头':[['景别',['大远景','超远景','远景','全景','中景','近景','特写']],['视角',['平视','俯视','高位俯视','仰视','顶视','侧面高位俯视']],['视野',['超广角','广角','自然视角','长焦']]],
 '风格与复杂度':[['表现风格',['卡通','纪实摄影','电影 CG','精细写实','概念艺术','平面插画','油画','水彩','水墨','工笔','版画','像素艺术']],['复杂度',['简约','适中','密集']]]
};
export const COMPOSITIONS=['居中','三分法','对称','对角线','S 形','引导线','框景','大片留白'];
export const listItems=value=>[...new Set(String(value||'').split('；').map(x=>x.trim()).filter(Boolean))];
const string=(v,max=3000)=>typeof v==='string'?v.slice(0,max):'';
export function emptyV2(){return {...Object.fromEntries(V2_FIELDS.map(k=>[k,k==='目标模型'?'Midjourney':k==='画幅'?'9:16':k==='数量'?'5条':k==='负面提示词'?DEFAULT_NEGATIVE:k==='大致说明'?DEFAULT_DESCRIPTION:''])),schemaVersion:2,elementSettings:[],designOptions:{exploration:'自动设计',selectionMode:'全部包含',allowExtra:false},legacy:{}};}
export function normalizeV2(value){
 const out=emptyV2();for(const k of V2_FIELDS)if(typeof value?.[k]==='string')out[k]=string(value[k]);
 if(!/^(?:[1-9]|10)条$/.test(out['数量']))out['数量']='5条';
 out['元素']=listItems(out['元素']).slice(0,100).join('；');
 const names=listItems(out['元素']),seen=new Set();
 out.elementSettings=(Array.isArray(value?.elementSettings)?value.elementSettings:[]).filter(s=>s&&names.includes(s.name)&&!seen.has(s.name)&&seen.add(s.name)).map(s=>({name:s.name,role:ATTRIBUTE_OPTIONS.role.includes(s.role)?s.role:'自动',scale:ATTRIBUTE_OPTIONS.scale.includes(s.scale)?s.scale:'自动',frame:string(s.frame,80)||'自动',count:string(s.count,80)||'自动'}));
 out.designOptions={exploration:value?.designOptions?.exploration==='随机探索'?'随机探索':'自动设计',selectionMode:value?.designOptions?.selectionMode==='选配'?'选配':'全部包含',allowExtra:value?.designOptions?.allowExtra===true};
 for(const key of ['场景候选','视觉偏好','创作自由度'])if(typeof value?.legacy?.[key]==='string'&&value.legacy[key])out.legacy[key]=string(value.legacy[key]);
 return out;
}
export function migrateBrief(value){
 if(value?.schemaVersion===2)return normalizeV2(value);
 if(!value||!Object.keys(value).length)return emptyV2();
 const out=emptyV2();for(const key of ['题材','画幅','目标模型','数量','负面提示词'])if(typeof value[key]==='string')out[key]=value[key];
 out['元素']=listItems(value['必须包含']).map(resolveElement).join('；');
 for(const [old,key] of [['想画什么','场景候选'],['视觉偏好','视觉偏好'],['创作自由度','创作自由度']])if(typeof value[old]==='string'&&value[old])out.legacy[key]=value[old];
 return normalizeV2(out);
}
export function describeV2(value){
 const out=normalizeV2(value);
 const rows=V2_FIELDS.map(k=>`${k}：${out[k]||(k==='负面提示词'?'无（已清空）':'自动设计')}`);
 for(const s of out.elementSettings)rows.push(`元素设置 · ${s.name}：角色=${s.role}；相对尺度=${s.scale}；画面占比=${s.frame}；对象数量=${s.count}`);
 rows.push(`设计方式：${out.designOptions.exploration}；元素使用=${out.designOptions.selectionMode}；允许补充额外对象=${out.designOptions.allowExtra?'是':'否'}`);
 for(const [key,v] of Object.entries(out.legacy))rows.push(`旧输入兼容 · ${key}：${v}`);
 return rows.join('\n');
}
export function setElementSetting(brief,name,key,value){
 const out=normalizeV2(brief);if(!listItems(out['元素']).includes(name))return out;
 const s=out.elementSettings.find(x=>x.name===name)||{name,role:'自动',scale:'自动',frame:'自动',count:'自动'};
 if(['role','scale','frame','count'].includes(key))s[key]=value;
 out.elementSettings=[...out.elementSettings.filter(x=>x.name!==name),s];return normalizeV2(out);
}
export function clearV2Field(brief,field){
 const out=normalizeV2(brief);if(!V2_FIELDS.includes(field))return out;
 out[field]=field==='数量'?'5条':'';
 if(field==='视觉偏好')delete out.legacy['视觉偏好'];
 if(field==='大致说明'){out.legacy={};out.designOptions=emptyV2().designOptions;}
 return normalizeV2(out);
}
