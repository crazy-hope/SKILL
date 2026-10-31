// Versioned input contract; historical records are never migrated in place.
export const PANEL_FIELDS=['题材','元素','视觉偏好','镜头','风格与复杂度','构图','目标模型','画幅','数量','大致说明'];
export const FIELDS=[...PANEL_FIELDS,'负面提示词'];
export const REGIONS=['东方','西方','中国'];
export const DEFAULT_NEGATIVE='不要有水印，不要有logo，不要有变形，不要有空白黑边';
export const DEFAULT_DESCRIPTION='光线柔和漫射，空间层次分明，阴影清晰可辨，细节丰富。';
export const ATTRIBUTE_OPTIONS={gender:['自动','男性','女性','非二元','不强调性别'],role:['自动','主体','辅助','背景'],scale:['自动','常规','巨大','微型'],frame:['自动','渺小','全身高度约占画面3%','适中','突出'],count:['自动','单个','多个'],action:['自动','静立','缓步','奔跑','飞翔','游动','漂浮','盘旋','流淌','垂落','飘曳'],position:['自动','居中','左侧','右侧','上部','下部','左上至右下','右上至左下'],depth:['自动','前景','中景','远景','贯穿纵深'],relation:['自动','并行','跟随','面对','环绕','沿着','位于上方','位于下方','位于前方','位于后方','承托','跨越','附属于']};
export const GROUPS={
 '视觉偏好':[['时间',['日出','清晨','正午','下午','日落','傍晚','深夜']],['配色',['冷蓝','冷青','朱砂红','墨黑','米白','鎏金色','乳白','风暴灰蓝','星空蓝紫','朱砂红为主、墨黑为辅、米白留白']],['照明',['暖光','局部暖光','柔和漫射光','逆光','侧光','电影灯光','闪电照明','云隙光']],['氛围',['神秘','宁静','宏伟','梦幻','紧张','生活气息','压迫感','狂暴','诡谲']]],
 '镜头':[['景别',['大远景','超远景','远景','全景','中景','近景','特写']],['视角',['平视','俯视','高位俯视','仰视','顶视','侧面高位俯视']],['视野',['超广角','广角','自然视角','长焦']]],
 '风格与复杂度':[['表现风格',['卡通','纪实摄影','电影 CG','精细写实','精细写实电影 CG','概念艺术','平面插画','油画','水彩','水墨','工笔','版画','像素艺术']],['复杂度',['简约','适中','密集']]]
};
export const COMPOSITIONS=['居中','三分法','对称','对角线','S 形','引导线','框景','大片留白'];
export const listItems=value=>[...new Set(String(value||'').split('；').map(x=>x.trim()).filter(Boolean))];
const string=(v,max=3000)=>typeof v==='string'?v.slice(0,max):'';
export function emptyBrief(){return {...Object.fromEntries(FIELDS.map(k=>[k,k==='目标模型'?'Midjourney':k==='画幅'?'9:16':k==='数量'?'5条':k==='负面提示词'?DEFAULT_NEGATIVE:k==='大致说明'?DEFAULT_DESCRIPTION:''])),地域:'',schemaVersion:3,elementSettings:[],designOptions:{exploration:'自动设计',selectionMode:'全部包含',allowExtra:false}};}
export function normalizeBrief(value){
 if(!value||value.schemaVersion!==3||Object.hasOwn(value,'legacy')||!FIELDS.every(k=>typeof value[k]==='string')||!Array.isArray(value.elementSettings)||!value.designOptions||typeof value.designOptions!=='object')throw new Error('V12仅支持当前输入版本，请重新选择条件；旧输入不兼容。');
 const out=emptyBrief();for(const k of FIELDS)if(typeof value?.[k]==='string')out[k]=string(value[k]);
 if(Object.hasOwn(value,'地域')){
  if(!['',...REGIONS].includes(value['地域']))throw new Error('地域请选择东方、西方、中国，或取消选择。');
  out['地域']=value['地域'];
 }else delete out['地域']; // Keep existing V12 history exactly unspecified.
 if(!/^(?:[1-9]|10)条$/.test(out['数量']))out['数量']='5条';
 out['元素']=listItems(out['元素']).slice(0,100).join('；');
 const names=listItems(out['元素']),seen=new Set();
 out.elementSettings=(Array.isArray(value.elementSettings)?value.elementSettings:[]).filter(s=>s&&names.includes(s.name)&&!seen.has(s.name)&&seen.add(s.name)).map(s=>{
  const item={name:s.name,role:ATTRIBUTE_OPTIONS.role.includes(s.role)?s.role:'自动',scale:ATTRIBUTE_OPTIONS.scale.includes(s.scale)?s.scale:'自动'};
  for(const k of ['frame','count','action','position','depth','relation'])item[k]=string(s[k],80)||'自动';
  if(Object.hasOwn(s,'gender')){
   if(typeof s.gender!=='string'||s.gender.length>80)throw new Error('人物性别请填写不超过80字的文字。');
   item.gender=s.gender.trim()||'自动';
  }
  item.target=typeof s.target==='string'&&s.target!==s.name&&names.includes(s.target)?s.target:'';
  if(s.target&&!item.target)item.relation='自动';
  return item;
 });
 out.designOptions={exploration:value?.designOptions?.exploration==='随机探索'?'随机探索':'自动设计',selectionMode:value?.designOptions?.selectionMode==='选配'?'选配':'全部包含',allowExtra:value?.designOptions?.allowExtra===true};
 return out;
}
export function describeBrief(value){
 const out=normalizeBrief(value);
 const rows=FIELDS.flatMap(k=>[`${k}：${out[k]||(k==='负面提示词'?'无（已清空）':'自动设计')}`,...(k==='题材'&&Object.hasOwn(out,'地域')?[`地域：${out['地域']||'未指定'}`]:[])]);
 for(const s of out.elementSettings)rows.push(`元素设置 · ${s.name}：${Object.hasOwn(s,'gender')?`性别=${s.gender}；`:''}角色=${s.role}；相对尺度=${s.scale}；画面占比=${s.frame}；对象数量=${s.count}；动作=${s.action}；位置=${s.position}；层次=${s.depth}；关系=${s.relation}；关系对象=${s.target||'自动'}`);
 rows.push(`设计方式：${out.designOptions.exploration}；元素使用=${out.designOptions.selectionMode}；允许补充额外对象=${out.designOptions.allowExtra?'是':'否'}`);
 rows.push('未手动指定的动作、空间与附属关系：根据已选元素自动设计。');
 return rows.join('\n');
}
export function setElementSetting(brief,name,key,value){
 const out=normalizeBrief(brief);if(!listItems(out['元素']).includes(name))return out;
 const s=out.elementSettings.find(x=>x.name===name)||{name,...Object.fromEntries(Object.keys(ATTRIBUTE_OPTIONS).filter(k=>k!=='gender').map(k=>[k,'自动'])),target:''};
 if([...Object.keys(ATTRIBUTE_OPTIONS),'target'].includes(key))s[key]=value;
 out.elementSettings=[...out.elementSettings.filter(x=>x.name!==name),s];return normalizeBrief(out);
}
export function clearField(brief,field){
 const out=normalizeBrief(brief);if(!FIELDS.includes(field))return out;
 out[field]=field==='数量'?'5条':'';
 if(field==='题材')out['地域']='';
 if(field==='大致说明')out.designOptions=emptyBrief().designOptions;
 return normalizeBrief(out);
}
