import {loadKeys,saveKeys,clearKeys,closeOutsidePickers,wireAccordion} from './ui.mjs';
import {FIELDS,COUNTS,catalogGroups,filterGroups,OPTIONS,emptyBrief,normalizeBrief,briefText,targetText,snapshot,readBackup,toggleChoice,restoreDraft,MAX_BACKUP_BYTES} from './core.mjs';
const $=s=>document.querySelector(s);
const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
const STORAGE='scene-forge-workspace-v1';
let draft=emptyBrief(),presets=[],history=[],provider='openai',profiles={openai:{model:''},deepseek:{model:''}},keys={openai:'',deepseek:''},config=null,busy=false,visibleResult=null,dialogProvider='openai';
const picks={};
function notify(message){$('#notice').textContent=message;$('#notice').hidden=!message;}
function load(){
 try{const raw=localStorage.getItem(STORAGE);if(!raw)return;const saved=JSON.parse(raw);const clean=readBackup(JSON.stringify(saved));({draft,presets,history}=clean);history=history.slice(0,30);provider=['openai','deepseek'].includes(saved.provider)?saved.provider:'openai';for(const p of ['openai','deepseek'])if(typeof saved.profiles?.[p]?.model==='string')profiles[p].model=saved.profiles[p].model.slice(0,200);}
 catch{notify('浏览器记录无法读取，已使用空白表单。若有导出备份，可通过“恢复备份”找回。');}
}
function backup(){return {format:'scene-forge-backup-v1',draft:normalizeBrief(draft),presets,history};}
function persist(){try{localStorage.setItem(STORAGE,JSON.stringify({...backup(),provider,profiles}));}catch{notify('浏览器未能保存记录（可能空间不足或存储被禁用）。当前页面仍可使用，请导出备份。');}}
function values(field){return draft[field].split('；').map(x=>x.trim()).filter(Boolean);}
function update(field,items){draft[field]=[...new Set(items)].join('；');renderPicker(field);if(field==='题材'){renderPicker('想画什么');renderPicker('必须包含');}else if(field==='想画什么'){renderPicker('必须包含');}refresh();persist();}
const hints={'题材':'可混合 · 多选','想画什么':'主体、动作或场景','必须包含':'不可遗漏的要求','视觉偏好':'媒介、时间、光色','画幅':'宽高比','目标模型':'用于出图','数量':'每条含中英各一份','创作自由度':'允许模型设计的部分'};
const placeholders={'题材':'选择一个或多个题材','想画什么':'选择场景，或写下你的想法','必须包含':'选择画面中必须出现的元素','视觉偏好':'选择媒介、时间与光色','创作自由度':'选择开放给模型的设计空间'};
const customHints={'题材':'添加自己的题材，例如：海底文明','想画什么':'补充主体与动作，例如：仙女眺望远山','必须包含':'补充元素、数量、关系或必须保留的细节','视觉偏好':'添加具体偏好，例如：低机位、浅景深','创作自由度':'补充允许变化或必须固定的设计'};
function createField(field,index){
 if(field==='负面提示词'){
  const wrap=el('div','negative-field');const head=el('div','negative-head');const label=el('label','',field);label.htmlFor='negative-prompt';head.append(label,el('span','','可修改或清空'));
  const input=el('textarea');input.id='negative-prompt';input.rows=2;input.maxLength=3000;input.setAttribute('aria-label',field);input.value=draft[field];
  input.addEventListener('input',()=>{draft[field]=input.value;refresh();persist();});picks[field]={sync:()=>{input.value=draft[field];}};wrap.append(head,input);return wrap;
 }
 const wrap=el('div','field condition-card');const head=el('div','field-head');head.append(el('span','field-num',String(index+1).padStart(2,'0')));const label=el('label','',field);head.append(label,el('span','field-hint',hints[field]));wrap.append(head);
 if(['画幅','目标模型','数量'].includes(field)){
  const select=el('select');select.id='field-'+index;select.setAttribute('aria-label',field);label.htmlFor=select.id;
  const opts=field==='画幅'?['','16:9','9:16','1:1','4:3','3:4','3:2','2:3','21:9']:field==='目标模型'?['','Midjourney','OpenAI 图像模型','FLUX','Stable Diffusion','Imagen']:COUNTS;
  opts.forEach(v=>{const o=el('option','',field==='数量'?v.replace('条',' 个方案 · 中英各一份'):(v||(field==='目标模型'?'通用自然语言（未指定）':'由模型设计')));o.value=v;select.append(o)});
  if(field!=='数量'){const o=el('option','','自定义…');o.value='__custom';select.append(o)}
  const input=el('input');input.className='custom-select';input.hidden=true;input.placeholder=field==='画幅'?'例如 5:4':'图像模型与版本';input.setAttribute('aria-label','自定义'+field);input.maxLength=200;
  const set=()=>{const custom=!!draft[field]&&!opts.includes(draft[field]);select.value=custom?'__custom':draft[field];input.hidden=!custom;input.value=custom?draft[field]:'';};
  select.addEventListener('change',()=>{const custom=select.value==='__custom';input.hidden=!custom;draft[field]=custom?input.value:select.value;if(custom)input.focus();refresh();persist()});
  input.addEventListener('input',()=>{draft[field]=input.value;refresh();persist()});picks[field]={sync:set};wrap.append(select,input);const help={'画幅':'选择最终图片的宽高比。像素尺寸与镜头不会被此选项固定。','目标模型':'按所选出图模型适配；可自填版本。未指定时用通用描述。文本接口在右上角配置。','数量':'每个方案包含中文与英文各一份。方案之间将设计实质差异。'};wrap.append(el('p','field-help',help[field]));set();
 }else{
  const details=el('details','picker');const summary=el('summary');summary.id='field-'+index;summary.setAttribute('aria-label',field);label.htmlFor=summary.id;const body=el('div','picker-body');details.append(summary,body);
  const chips=el('div','chips');const row=el('div','custom-row');const input=el('input');input.placeholder=customHints[field];input.setAttribute('aria-label','自定义'+field);input.maxLength=1000;const add=el('button','small-button','添加');add.type='button';
  const addValue=()=>{const value=input.value.trim();if(!value)return;const next=[...values(field),value];if(next.join('；').length>3000){notify('这一项超过 3000 字，请精简后添加。');return;}update(field,next);input.value='';};
  add.addEventListener('click',addValue);input.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();addValue()}});row.append(input,add);wrap.append(details,chips,row);picks[field]={details,summary,body,chips,input,addValue};
 }
 return wrap;
}
function renderPicker(field){
 const picker=picks[field];if(!picker)return;if(picker.sync){picker.sync();return;}
 const selected=values(field);picker.summary.textContent=selected.length?`已选 ${selected.length} 项 · 点击调整`:placeholders[field];picker.chips.replaceChildren();
 selected.forEach(v=>{const chip=el('span','chip');chip.append(el('span','',v));const remove=el('button','','×');remove.type='button';remove.setAttribute('aria-label','移除'+v);remove.addEventListener('click',()=>update(field,values(field).filter(x=>x!==v)));chip.append(remove);picker.chips.append(chip)});
 renderOptions(field);
}
function renderOptions(field){
 const picker=picks[field];
 if(!picker.search){
  const tools=el('div','picker-tools');const search=el('input');search.type='search';search.placeholder='搜索选项或分类';search.setAttribute('aria-label','搜索'+field);search.maxLength=100;
  const category=el('select');category.setAttribute('aria-label',field+'分类');const list=el('div','picker-list');const count=el('div','picker-count');count.setAttribute('aria-live','polite');
  tools.append(search,category);picker.body.append(tools,count,list);Object.assign(picker,{search,category,list,count});
  search.addEventListener('input',()=>renderOptions(field));category.addEventListener('change',()=>{renderOptions(field);list.scrollTop=0;});
 }
 let groups=OPTIONS[field];
 if(field==='想画什么'||field==='必须包含'){
  const linked=catalogGroups(field,values('题材'),draft['想画什么']);
  groups=[...linked,...OPTIONS[field]];
 }
 const previous=picker.category.value;
 picker.category.replaceChildren(new Option('全部分类',''),...groups.map(([title])=>new Option(title,title)));
 picker.category.value=groups.some(([title])=>title===previous)?previous:'';
 const filtered=filterGroups(groups,picker.search.value,picker.category.value);
 const total=new Set(groups.flatMap(g=>g[1])).size;const found=new Set(filtered.flatMap(g=>g[1])).size;
 picker.count.textContent=`显示 ${found} / ${total} 项 · 勾选后加入条件`;
 const top=picker.list.scrollTop;picker.list.replaceChildren();const selected=values(field);
 filtered.forEach(([title,opts])=>{
  const group=el('div','option-group');group.append(el('div','group-title',title));const items=el('div','options');
  opts.forEach(v=>{const label=el('label','option');const input=el('input');input.type='checkbox';input.checked=selected.includes(v);input.addEventListener('change',()=>{
   let next=toggleChoice(values(field),v,false);
   if(input.checked){if(field==='创作自由度')next=next.filter(x=>v==='其余由你设计'||v==='严格遵循已填要求，仅补齐缺项'?false:!['其余由你设计','严格遵循已填要求，仅补齐缺项'].includes(x));next=toggleChoice(next,v,true);}
   if(next.join('；').length>3000){input.checked=false;notify('这一项超过 3000 字，请精简后选择。');return;}
   update(field,next);
  });label.append(input,document.createTextNode(v));items.append(label)});group.append(items);picker.list.append(group);
 });
 if(!filtered.length)picker.list.append(el('p','picker-empty','没有匹配项。可清除搜索、切换分类，或在卡片底部添加自定义内容。'));
 picker.list.scrollTop=top;
}

