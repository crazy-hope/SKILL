import {loadKeys,saveKeys,clearKeys,closeOutsidePickers,wireResultNavigation} from './ui.mjs';
import {topicGuidance,normalizeBrief,briefText,targetText,snapshot,readBackup,MAX_BACKUP_BYTES} from './core.mjs';
import {emptyV2 as emptyBrief,migrateBrief,listItems} from './brief-v2.mjs';
import {createForm} from './form-v2.mjs';
const $=s=>document.querySelector(s);
const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
const STORAGE='scene-forge-workspace-v1';
let draft=emptyBrief(),presets=[],history=[],provider='openai',profiles={openai:{model:''},deepseek:{model:''}},keys={openai:'',deepseek:''},config=null,busy=false,visibleResult=null,dialogProvider='openai';
const picks={};
function notify(message){$('#notice').textContent=message;$('#notice').hidden=!message;}
function load(){
 try{const raw=localStorage.getItem(STORAGE);if(!raw)return;const saved=JSON.parse(raw);const clean=readBackup(JSON.stringify(saved));({draft,presets,history}=clean);draft=migrateBrief(draft);history=history.slice(0,30);provider=['openai','deepseek'].includes(saved.provider)?saved.provider:'openai';for(const p of ['openai','deepseek'])if(typeof saved.profiles?.[p]?.model==='string')profiles[p].model=saved.profiles[p].model.slice(0,200);}
 catch{notify('浏览器记录无法读取，已使用空白表单。若有导出备份，可通过“恢复备份”找回。');}
}
function backup(){return {format:'scene-forge-backup-v2',draft:normalizeBrief(draft),presets,history};}
function persist(){try{localStorage.setItem(STORAGE,JSON.stringify({...backup(),provider,profiles}));}catch{notify('浏览器未能保存记录（可能空间不足或存储被禁用）。当前页面仍可使用，请导出备份。');}}
let form;
function values(field){return listItems(draft[field]);}
function restoreDraft(value){return migrateBrief(value);}
function refresh(){
 $('.intro p').textContent=topicGuidance(values('题材'))||'你定方向，大模型依据规范设计。每个方案，中英文各一份。';
 $('#brief-preview').textContent=briefText(draft);
 const ready=!!(keys[provider]&&profiles[provider].model);$('#connection-label').textContent=ready?`${provider==='openai'?'OpenAI':'DeepSeek'} 已配置`:'配置模型接口';$('#settings-open').classList.toggle('connected',ready);
 $('#generator-label').textContent=profiles[provider].model?`${provider==='openai'?'OpenAI':'DeepSeek'} / ${profiles[provider].model}`:'尚未配置文本模型';
 $('#dock-count').textContent=draft['数量'].replace('条',' 个方案')+' · 中英双语';
 $('#generate').disabled=busy||!config;
 $('#generate').firstElementChild.textContent=busy?'正在设计双语提示词…':'生成双语提示词';
}
function renderForm(){form?.sync();refresh();}
function pendingInputs(){form?.flush();}
function renderLibrary(){
 const select=$('#preset-select');select.replaceChildren(new Option('选择已保存的创作要求',''));presets.forEach(p=>select.append(new Option(p.name,p.id)));
 $('#history-count').textContent=history.length;const list=$('#history-list');list.replaceChildren();if(!history.length)list.append(el('p','history-empty','还没有生成记录。你的下一次灵感会留在这里。'));
 history.slice(0,5).forEach(item=>{const row=el('div','history-item');const b=el('button','history-link');b.append(el('strong','',item.schemes[0].name||item.brief['题材']||'未命名方案'));b.append(el('small','',`${new Date(item.createdAt).toLocaleString('zh-CN',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})} · ${item.schemes.length} 对 · ${item.spec.version}`));b.addEventListener('click',()=>{renderResults(item)});const del=el('button','text-button','删除');del.addEventListener('click',()=>{if(confirm('删除这条本地生成记录？')){history=history.filter(x=>x.id!==item.id);persist();renderLibrary();}});row.append(b,del);list.append(row)});
 if(history.length>5){const all=el('details','request-snapshot');all.append(el('summary','',`查看其余 ${history.length-5} 条`));history.slice(5).forEach(item=>{const b=el('button','text-button',item.schemes[0].name||item.createdAt);b.addEventListener('click',()=>renderResults(item));all.append(b,el('br'))});list.append(all)}
}
async function copyText(text){
 try{await navigator.clipboard.writeText(text);return true;}
 catch{const focus=document.activeElement;const area=el('textarea');area.value=text;area.setAttribute('aria-label','待复制提示词');(document.querySelector('dialog[open]')||document.body).append(area);area.select();let ok=false;try{ok=document.execCommand('copy');}catch{}area.remove();focus?.focus({preventScroll:true});return ok;}
}
async function copy(text,button){
 const ok=await copyText(text);if(!ok){$('#generation-status').textContent='复制失败，请选中提示词文字手动复制。';notify('浏览器不允许自动复制，请选中提示词文字手动复制。');return;}
 const old=button.textContent;button.textContent='已复制';setTimeout(()=>button.textContent=old,1500);
}
function bilingualText(s){return `中文提示词\n${s.zh}\n\nEnglish Prompt\n${s.en}`;}
function download(name,text,type='text/plain;charset=utf-8'){
 const url=URL.createObjectURL((text instanceof Blob?text:new Blob([text],{type})));const a=el('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function resultMarkdown(result){return `# 提示词方案\n\n生成时间：${result.createdAt}\n规范：${result.spec.version} / SHA-256 ${result.spec.sha256}\n文本生成模型：${result.provider} / ${result.model}\n\n${targetText(result.target)}\n\n## 本次输入\n\n${briefText(result.brief)}\n\n`+result.schemes.map((s,i)=>`## ${i+1}. ${s.name}\n\n${s.concept}\n\n画面规格：${s.specs}\n\n### 中文提示词\n\n${s.zh}\n\n### English Prompt\n\n${s.en}\n\n模型配置：${s.config}\n\n待验证：${s.checks}`).join('\n\n');}
function renderResults(result){
 visibleResult=result;$('#view-results').hidden=false;$('#library-dialog').close();if(!$('#results-dialog').open)$('#results-dialog').showModal();const host=$('#results');host.replaceChildren();const head=el('div','results-head');const title=el('div');title.append(el('span','eyebrow','BILINGUAL PROMPTS'),el('h2','',`${result.schemes.length} 个方案，${result.schemes.length} 对中英文`),el('p','',`${result.provider} / ${result.model} · 规范 ${result.spec.version} · ${new Date(result.createdAt).toLocaleString('zh-CN')}`));const save=el('button','button outline','下载全部 .md');save.addEventListener('click',()=>download('双语提示词-'+result.createdAt.slice(0,10)+'.md',resultMarkdown(result)));const actions=el('div','result-actions');const copyAll=el('button','button primary','复制全部提示词');copyAll.addEventListener('click',()=>copy(result.schemes.map((s,i)=>`方案 ${i+1} · ${s.name}\n\n中文提示词\n${s.zh}\n\nEnglish Prompt\n${s.en}`).join('\n\n────────\n\n'),copyAll));const separate=el('button','button outline','下载全部（单独）');separate.addEventListener('click',async()=>{separate.disabled=true;try{const files=result.schemes.map((s,i)=>({name:s.name,content:resultMarkdown({...result,schemes:[s]})}));const response=await fetch('/api/export',{method:'POST',headers:{'Content-Type':'application/json','X-Local-Token':config.token},body:JSON.stringify({files})});if(!response.ok){const err=await response.json();throw new Error(err.error||'下载失败');}download('双语提示词-独立文件.zip',await response.blob());}catch(e){$('#generation-status').textContent='独立文件下载失败：'+e.message;}finally{separate.disabled=false;}});actions.append(copyAll,save,separate);head.append(title,actions);host.append(head);
 const source=el('details','request-snapshot');source.append(el('summary','',`查看输入、模型适配与官方来源 · SHA-256 ${result.spec.sha256.slice(0,12)}…`),el('pre','',briefText(result.brief)+'\n\n'+targetText(result.target)+'\n\n规范 SHA-256：'+result.spec.sha256));const restore=el('button','text-button','将这次输入恢复到表单');restore.addEventListener('click',()=>{if(confirm('用这条历史输入替换当前表单？')){draft=restoreDraft(result.brief,picks);renderForm();persist();$('#results-dialog').close();}});source.append(restore);
 const status=el('p','result-copy-status','点击左侧标题，切换并复制该方案英文提示词。');status.setAttribute('role','status');host.append(status);
 const workspace=el('div','result-workspace');const nav=el('nav','result-nav');nav.setAttribute('aria-label','方案标题列表');nav.tabIndex=0;
 const detail=el('div','result-detail');detail.setAttribute('role','region');detail.setAttribute('aria-label','当前方案详情');detail.tabIndex=0;workspace.append(nav,detail);host.append(workspace);const rows=[];
 result.schemes.forEach((s,i)=>{
  const tag=el('button','result-tag');tag.type='button';tag.id=`result-tag-${i}`;tag.title=`${s.name} · 点击复制英文提示词`;tag.append(el('span','scheme-num',String(i+1).padStart(2,'0')),el('span','result-tag-name',s.name));nav.append(tag);
  const panel=el('article','result-detail-panel');panel.id=`result-detail-${i}`;panel.setAttribute('aria-labelledby',tag.id);tag.setAttribute('aria-controls',panel.id);
  panel.append(el('h3','result-detail-title',s.name));const controls=el('div','detail-copy-actions');
  for(const [label,key] of [['复制中文','zh'],['复制英文','en']]){const b=el('button','small-button',label);b.type='button';b.setAttribute('aria-label',`方案${i+1}${label}`);b.addEventListener('click',()=>copy(s[key],b));controls.append(b);}
  const copyPair=el('button','small-button','复制中英双语');copyPair.type='button';copyPair.addEventListener('click',()=>copy(bilingualText(s),copyPair));controls.append(copyPair);panel.append(controls,el('p','scheme-concept',s.concept),el('div','result-meta',s.specs));
  const pair=el('div','bilingual');for(const [label,key] of [['中文提示词','zh'],['English Prompt','en']]){const col=el('section','prompt-column');col.append(el('h3','',label),el('pre','',s[key]));pair.append(col);}panel.append(pair,el('div','result-notes',`模型配置 · ${s.config}\n差异与待验证 · ${s.checks}`));detail.append(panel);rows.push({button:tag,panel});
 });detail.append(source);let copyEpoch=0;
 wireResultNavigation(rows,async i=>{detail.scrollTop=0;const epoch=++copyEpoch;status.textContent=`正在复制方案 ${i+1} 的英文提示词…`;const ok=await copyText(result.schemes[i].en);if(epoch===copyEpoch)status.textContent=ok?`已复制方案 ${i+1} 的英文提示词`:'复制失败，请使用右侧复制按钮，或选中文字手动复制。';});

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
 if(!draft['题材'].trim()&&!draft['元素'].trim()&&!draft['大致说明'].trim()&&!draft.legacy['场景候选']?.trim()){notify('请先选择题材或元素，或填写大致说明。');return;}
 busy=true;notify('');refresh();$('#results').replaceChildren(el('div','loading-result','✦ 正在根据十个维度设计画面，并生成中英文提示词…'));$('#view-results').hidden=false;if(!$('#results-dialog').open)$('#results-dialog').showModal();$('#generation-status').textContent='正在依据完整规范设计。通常需要数十秒；请保持页面打开。';
 const request={provider,model:profiles[provider].model,key:keys[provider],brief:normalizeBrief(draft)};
 try{const out=await api('/api/generate',request);
  if(out.status==='clarification'){$('#results').replaceChildren(el('div','notice','模型需要你调整输入：'+out.questions.join('；')));$('#generation-status').textContent='需要澄清，尚未生成方案。请修改相应字段后重新生成。';return;}
  const item=snapshot(out);history=[item,...history].slice(0,30);persist();renderLibrary();renderResults(item);$('#generation-status').textContent='已生成双语方案。请核对必须项和中英文一致性，实际图像效果尚待出图验证。';
 }catch(e){$('#results').replaceChildren(el('div','notice',e.message||'本地服务连接失败，请检查启动终端。'));$('#generation-status').textContent='生成失败，当前输入已保留；关闭弹窗后可手动重试。历史结果仍在记录中。';}finally{request.key='';busy=false;refresh();}
});
$('#brief-form').addEventListener('submit',e=>e.preventDefault());
$('#copy-brief').addEventListener('click',e=>{pendingInputs();copy(briefText(draft),e.currentTarget)});
$('#reset').addEventListener('click',()=>{if(confirm('重置十个面板并恢复默认负面提示词？已保存预设和历史结果会保留。')){draft=emptyBrief();for(const p of Object.values(picks))if(p.addValue)p.input.value='';renderForm();persist();}});
$('#save-preset').addEventListener('click',()=>{pendingInputs();$('#preset-name').value=draft['题材'].slice(0,40);$('#name-dialog').showModal();});
$('#name-cancel').addEventListener('click',()=>$('#name-dialog').close());
$('#name-save').addEventListener('click',()=>{const name=$('#preset-name').value.trim();if(!name){$('#preset-name').focus();return;}if(presets.length>=100){notify('预设已达 100 个，请先导出备份并删除不需要的预设。');return;}presets.push({id:crypto.randomUUID(),name,brief:normalizeBrief(draft)});persist();renderLibrary();$('#name-dialog').close();});
$('#preset-select').addEventListener('change',e=>{const p=presets.find(x=>x.id===e.target.value);if(!p)return;draft=restoreDraft(p.brief,picks);renderForm();persist()});
$('#delete-preset').addEventListener('click',()=>{const id=$('#preset-select').value;if(!id)return;if(confirm('删除所选预设？')){presets=presets.filter(x=>x.id!==id);persist();renderLibrary()}});
$('#export').addEventListener('click',()=>{pendingInputs();download('SceneForge-备份-'+new Date().toISOString().slice(0,10)+'.json',JSON.stringify(backup(),null,2),'application/json');});
$('#import').addEventListener('click',()=>$('#import-file').click());
$('#import-file').addEventListener('change',async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>MAX_BACKUP_BYTES)throw new Error('备份文件超过 320 MB，请选择工作台导出的有效备份。');const data=readBackup(await file.text());if(confirm('用此备份替换当前草稿、预设与历史？建议先导出当前记录。')){({draft,presets,history}=data);draft=migrateBrief(draft);history=history.slice(0,30);for(const p of Object.values(picks))if(p.addValue)p.input.value='';persist();renderForm();renderLibrary();notify('备份已恢复。接口配置和密钥未被导入。');}}catch(err){notify('恢复失败：'+err.message)}finally{e.target.value=''}});
$('#results-close').addEventListener('click',()=>$('#results-dialog').close());
$('#view-results').addEventListener('click',()=>$('#results-dialog').showModal());
$('#library-open').addEventListener('click',()=>$('#library-dialog').showModal());
$('#library-close').addEventListener('click',()=>$('#library-dialog').close());
document.addEventListener('pointerdown',e=>closeOutsidePickers(form?.pickers||[],e.target));
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeOutsidePickers(form?.pickers||[],null);});
load();try{keys=loadKeys(localStorage);}catch{notify('无法读取已保存的密钥，请在接口配置中重新填写并保存。');}form=createForm({host:$('#fields'),negativeHost:$('#negative-slot'),getDraft:()=>draft,onChange:value=>{draft=value;refresh();persist();},onNotice:notify});renderForm();renderLibrary();
try{const response=await fetch('/api/config');if(!response.ok)throw new Error();config=await response.json();$('#spec-badge').textContent='规范 '+config.spec.version.toUpperCase()+' · 中英双语';refresh();}catch{notify('无法连接本地服务。请双击项目根目录的“启动提示词工作台.command”，再从打开的页面使用。');$('#spec-badge').textContent='服务未连接';}
