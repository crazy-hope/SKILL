// Versioned input contract; historical records are never migrated in place.
export const PANEL_FIELDS=['题材','元素','视觉偏好','镜头','风格与复杂度','构图','目标模型','画幅','数量','大致说明'];
export const FIELDS=[...PANEL_FIELDS,'负面提示词'];
export const REGIONS=['东方','西方','中国'];
export const DEFAULT_NEGATIVE='不要有水印、logo或多余空白黑边；避免非预期的形体变形、结构错位、物体无故穿插或融合；避免主体关键细节缺失、模糊成团、非预期的乱码、噪点和压缩伪影；若画面包含人物，避免手脚扭曲、关节错位、肢体错接、无故多出或缺失肢体、手指粘连及五官错乱；若明确要求整幅画面只有一个人，不要增加其他人物、背景人群或重复人影。以上不排除有意的艺术变形、合理遮挡、景深虚化、颗粒质感和构图留白。';
export const DEFAULT_DESCRIPTION='';
export const CHARACTER_KEYS=['gender','age','hairstyle','clothing','clothingColor','clothingMaterial','accessories'];
export const CHARACTER_LABELS={gender:'性别（人物适用）',age:'年龄段',hairstyle:'发型',clothing:'衣服款式',clothingColor:'服装颜色',clothingMaterial:'材质',accessories:'配饰'};
export const CHARACTER_OPTIONS={age:['自动','儿童','少年','青年','中年','老年','不强调年龄','不适用'],hairstyle:['自动','短发','长发','披发','高马尾','低马尾','发髻','编发','光头','不强调发型','不适用'],clothing:['自动','长袍','长裙','短衫','长裤','外套','斗篷','制服','工装','护甲','不强调服装','不适用'],clothingColor:['自动','白色','黑色','青色','蓝色','红色','绿色','紫色','金色','米白色','红白相间','不强调颜色','不适用'],clothingMaterial:['自动','棉布','麻布','丝绸','纱','织锦','羊毛','皮革','金属','合成织物','不强调材质','不适用'],accessories:['自动','无配饰','腰带','项链','耳饰','发簪','帽子','围巾','手套','不强调配饰','不适用']};
export const PERSON_COUNTS=['自动',...Array.from({length:10},(_,i)=>`${i+1}人`),'多人'];
export const ATTRIBUTE_OPTIONS={...CHARACTER_OPTIONS,gender:['自动','男性','女性','非二元','不强调性别'],role:['自动','主体','辅助','背景'],scale:['自动','常规','巨大','微型'],frame:['自动','渺小','全身高度约占画面3%','适中','突出'],count:['自动','单个','多个'],action:['自动','静立','缓步','奔跑','飞翔','游动','漂浮','盘旋','流淌','垂落','飘曳'],position:['自动','居中','左侧','右侧','上部','下部','左上至右下','右上至左下'],depth:['自动','前景','中景','远景','贯穿纵深'],relation:['自动','并行','跟随','面对','环绕','沿着','位于上方','位于下方','位于前方','位于后方','承托','跨越','附属于']};
export const GROUPS={
 '视觉偏好':[['时间',['日出','清晨','正午','下午','日落','傍晚','深夜']],['配色',['冷蓝','冷青','朱砂红','墨黑','米白','鎏金色','乳白','风暴灰蓝','星空蓝紫','朱砂红为主、墨黑为辅、米白留白']],['照明',['暖光','局部暖光','柔和漫射光','逆光','侧光','电影灯光','闪电照明','云隙光']],['氛围',['神秘','宁静','宏伟','梦幻','紧张','生活气息','压迫感','狂暴','诡谲']]],
 '镜头':[['景别',['大远景','超远景','远景','全景','中景','近景','特写']],['视角',['平视','俯视','高位俯视','仰视','顶视','侧面高位俯视']],['视野',['超广角','广角','自然视角','长焦']]],
 '风格与复杂度':[['表现风格',['卡通','纪实摄影','电影 CG','精细写实','精细写实电影 CG','概念艺术','平面插画','油画','水彩','水墨','工笔','版画','像素艺术']],['复杂度',['简约','适中','密集']]]
};
export const COMPOSITIONS=['居中','三分法','对称','对角线','S 形','引导线','框景','大片留白'];
export const listItems=value=>[...new Set(String(value||'').split('；').map(x=>x.trim()).filter(Boolean))];
const string=(v,max=3000)=>typeof v==='string'?v.slice(0,max):'';
export function emptyBrief(){return {...Object.fromEntries(FIELDS.map(k=>[k,k==='目标模型'?'Midjourney':k==='画幅'?'9:16':k==='数量'?'5条':k==='负面提示词'?DEFAULT_NEGATIVE:k==='大致说明'?DEFAULT_DESCRIPTION:''])),地域:'',schemaVersion:4,elementSettings:[],designOptions:{exploration:'自动设计'}};}
export function normalizeBrief(value){
 if(!value||value.schemaVersion!==4||Object.hasOwn(value,'legacy')||!FIELDS.every(k=>typeof value[k]==='string')||!Array.isArray(value.elementSettings)||!value.designOptions||typeof value.designOptions!=='object')throw new Error('当前工作台仅支持当前输入版本，请重新选择条件；旧输入不兼容。');
 const out=emptyBrief();for(const k of FIELDS)if(typeof value?.[k]==='string')out[k]=string(value[k]);
 if(Object.hasOwn(value,'地域')){
  if(!['',...REGIONS].includes(value['地域']))throw new Error('地域请选择东方、西方、中国，或取消选择。');
  out['地域']=value['地域'];
 }else delete out['地域']; // Keep existing V12 history exactly unspecified.
 if(!/^(?:[1-9]|10)条$/.test(out['数量']))out['数量']='5条';
 out['元素']=listItems(out['元素']).slice(0,100).join('；');
 const names=listItems(out['元素']),seen=new Set();
 out.elementSettings=(Array.isArray(value.elementSettings)?value.elementSettings:[]).filter(s=>s&&names.includes(s.name)&&!seen.has(s.name)&&seen.add(s.name)).map(s=>{
  if(Object.hasOwn(s,'presence')&&!['reference','required'].includes(s.presence))throw new Error('元素出现要求无效');
  const item={name:s.name,presence:s.presence||'reference',role:ATTRIBUTE_OPTIONS.role.includes(s.role)?s.role:'自动',scale:ATTRIBUTE_OPTIONS.scale.includes(s.scale)?s.scale:'自动'};
  for(const k of ['frame','count','action','position','depth','relation'])item[k]=string(s[k],80)||'自动';
  for(const key of CHARACTER_KEYS)if(Object.hasOwn(s,key)){
   if(typeof s[key]!=='string'||s[key].length>80)throw new Error(`${CHARACTER_LABELS[key]}请填写不超过80字的文字。`);
   item[key]=s[key].trim()||'自动';
  }
  item.target=typeof s.target==='string'&&s.target!==s.name&&names.includes(s.target)?s.target:'';
  if(s.target&&!item.target)item.relation='自动';
  return item;
 });
 for(const name of names)if(!seen.has(name))out.elementSettings.push(defaultSetting(name));
 out.elementSettings.sort((a,b)=>names.indexOf(a.name)-names.indexOf(b.name));
 out.designOptions={exploration:value.designOptions.exploration==='随机探索'?'随机探索':'自动设计'};
 return out;
}
export function describeBrief(value){
 const out=normalizeBrief(value);
 const rows=FIELDS.flatMap(k=>[`${k}：${out[k]||(k==='负面提示词'?'无（已清空）':'自动设计')}`,...(k==='题材'&&Object.hasOwn(out,'地域')?[`地域：${out['地域']||'未指定'}`]:[])]);
 rows.push(`灵感参考：${out.elementSettings.filter(s=>s.presence==='reference').map(s=>s.name).join('；')||'无'}`);
 rows.push(`必须出现：${out.elementSettings.filter(s=>s.presence==='required').map(s=>s.name).join('；')||'无（明确文字要求仍有效）'}`);
 for(const s of out.elementSettings)rows.push(`元素设置 · ${s.name}（${s.presence==='required'?'必须出现':'参考，采用时适用'}）：${Object.hasOwn(s,'gender')?`性别=${s.gender}；`:''}${CHARACTER_KEYS.filter(k=>k!=='gender'&&Object.hasOwn(s,k)).map(k=>`${CHARACTER_LABELS[k]}=${s[k]}；`).join('')}角色=${s.role}；相对尺度=${s.scale}；画面占比=${s.frame}；对象数量=${s.count}；动作=${s.action}；位置=${s.position}；层次=${s.depth}；关系=${s.relation}；关系对象=${s.target||'自动'}`);
 rows.push(`设计方式：${out.designOptions.exploration}；按意图构思主体和关系，允许库外创作。`);
 return rows.join('\n');
}
export function setElementSetting(brief,name,key,value){
 const out=normalizeBrief(brief);if(!listItems(out['元素']).includes(name))return out;
 const s=out.elementSettings.find(x=>x.name===name)||defaultSetting(name);
 if([...Object.keys(ATTRIBUTE_OPTIONS),'target','presence'].includes(key))s[key]=value;
 out.elementSettings=[...out.elementSettings.filter(x=>x.name!==name),s];return normalizeBrief(out);
}
export function clearField(brief,field){
 const out=normalizeBrief(brief);if(!FIELDS.includes(field))return out;
 out[field]=field==='数量'?'5条':'';
 if(field==='题材')out['地域']='';
 if(field==='大致说明')out.designOptions=emptyBrief().designOptions;
 return normalizeBrief(out);
}