function refresh(){
 $('#brief-preview').textContent=briefText(draft);
 const ready=!!(keys[provider]&&profiles[provider].model);$('#connection-label').textContent=ready?`${provider==='openai'?'OpenAI':'DeepSeek'} 已配置`:'配置模型接口';$('#settings-open').classList.toggle('connected',ready);
 $('#generator-label').textContent=profiles[provider].model?`${provider==='openai'?'OpenAI':'DeepSeek'} / ${profiles[provider].model}`:'尚未配置文本模型';
 $('#dock-count').textContent=draft['数量'].replace('条',' 个方案')+' · 中英双语';
 $('#generate').disabled=busy||!config;
 $('#generate').firstElementChild.textContent=busy?'正在设计双语提示词…':'生成双语提示词';
}
function renderForm(){FIELDS.forEach(renderPicker);refresh();}
function pendingInputs(){for(const p of Object.values(picks))if(p.input?.value.trim()&&p.addValue)p.addValue();}
function renderLibrary(){
 const select=$('#preset-select');select.replaceChildren(new Option('选择已保存的创作要求',''));presets.forEach(p=>select.append(new Option(p.name,p.id)));
 $('#history-count').textContent=history.length;const list=$('#history-list');list.replaceChildren();if(!history.length)list.append(el('p','history-empty','还没有生成记录。你的下一次灵感会留在这里。'));
 history.slice(0,5).forEach(item=>{const row=el('div','history-item');const b=el('button','history-link');b.append(el('strong','',item.schemes[0].name||item.brief['题材']||'未命名方案'));b.append(el('small','',`${new Date(item.createdAt).toLocaleString('zh-CN',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})} · ${item.schemes.length} 对 · ${item.spec.version}`));b.addEventListener('click',()=>{renderResults(item)});const del=el('button','text-button','删除');del.addEventListener('click',()=>{if(confirm('删除这条本地生成记录？')){history=history.filter(x=>x.id!==item.id);persist();renderLibrary();}});row.append(b,del);list.append(row)});
 if(history.length>5){const all=el('details','request-snapshot');all.append(el('summary','',`查看其余 ${history.length-5} 条`));history.slice(5).forEach(item=>{const b=el('button','text-button',item.schemes[0].name||item.createdAt);b.addEventListener('click',()=>renderResults(item));all.append(b,el('br'))});list.append(all)}
}
async function copy(text,button){
 try{await navigator.clipboard.writeText(text);const old=button.textContent;button.textContent='已复制';setTimeout(()=>button.textContent=old,1500)}
 catch{const area=el('textarea');area.value=text;document.body.append(area);area.select();try{if(!document.execCommand('copy'))throw new Error();notify('已复制。')}catch{notify('浏览器不允许自动复制，请选中提示词文字手动复制。')}area.remove()}
}
function download(name,text,type='text/plain;charset=utf-8'){
 const url=URL.createObjectURL((text instanceof Blob?text:new Blob([text],{type})));const a=el('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function resultMarkdown(result){return `# 提示词方案\n\n生成时间：${result.createdAt}\n规范：${result.spec.version} / SHA-256 ${result.spec.sha256}\n文本生成模型：${result.provider} / ${result.model}\n\n${targetText(result.target)}\n\n## 本次输入\n\n${briefText(result.brief)}\n\n`+result.schemes.map((s,i)=>`## ${i+1}. ${s.name}\n\n${s.concept}\n\n画面规格：${s.specs}\n\n### 中文提示词\n\n${s.zh}\n\n### English Prompt\n\n${s.en}\n\n模型配置：${s.config}\n\n待验证：${s.checks}`).join('\n\n');}
function renderResults(result){
 visibleResult=result;$('#view-results').hidden=false;$('#library-dialog').close();if(!$('#results-dialog').open)$('#results-dialog').showModal();const host=$('#results');host.replaceChildren();const head=el('div','results-head');const title=el('div');title.append(el('span','eyebrow','BILINGUAL PROMPTS'),el('h2','',`${result.schemes.length} 个方案，${result.schemes.length} 对中英文`),el('p','',`${result.provider} / ${result.model} · 规范 ${result.spec.version} · ${new Date(result.createdAt).toLocaleString('zh-CN')}`));const save=el('button','button outline','下载全部 .md');save.addEventListener('click',()=>download('双语提示词-'+result.createdAt.slice(0,10)+'.md',resultMarkdown(result)));const actions=el('div','result-actions');const copyAll=el('button','button primary','复制全部提示词');copyAll.addEventListener('click',()=>copy(result.schemes.map((s,i)=>`方案 ${i+1} · ${s.name}\n\n中文提示词\n${s.zh}\n\nEnglish Prompt\n${s.en}`).join('\n\n────────\n\n'),copyAll));const separate=el('button','button outline','下载全部（单独）');separate.addEventListener('click',async()=>{separate.disabled=true;try{const files=result.schemes.map((s,i)=>({name:s.name,content:resultMarkdown({...result,schemes:[s]})}));const response=await fetch('/api/export',{method:'POST',headers:{'Content-Type':'application/json','X-Local-Token':config.token},body:JSON.stringify({files})});if(!response.ok){const err=await response.json();throw new Error(err.error||'下载失败');}download('双语提示词-独立文件.zip',await response.blob());}catch(e){$('#generation-status').textContent='独立文件下载失败：'+e.message;}finally{separate.disabled=false;}});actions.append(copyAll,save,separate);head.append(title,actions);host.append(head);
 const source=el('details','request-snapshot');source.append(el('summary','',`查看输入、模型适配与官方来源 · SHA-256 ${result.spec.sha256.slice(0,12)}…`),el('pre','',briefText(result.brief)+'\n\n'+targetText(result.target)+'\n\n规范 SHA-256：'+result.spec.sha256));const restore=el('button','text-button','将这次输入恢复到表单');restore.addEventListener('click',()=>{if(confirm('用这条历史输入替换当前表单？')){draft=restoreDraft(result.brief,picks);renderForm();persist();$('#results-dialog').close();}});source.append(restore);host.append(source);
 const rows=[];
 result.schemes.forEach((s,i)=>{
  const card=el('article','scheme-item');const header=el('div','scheme-header');const title=el('button','scheme-title');title.type='button';title.title=s.name;title.append(el('span','scheme-num',String(i+1).padStart(2,'0')),el('span','scheme-name',s.name));
  const controls=el('div','scheme-actions');for(const [label,key] of [['复制中文','zh'],['复制英文','en']]){const b=el('button','small-button',label);b.setAttribute('aria-label',`方案${i+1}${label}`);b.addEventListener('click',()=>copy(s[key],b));controls.append(b);}
  const toggle=el('button','scheme-toggle');toggle.type='button';controls.append(toggle);header.append(title,controls);
  const panel=el('div','scheme-panel');panel.id=`scheme-panel-${i}`;title.setAttribute('aria-controls',panel.id);toggle.setAttribute('aria-controls',panel.id);panel.append(el('p','scheme-concept',s.concept),el('div','result-meta',s.specs));
  const pair=el('div','bilingual');for(const [label,key] of [['中文提示词','zh'],['English Prompt','en']]){const col=el('section','prompt-column');col.append(el('h3','',label),el('pre','',s[key]));pair.append(col);}
  const copyPair=el('button','button outline copy-pair','复制整条 · 中文 + English');copyPair.addEventListener('click',()=>copy(`中文提示词\n${s.zh}\n\nEnglish Prompt\n${s.en}`,copyPair));panel.append(pair,copyPair,el('div','result-notes',`模型配置 · ${s.config}\n差异与待验证 · ${s.checks}`));card.append(header,panel);host.append(card);rows.push({title,toggle,panel});
 });wireAccordion(rows);
}
async function api(path,body){
 const response=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json','X-Local-Token':config.token},body:JSON.stringify(body)});
 const result=await response.json();if(!response.ok)throw new Error(result.error||'请求失败，请重试。');return result;
}
function readDialog(){profiles[dialogProvider].model=$('#model-id').value.trim();keys[dialogProvider]=$('#api-key').value.trim();}
function fillDialog(){dialogProvider=$('#provider').value;$('#api-key').value=keys[dialogProvider];$('#model-id').value=profiles[dialogProvider].model;$('#endpoint').textContent=config?.providers[dialogProvider]||'';$('#models').replaceChildren();$('#settings-status').textContent='';}
$('#settings-open').addEventListener('click',()=>{$('#provider').value=provider;fillDialog();$('#settings').showModal();});
$('#settings-close').addEventListener('click',()=>$('#settings').close());
$('#provider').addEventListener('change',()=>{readDialog();fillDialog()});
$('#settings-save').addEventListener('click',()=>{readDialog();provider=dialogProvider;try{saveKeys(localStorage,keys);}catch{$('#settings-status').textContent='密钥未能保存到本地，请检查浏览器存储权限。当前页面仍可使用，但刷新会丢失。';refresh();return;}persist();refresh();$('#settings').close();});
$('#clear-saved-keys').addEventListener('click',()=>{try{clearKeys(localStorage);keys={openai:'',deepseek:''};$('#api-key').value='';refresh();$('#settings-status').textContent='两个服务商的本地密钥已清除。';}catch{$('#settings-status').textContent='清除失败，请检查浏览器存储权限。';}});
$('#load-models').addEventListener('click',async()=>{
 if(!config){$('#settings-status').textContent='本地服务尚未连接。请刷新页面。';return;}
 readDialog();const p=dialogProvider;const button=$('#load-models');button.disabled=true;$('#provider').disabled=true;$('#settings-status').textContent='正在验证连接并读取模型列表…';
 try{const r=await api('/api/models',{provider:p,key:keys[p]});if(dialogProvider!==p)return;$('#models').replaceChildren(...r.models.map(m=>new Option(m,m)));$('#settings-status').textContent=`连接成功，获取 ${r.models.length} 个模型。点击模型输入框选择可用的文本模型。`;}
 catch(e){$('#settings-status').textContent=e.message;}finally{button.disabled=false;$('#provider').disabled=false;}
});
$('#generate').addEventListener('click',async()=>{
 pendingInputs();if(!keys[provider]||!profiles[provider].model){$('#settings-open').click();$('#settings-status').textContent='请填写 API Key 和文本模型 ID。';return;}
 if(!draft['题材'].trim()&&!draft['想画什么'].trim()){notify('请先选择题材，或填写你想画什么。');return;}
 busy=true;notify('');refresh();$('#results').replaceChildren(el('div','loading-result','✦ 正在根据九项条件设计画面，并生成中英文提示词…'));$('#view-results').hidden=false;if(!$('#results-dialog').open)$('#results-dialog').showModal();$('#generation-status').textContent='正在依据完整规范设计。通常需要数十秒；请保持页面打开。';
 const request={provider,model:profiles[provider].model,key:keys[provider],brief:normalizeBrief(draft)};
 try{const out=await api('/api/generate',request);
  if(out.status==='clarification'){$('#results').replaceChildren(el('div','notice','模型需要你调整输入：'+out.questions.join('；')));$('#generation-status').textContent='需要澄清，尚未生成方案。请修改相应字段后重新生成。';return;}
  const item=snapshot(out);history=[item,...history].slice(0,30);persist();renderLibrary();renderResults(item);$('#generation-status').textContent='已生成双语方案。请核对必须项和中英文一致性，实际图像效果尚待出图验证。';
 }catch(e){$('#results').replaceChildren(el('div','notice',e.message||'本地服务连接失败，请检查启动终端。'));$('#generation-status').textContent='生成失败，当前输入已保留；关闭弹窗后可手动重试。历史结果仍在记录中。';}finally{request.key='';busy=false;refresh();}
});
$('#brief-form').addEventListener('submit',e=>e.preventDefault());
$('#copy-brief').addEventListener('click',e=>{pendingInputs();copy(briefText(draft),e.currentTarget)});
$('#reset').addEventListener('click',()=>{if(confirm('重置九项输入并恢复默认负面提示词？已保存预设和历史结果会保留。')){draft=emptyBrief();for(const p of Object.values(picks))if(p.addValue)p.input.value='';renderForm();persist();}});
$('#save-preset').addEventListener('click',()=>{pendingInputs();$('#preset-name').value=draft['题材'].slice(0,40);$('#name-dialog').showModal();});
$('#name-cancel').addEventListener('click',()=>$('#name-dialog').close());
$('#name-save').addEventListener('click',()=>{const name=$('#preset-name').value.trim();if(!name){$('#preset-name').focus();return;}if(presets.length>=100){notify('预设已达 100 个，请先导出备份并删除不需要的预设。');return;}presets.push({id:crypto.randomUUID(),name,brief:normalizeBrief(draft)});persist();renderLibrary();$('#name-dialog').close();});
$('#preset-select').addEventListener('change',e=>{const p=presets.find(x=>x.id===e.target.value);if(!p)return;draft=normalizeBrief(p.brief);for(const x of Object.values(picks))if(x.addValue)x.input.value='';renderForm();persist()});
$('#delete-preset').addEventListener('click',()=>{const id=$('#preset-select').value;if(!id)return;if(confirm('删除所选预设？')){presets=presets.filter(x=>x.id!==id);persist();renderLibrary()}});
$('#export').addEventListener('click',()=>{pendingInputs();download('SceneForge-备份-'+new Date().toISOString().slice(0,10)+'.json',JSON.stringify(backup(),null,2),'application/json');});
$('#import').addEventListener('click',()=>$('#import-file').click());
$('#import-file').addEventListener('change',async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>MAX_BACKUP_BYTES)throw new Error('备份文件超过 160 MB，请选择工作台导出的有效备份。');const data=readBackup(await file.text());if(confirm('用此备份替换当前草稿、预设与历史？建议先导出当前记录。')){({draft,presets,history}=data);history=history.slice(0,30);for(const p of Object.values(picks))if(p.addValue)p.input.value='';persist();renderForm();renderLibrary();notify('备份已恢复。接口配置和密钥未被导入。');}}catch(err){notify('恢复失败：'+err.message)}finally{e.target.value=''}});
$('#results-close').addEventListener('click',()=>$('#results-dialog').close());
$('#view-results').addEventListener('click',()=>$('#results-dialog').showModal());
$('#library-open').addEventListener('click',()=>$('#library-dialog').showModal());
$('#library-close').addEventListener('click',()=>$('#library-dialog').close());
document.addEventListener('pointerdown',e=>closeOutsidePickers(Object.values(picks),e.target));
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeOutsidePickers(Object.values(picks),null);});
load();try{keys=loadKeys(localStorage);}catch{notify('无法读取已保存的密钥，请在接口配置中重新填写并保存。');}const host=$('#fields');FIELDS.forEach((field,i)=>(field==='负面提示词'?$('#negative-slot'):host).append(createField(field,i)));renderForm();renderLibrary();
try{const response=await fetch('/api/config');if(!response.ok)throw new Error();config=await response.json();$('#spec-badge').textContent='规范 '+config.spec.version.toUpperCase()+' · 中英双语';refresh();}catch{notify('无法连接本地服务。请双击项目根目录的“启动提示词工作台.command”，再从打开的页面使用。');$('#spec-badge').textContent='服务未连接';}
