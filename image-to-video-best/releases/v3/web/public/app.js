import { toMarkdown, LEVEL_NAMES } from './result.js';
import { createRevisionGate } from './state.js';
import { assertImageSignature } from './image.js';
import { setupConnection } from './connection.js';
const $=id=>document.getElementById(id);
const form=$('brief-form');
const gate=createRevisionGate();
let config=null,imageData='',imageTicket=0,imageBusy=false,active=null,record=null,toastTimer;
function status(message='',error=false){$('request-status').textContent=message;$('request-status').classList.toggle('error',error);}
function toast(message){clearTimeout(toastTimer);$('toast').textContent=message;$('toast').hidden=false;toastTimer=setTimeout(()=>$('toast').hidden=true,3500);}
function sync(){
  const busy=Boolean(active);
  $('generate-button').disabled=busy||imageBusy||!imageData||!$('idea').value.trim()||!$('platform').value.trim()||!config?.ready;
  $('generate-label').textContent=busy?'正在编排镜头…':'生成镜头提示词';
  $('cancel-button').hidden=!busy;
  $('generate-hint').textContent=!config?.ready?'生成前请点击右上角「配置模型接口」完成本机设置。':imageBusy?'正在读取图片…':!imageData?'上传一张图片，作为镜头的第一帧。':!$('idea').value.trim()?'写下一句话，描述你想发生的变化。':'点击生成后，图片与需求将发送至你配置的模型服务。';
  $('stale-notice').hidden=!record||record.revision===gate.revision;
  $('result-loading').hidden=!busy;
  $('result-empty').hidden=busy||Boolean(record);
  $('result-body').hidden=busy||!record;
  $('copy-all').disabled=!record||busy;
  $('download').disabled=!record||busy;
  $('output-state').textContent=busy?'正在生成':record?(record.revision!==gate.revision?'输入已更新':record.data.result.status==='needs_clarification'?'需要补充':'已完成设计'):'等待灵感';
  $('result-caption').textContent=busy?'正在等待模型返回完整结果':record?'设计与参数分开，可直接复制使用':'生成后可复制正文或导出完整设计';
}
function changed(){
  gate.touch();
  if(active){active.abort();active=null;status('输入已更新，已停止等待旧请求。');}
  sync();
}
form.addEventListener('input',changed);
const connection=setupConnection({onChange(next,modified){
  config=next;
  if(config){$('skill-badge').textContent=`SKILL ${config.skillVersion}`;$('skill-caption').textContent=`基于 Skill ${config.skillVersion} · 仅编写提示词，不直接生成视频`;}
  if(config)$('upload-limit').textContent=`PNG / JPG / WebP · 最大 ${Math.round(config.maxImageBytes/1024/1024*100)/100} MB`;
  if(modified)changed();else sync();
}});
function clearImage(){
  imageData='';$('preview-image').removeAttribute('src');$('image-preview').hidden=true;$('upload-empty').hidden=false;$('image-file').value='';
}
$('remove-image').addEventListener('click',()=>{imageTicket++;imageBusy=false;clearImage();$('image-error').hidden=true;changed();});
function readData(file){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error('图片读取失败，请重新选择。'));reader.readAsDataURL(file);});}
async function selectImage(file){
  if(!file)return;
  const ticket=++imageTicket;
  clearImage();imageBusy=true;$('image-error').hidden=true;changed();
  let url;
  try{
    if(!['image/png','image/jpeg','image/webp'].includes(file.type))throw new Error('请选择 PNG、JPEG 或 WebP 图片。');
    if(file.size>(config?.maxImageBytes??10*1024*1024))throw new Error('图片超过当前大小限制，请选择较小的图片。');
    assertImageSignature(new Uint8Array(await file.slice(0,12).arrayBuffer()),file.type);
    if(ticket!==imageTicket)return;
    url=URL.createObjectURL(file);
    const picture=new Image();picture.src=url;
    await picture.decode();
    if(!picture.naturalWidth||picture.naturalWidth*picture.naturalHeight>80_000_000)throw new Error('图片尺寸无效或超过8000万像素，请缩小图片。');
    const data=await readData(file);
    if(ticket!==imageTicket)return;
    imageData=data;$('preview-image').src=data;
    $('image-info').textContent=`${picture.naturalWidth} × ${picture.naturalHeight} · ${(file.size/1024/1024).toFixed(2)} MB`;
    $('image-preview').hidden=false;$('upload-empty').hidden=true;
    status('首帧已就绪。补充你的想法，即可开始设计。');
  }catch(e){
    if(ticket!==imageTicket)return;
    $('image-error').textContent=e instanceof DOMException?'图片无法解码，请重新导出或选择其他图片。':e.message;
    $('image-error').hidden=false;
  }finally{
    if(url)URL.revokeObjectURL(url);
    if(ticket===imageTicket){imageBusy=false;sync();}
  }
}
$('image-file').addEventListener('change',event=>selectImage(event.target.files[0]));
const drop=$('drop-zone');
for(const event of ['dragenter','dragover'])drop.addEventListener(event,e=>{e.preventDefault();drop.classList.add('dragging');});
for(const event of ['dragleave','drop'])drop.addEventListener(event,e=>{e.preventDefault();drop.classList.remove('dragging');});
drop.addEventListener('drop',e=>{
  if(e.dataTransfer.files.length!==1){$('image-error').textContent='首版每次使用一张首帧图片，请选择一张。';$('image-error').hidden=false;return;}
  selectImage(e.dataTransfer.files[0]);
});
$('use-example').addEventListener('click',()=>{$('idea').value='人物缓缓抬起一只手，周围水流与发丝持续轻柔回旋。镜头保持稳定，最后收势凝望；只保留环境音，不要配乐。';changed();$('idea').focus();});
function payload(){
  const details={};for(const field of form.querySelectorAll('[data-detail]'))details[field.dataset.detail]=field.value.trim();
  return {version:config.skillVersion,image:imageData,videoModel:$('video-model').value,platform:$('platform').value.trim(),idea:$('idea').value.trim(),duration:Number($('duration').value),aspectRatio:$('aspect-ratio').value,level:form.querySelector('[name=level]:checked').value,details};
}
form.addEventListener('submit',async e=>{
  e.preventDefault();
  if(active||imageBusy)return;
  if(!form.reportValidity())return;
  if(!imageData){status('请先上传一张首帧图片。',true);return;}
  if(!config?.ready){connection.open();status('请先完成模型接口配置。',true);return;}
  const ticket=gate.begin(),controller=new AbortController();active=controller;
  const data=payload();status('正在发送图片与创作需求…');sync();
  try{
    const response=await fetch('/api/generate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data),signal:controller.signal});
    const received=await response.json();
    if(!gate.current(ticket))return;
    if(!response.ok)throw new Error(received.error?.message||'生成失败，请稍后重试。');
    record={revision:ticket.revision,data:received};renderResult(received);activateTab('prompt');
    status(received.result.status==='needs_clarification'?'请根据右侧问题补充需求后重新生成。':'镜头设计已完成，可以复制正文或导出完整结果。');
    if(window.innerWidth<761)$('output-heading').scrollIntoView({behavior:'smooth',block:'start'});
  }catch(error){
    if(gate.current(ticket)&&!controller.signal.aborted)status(error instanceof SyntaxError?'服务返回格式异常，请确认本机服务仍在运行。':error.message==='Failed to fetch'?'无法连接本机服务，请检查网络或启动终端。':error.message,true);
  }finally{if(active===controller){active=null;sync();}}
});
$('cancel-button').addEventListener('click',()=>{if(active){active.abort();active=null;gate.touch();status('已停止等待本次结果。模型服务可能已经开始处理请求。');sync();}});
function addList(element,items,empty='无额外未确认项。'){
  element.replaceChildren();for(const text of (items.length?items:[empty])){const li=document.createElement('li');li.textContent=text;element.append(li);}
}
function renderResult({result:r,metadata:m}){
  $('result-meta').replaceChildren();for(const text of [m.videoModel,`${m.duration} 秒`,`${LEVEL_NAMES[r.level]}档`,`${m.skillVersion} · 资料快照`]){const span=document.createElement('span');span.textContent=text;$('result-meta').append(span);}
  $('prompt-output').value=r.prompt;$('prompt-output').hidden=!r.prompt;$('copy-prompt').disabled=!r.prompt;
  $('prompt-label').textContent=r.status==='needs_clarification'?'补充信息后继续设计':'可复制提示词';
  $('submission-section').hidden=!r.submissionPrompt;$('submission-output').value=r.submissionPrompt;
  $('design-reason').textContent=r.designReason;
  $('settings-list').replaceChildren();
  for(const s of r.settings){const row=document.createElement('div');row.className='setting-item';const name=document.createElement('span');name.className='setting-name';name.textContent=s.name;const value=document.createElement('div');value.className='setting-value';const text=document.createElement('div');text.textContent=s.value;const tag=document.createElement('span');tag.className='setting-status';tag.textContent=s.status;value.append(text,tag);row.append(name,value);$('settings-list').append(row);}
  if(!r.settings.length)$('settings-list').textContent='本次无额外设置。';
  $('omissions-section').hidden=!r.omissions.length;addList($('omissions'),r.omissions);
  $('clarification-section').hidden=!r.clarificationQuestions.length;addList($('clarifications'),r.clarificationQuestions);
  addList($('uncertainties'),r.uncertainties);
  $('evidence-date').textContent=`资料核查日期：${m.snapshotDate} · Skill ${m.skillVersion} · 平台：${m.platform}`;
  $('sources').replaceChildren();for(const s of m.sources){const li=document.createElement('li');const a=document.createElement('a');a.textContent=s.title;a.href=s.url;a.target='_blank';a.rel='noopener noreferrer';li.append(a);$('sources').append(li);}
}
function activateTab(name){
  for(const tab of document.querySelectorAll('[data-tab]')){const selected=tab.dataset.tab===name;tab.setAttribute('aria-selected',String(selected));tab.tabIndex=selected?0:-1;$(`panel-${tab.dataset.tab}`).hidden=!selected;}
}
for(const tab of document.querySelectorAll('[data-tab]')){
  tab.addEventListener('click',()=>activateTab(tab.dataset.tab));
  tab.addEventListener('keydown',e=>{if(!['ArrowRight','ArrowLeft','Home','End'].includes(e.key))return;e.preventDefault();const tabs=[...document.querySelectorAll('[data-tab]')];const i=tabs.indexOf(tab);const next=e.key==='Home'?0:e.key==='End'?tabs.length-1:(i+(e.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;activateTab(tabs[next].dataset.tab);tabs[next].focus();});
}
async function copy(value){
  try{await navigator.clipboard.writeText(value);toast('已复制到剪贴板');}
  catch{toast('复制未成功，请手动选择正文复制，或导出 Markdown。');activateTab('prompt');$('prompt-output').focus();$('prompt-output').select();}
}
$('copy-prompt').addEventListener('click',()=>record&&copy(record.data.result.prompt));
$('copy-submission').addEventListener('click',()=>record&&copy(record.data.result.submissionPrompt));
$('copy-all').addEventListener('click',()=>record&&copy(toMarkdown(record.data.result,record.data.metadata)));
$('download').addEventListener('click',()=>{
  if(!record)return;const {result,metadata}=record.data;const url=URL.createObjectURL(new Blob([toMarkdown(result,metadata)],{type:'text/markdown;charset=utf-8'}));
  const a=document.createElement('a');a.href=url;a.download=`镜头提示词-${metadata.skillVersion}-${new Date().toISOString().slice(0,10)}.md`;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('已开始导出完整设计');
});
connection.refresh();sync();