export function defaultSetting(name){return {name,presence:'reference',...Object.fromEntries(Object.keys(ATTRIBUTE_OPTIONS).filter(k=>!CHARACTER_KEYS.includes(k)).map(k=>[k,'自动'])),target:''};}
// Editing may temporarily propose an incomplete dependency set; persistence never accepts it.
export function requiredDependencies(value){
 const settings=new Map(value.elementSettings.map(s=>[s.name,s]));
 const required=new Set(value.elementSettings.filter(s=>s.presence==='required').map(s=>s.name));
 const pending=[...required];const missing=new Set();
 for(let i=0;i<pending.length;i++){
  const target=settings.get(pending[i])?.target;
  if(target&&!required.has(target)){required.add(target);missing.add(target);pending.push(target);}
 }
 return [...missing];
}
export function setRequiredElements(value,names){
 const chosen=new Set(names);
 return normalizeBrief({...value,elementSettings:value.elementSettings.map(s=>({...s,presence:chosen.has(s.name)?'required':'reference'}))});
}
export function validateBrief(value){
 const fail=()=>{throw new Error('当前输入版本或元素设置格式错误，请检查参考与必须出现要求。');};
 if(!value||value.schemaVersion!==4||Object.hasOwn(value,'legacy')||!FIELDS.every(k=>typeof value[k]==='string'&&value[k].length<=3000)||!Array.isArray(value.elementSettings))fail();
 const names=value.元素.split('；').map(x=>x.trim()).filter(Boolean);
 if(names.length>100||new Set(names).size!==names.length||value.elementSettings.length!==names.length)fail();
 if(!/^(?:[1-9]|10)条$/.test(value.数量))fail();
 if(Object.hasOwn(value,'地域')&&!['',...REGIONS].includes(value.地域))fail();
 const opts=value.designOptions;
 if(!opts||Object.keys(opts).length!==1||!['自动设计','随机探索'].includes(opts.exploration))fail();
 const seen=new Set();
 for(const s of value.elementSettings){
  if(!s||!names.includes(s.name)||seen.has(s.name)||!['reference','required'].includes(s.presence))fail();seen.add(s.name);
  if(!ATTRIBUTE_OPTIONS.role.includes(s.role)||!ATTRIBUTE_OPTIONS.scale.includes(s.scale))fail();
  for(const k of ['frame','count','action','position','depth','relation'])if(typeof s[k]!=='string'||!s[k].trim()||s[k].length>80)fail();
  for(const k of CHARACTER_KEYS)if(Object.hasOwn(s,k)&&(typeof s[k]!=='string'||!s[k].trim()||s[k].length>80))fail();
  if(typeof s.target!=='string'||(s.target&&(!names.includes(s.target)||s.target===s.name)))fail();
 }
 const missing=requiredDependencies(value);
 if(missing.length)throw new Error(`关系目标也必须出现，请明确勾选：${missing.join('、')}`);
 return normalizeBrief(value);
}
