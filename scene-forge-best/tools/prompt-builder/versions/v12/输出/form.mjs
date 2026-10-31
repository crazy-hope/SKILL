import {PANEL_FIELDS,REGIONS,ATTRIBUTE_OPTIONS,GROUPS,COMPOSITIONS,listItems,normalizeBrief,setElementSetting,clearField} from './brief.mjs';
import {optionGroups,filterGroups,supportsCharacterGender} from './core.mjs';
const node=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
const hints={'题材':'基础世界与气质','元素':'已选默认每方案必含','视觉偏好':'时间 · 配色 · 照明 · 氛围','镜头':'景别 · 视角 · 视野','风格与复杂度':'表现方式与内容疏密','构图':'主体布局与视线','目标模型':'最终用于出图','画幅':'图片宽高比','数量':'每方案含完整中英文','大致说明':'可选补充 · 无需写完整提示词'};
export function createForm({host,negativeHost,getDraft,onChange,onNotice}){
 const syncers=[],pickers=[],pending=[];
 const commit=patch=>onChange(normalizeBrief({...getDraft(),...patch}));
 const refresh=()=>syncers.forEach(fn=>fn());
 function textInput(parent,label,get,set,placeholder='',multi=false,max=3000){
  const wrap=node('label','control-label',label);const input=node(multi?'textarea':'input');input.setAttribute('aria-label',label);input.placeholder=placeholder;input.maxLength=max;if(multi)input.rows=3;
  input.addEventListener('input',()=>set(input.value));wrap.append(input);parent.append(wrap);syncers.push(()=>input.value=get());return input;
 }
 function select(parent,label,options,get,set,custom=false){
  const wrap=node('label','control-label',label),s=node('select');s.setAttribute('aria-label',label);
  options.forEach(v=>s.append(new Option(v||'自动设计',v)));if(custom)s.append(new Option('自定义…','__custom'));
  const input=node('input','custom-select');input.setAttribute('aria-label','自定义'+label);input.maxLength=label.includes(' · ')?80:200;input.placeholder='输入具体要求';input.hidden=true;
  const draw=()=>{const value=get()||'';const isCustom=!options.includes(value);s.value=isCustom?'__custom':value;input.hidden=!isCustom;input.value=isCustom?value:'';};
  s.addEventListener('change',()=>{if(s.value==='__custom'){input.hidden=false;input.value='';input.focus();}else{input.hidden=true;set(s.value);}});
  input.addEventListener('input',()=>set(input.value));wrap.append(s);if(custom)wrap.append(input);parent.append(wrap);syncers.push(draw);draw();return s;
 }
 function choices(parent,field){
  const details=node('details','picker'),summary=node('summary'),body=node('div','picker-body');summary.setAttribute('aria-label',field);details.append(summary,body);pickers.push({details});
  const tools=node('div','picker-tools');const search=node('input');search.type='search';search.placeholder='搜索名称或分类';search.setAttribute('aria-label','搜索'+field);const category=node('select');category.setAttribute('aria-label',field+'分类');tools.append(search,category);body.append(tools);
  const count=node('div','picker-count'),list=node('div','picker-list');body.append(count,list);
  const selected=node('div',field==='元素'?'element-list':'chips');selected.setAttribute('aria-label',field+'已选项');selected.setAttribute('role','region');selected.tabIndex=0;
  const row=node('div','custom-row'),input=node('input');input.placeholder=field==='元素'?'自定义元素，例如：星沙云脊':'自定义题材';input.setAttribute('aria-label','自定义'+field);input.maxLength=1000;const add=node('button','small-button','添加');add.type='button';
  function change(items){const joined=[...new Set(items)].join('；');if(joined.length>3000||items.length>100){onNotice('最多选择 100 项且总长度不超过 3000 字。');return;}commit({[field]:joined});refresh();}
  const addValue=()=>{const value=input.value.trim();if(value){change([...listItems(getDraft()[field]),...listItems(value)]);input.value='';}};add.addEventListener('click',addValue);input.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();addValue();}});pending.push(addValue);row.append(input,add);
  const clearPending=()=>{input.value='';details.open=false;};
  function renderOptions(){
   const topics=listItems(getDraft()['题材']);const groups=optionGroups(field==='元素'?'必须包含':field,topics).filter(([name])=>field!=='元素'||!['空间与尺度','服装配色'].includes(name));const old=category.value;
   category.replaceChildren(new Option('全部分类',''),...groups.map(([g])=>new Option(g,g)));category.value=groups.some(([g])=>g===old)?old:'';
   const filtered=filterGroups(groups,search.value,category.value);count.textContent=`${new Set(filtered.flatMap(x=>x[1])).size} 个候选 · 仅勾选项进入画面`;const top=list.scrollTop;list.replaceChildren();
   const values=listItems(getDraft()[field]);for(const [name,items] of filtered){const group=node('div','option-group');group.append(node('div','group-title',name));const opts=node('div','options');for(const v of items){const label=node('label','option'),box=node('input');box.type='checkbox';box.checked=values.includes(v);box.addEventListener('change',()=>change(box.checked?[...values,v]:values.filter(x=>x!==v)));label.append(box,document.createTextNode(v));opts.append(label);}group.append(opts);list.append(group);}list.scrollTop=top;
  }
  search.addEventListener('input',renderOptions);category.addEventListener('change',renderOptions);
  function draw(){
   const values=listItems(getDraft()[field]);summary.textContent=values.length?`已选 ${values.length} 项 · 点击调整`:`选择${field}或添加自定义`;
   const top=selected.scrollTop;selected.replaceChildren();for(const name of values){
    const chip=node('div',field==='元素'?'element-item':'chip'),head=node('div','element-head');head.append(node('span','',name));const remove=node('button','element-remove','×');remove.type='button';remove.setAttribute('aria-label','移除'+name);remove.addEventListener('click',()=>change(values.filter(v=>v!==name)));head.append(remove);chip.append(head);
    if(field==='元素'){
     const attr=node('details','element-attributes'),title=node('summary','', '角色、动作与空间');const controls=node('div','attribute-grid');attr.append(title,controls);
     const setting=()=>getDraft().elementSettings.find(s=>s.name===name)||{};
     const labels={gender:'性别（人物适用）',role:'角色',scale:'相对尺度',frame:'画面占比',count:'对象数量',action:'动作',position:'画面位置',depth:'前后层次',relation:'关系',target:'关系对象'};
     // Attribute controls have their own lifetime; do not retain detached sync callbacks.
     const before=syncers.length;
     for(const [key,options] of Object.entries(ATTRIBUTE_OPTIONS).filter(([key])=>key!=='gender'||supportsCharacterGender(name)||Object.hasOwn(setting(),'gender')))select(controls,name+' · '+labels[key],options,()=>setting()[key]||'自动',v=>{onChange(setElementSetting(getDraft(),name,key,v));updateTitle();},!['role','scale'].includes(key));
     select(controls,name+' · 关系对象',['',...values.filter(v=>v!==name)],()=>setting().target||'',v=>{onChange(setElementSetting(getDraft(),name,'target',v));updateTitle();});
     syncers.splice(before);
     const updateTitle=()=>{const s=setting();title.textContent=Object.keys(labels).filter(k=>s[k]&&s[k]!=='自动').map(k=>`${labels[k]}：${s[k]}`).join(' · ')||(supportsCharacterGender(name)?'性别、角色、动作与空间 · 自动设计':'角色、动作与空间 · 自动设计');};updateTitle();chip.append(attr);
    }selected.append(chip);
   }selected.scrollTop=top;renderOptions();
  }
  syncers.push(draw);parent.append(details,selected,row);return clearPending;
 }
 const resets=[];const clearers={};
 PANEL_FIELDS.forEach((field,index)=>{
  const card=node('section','condition-card field'),head=node('div','field-head');head.append(node('span','field-num',String(index+1).padStart(2,'0')),node('h2','',field),node('span','field-hint',hints[field]));const clear=node('button','field-clear',field==='数量'?'重置':'清空');clear.type='button';clear.setAttribute('aria-label','清空'+field);clear.title=field==='大致说明'?'清空补充说明，并恢复默认设计自由度':'仅清空本面板';clear.addEventListener('click',()=>{onChange(clearField(getDraft(),field));clearers[field]?.();refresh();});head.append(clear);card.append(head);const body=node('div','card-content');card.append(body);host.append(card);
  if(['题材','元素'].includes(field)){
   clearers[field]=choices(body,field);resets.push(clearers[field]);
   if(field==='题材'){
    const region=node('div','region-control');region.append(node('div','region-label','地域（可选）'));
    const buttons=node('div','region-options');buttons.setAttribute('role','group');buttons.setAttribute('aria-label','地域');
    for(const value of REGIONS){
     const button=node('button','region-option',value);button.type='button';button.title='单选，再次点击取消';
     button.addEventListener('click',()=>{commit({'地域':getDraft()['地域']===value?'':value});refresh();});
     syncers.push(()=>button.setAttribute('aria-pressed',String(getDraft()['地域']===value)));buttons.append(button);
    }
    region.append(buttons,node('p','region-hint','单选，再次点击可取消'));body.append(region);
   }else body.append(node('p','field-help','展开人物可选择性别；动作、位置、层次和关系默认自动设计，可手动锁定。未选择人物时，不自动添加人物。'));
  }
  else if(GROUPS[field]){
   const parts=()=>Object.fromEntries(listItems(getDraft()[field]).map(v=>{const i=v.indexOf('：');return [v.slice(0,i),v.slice(i+1)];}));
   for(const [group,opts] of GROUPS[field])select(body,group,['',...opts],()=>parts()[group]||'',v=>{const p=parts();if(v)p[group]=v;else delete p[group];commit({[field]:Object.entries(p).map(([k,v])=>k+'：'+v).join('；')});},true);
   if(field==='镜头'){const button=node('button','small-button','大远景 + 超广角');button.type='button';button.addEventListener('click',()=>{const p=parts();commit({[field]:Object.entries({...p,'景别':'大远景','视野':'超广角'}).map(([k,v])=>k+'：'+v).join('；')});refresh();});body.append(button);}
   if(field==='风格与复杂度')body.append(node('p','field-help','简约控制内容疏密，仍可保留细腻材质；密集不等于自动增加生物或建筑。'));
  }else if(field==='大致说明'){
   textInput(body,'大致说明',()=>getDraft()[field],v=>commit({[field]:v}),'可留空；动作与空间由模型自动设计。仅补充你的特殊要求。',true);
   const options=node('details','design-options');options.append(node('summary','','设计自由度'));body.append(options);
   const set=(key,v)=>commit({designOptions:{...getDraft().designOptions,[key]:v}});
   select(options,'设计方式',['自动设计','随机探索'],()=>getDraft().designOptions.exploration,v=>set('exploration',v));
   select(options,'元素使用',['全部包含','选配'],()=>getDraft().designOptions.selectionMode,v=>set('selectionMode',v));
   const label=node('label','checkbox-line'),box=node('input');box.type='checkbox';box.addEventListener('change',()=>set('allowExtra',box.checked));label.append(box,document.createTextNode('允许补充额外辅助对象（不自动加人物）'));options.append(label);syncers.push(()=>box.checked=getDraft().designOptions.allowExtra);
  }else{
   const opts=field==='构图'?['',...COMPOSITIONS]:field==='目标模型'?['','Midjourney','OpenAI 图像模型','FLUX','Stable Diffusion','Imagen']:field==='画幅'?['','16:9','9:16','1:1','4:3','3:4','3:2','2:3','21:9']:Array.from({length:10},(_,i)=>(i+1)+'条');
   select(body,field,opts,()=>getDraft()[field],v=>commit({[field]:v}),field!=='数量');
   if(field==='数量'){const row=node('div','count-shortcuts');for(const n of [1,3,5,7,9]){const button=node('button','small-button',String(n));button.type='button';button.setAttribute('aria-label',n+'个方案');button.addEventListener('click',()=>{commit({数量:n+'条'});refresh();});row.append(button);}body.append(row,node('p','field-help','每个方案一对完整中英文；这里不控制画面中的人数或物件数量。'));}
   if(field==='目标模型')body.append(node('p','field-help','出图模型与右上角文本接口独立。清空后使用通用自然语言，自定义模型按已核实规则适配。'));
  }
 });
 const negative=node('div','negative-field');textInput(negative,'负面提示词',()=>getDraft()['负面提示词'],v=>commit({'负面提示词':v}),'清空即不添加负面要求',true);const clear=node('button','field-clear','清空负面');clear.type='button';clear.addEventListener('click',()=>{commit({'负面提示词':''});refresh();});negative.append(clear);negativeHost.append(negative);
 refresh();return {sync(){resets.forEach(fn=>fn());refresh();},flush(){pending.forEach(fn=>fn());},pickers};
}
