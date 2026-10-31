import { toMarkdown, LEVEL_NAMES } from './result.js';
import { createGenerationTask } from './state.js';
import { assertImageSignature } from './image.js';
import { setupConnection } from './connection.js';
const $=id=>document.getElementById(id);
const tasks=[];
let config=null,record=null,viewedTask=null,toastTimer;
function toast(message){
  clearTimeout(toastTimer);$('toast').textContent=message;$('toast').hidden=false;
  // Keep feedback visible above the native modal's top layer.
  ($('result-dialog').open?$('result-dialog'):document.body).append($('toast'));
  toastTimer=setTimeout(()=>$('toast').hidden=true,3500);
}
function summary(){
  const busy=tasks.filter(t=>t.state.busy).length;
  const done=tasks.filter(t=>t.state.record&&!t.state.stale).length;
  const eligible=tasks.filter(t=>t.batchReady()).length;
  $('task-summary').textContent=`${tasks.length} 个任务 · ${busy} 个生成中 · ${done} 个已有结果`;
  $('generate-all').disabled=!eligible;
  $('generate-all').textContent=eligible?`全部生成（${eligible}）`:'全部生成';
}
function updateDetail(){
  if(!viewedTask||!$('result-dialog').open)return;
  record=viewedTask.state.record;
  if(!record)return;
  renderResult(record.data);
  $('stale-notice').hidden=!viewedTask.state.stale;
  $('result-caption').textContent=viewedTask.state.busy?'此任务正在重新生成，当前显示上次结果':'可复制正文或导出完整设计';
}
function showDetail(task){
  if(!task.state.record)return;
  viewedTask=task;record=task.state.record;
  $('detail-title').textContent=`任务 ${task.number} · 镜头详情`;
  $('result-dialog').querySelector('.step-no').textContent=String(task.number).padStart(2,'0');
  $('result-empty').hidden=true;$('result-loading').hidden=true;$('result-body').hidden=false;
  $('copy-all').disabled=false;$('download').disabled=false;
  $('result-dialog').showModal();updateDetail();activateTab('prompt');$('detail-close').focus();
}
$('detail-close').addEventListener('click',()=>$('result-dialog').close());
$('result-dialog').addEventListener('close',()=>{viewedTask=null;record=null;$('toast').hidden=true;document.body.append($('toast'));});
function readData(file){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error('图片读取失败，请重新选择。'));reader.readAsDataURL(file);});}
function addTask(){
  const number=tasks.length+1;
  const root=$('task-template').content.firstElementChild.cloneNode(true);
  // Unique native IDs preserve labels, datalists and ARIA relationships across cards.
  for(const element of root.querySelectorAll('[id]')){element.dataset.key=element.id;element.id=`task-${number}-${element.id}`;}
  for(const element of [root,...root.querySelectorAll('[for],[list],[aria-labelledby]')]){
    for(const attr of ['for','list','aria-labelledby'])if(element.hasAttribute(attr))element.setAttribute(attr,element.getAttribute(attr).split(' ').map(id=>`task-${number}-${id}`).join(' '));
  }
  const el=id=>root.querySelector(`[data-key="${id}"]`);
  const form=el('brief-form'),viewButton=root.querySelector('[data-role=view-result]');
  root.querySelector('[data-role=task-title]').textContent=`任务 ${number}`;
  root.querySelector('.step-no').textContent=String(number).padStart(2,'0');
  let imageData='',imageTicket=0,imageBusy=false;
  const state=createGenerationTask(sync);
  const task={number,state,sync,batchReady:()=>ready()&&!state.error&&(!state.record||state.stale),start};
  function ready(){return !state.busy&&!imageBusy&&Boolean(imageData)&&Boolean(config?.ready)&&Boolean(el('idea').value.trim())&&Boolean(el('platform').value.trim())&&form.checkValidity();}
  function sync(){
    const busy=state.busy;
    el('generate-button').disabled=!ready();
    el('generate-label').textContent=busy?'正在生成…':state.error?'重试生成':state.record?'重新生成':'生成提示词';
    el('cancel-button').hidden=!busy;viewButton.disabled=!state.record;
    const phase=busy?'busy':state.error?'error':state.record?'ready':'idle';root.dataset.phase=phase;
    root.querySelector('[data-role=task-state]').textContent=busy?'正在生成':state.error?'生成失败':state.stale?'输入已更新':state.record?(state.record.data.result.status==='needs_clarification'?'需要补充':'已完成'):'等待输入';
    el('request-status').textContent=state.error||state.message;el('request-status').classList.toggle('error',Boolean(state.error));
    el('generate-hint').textContent=!config?.ready?'请先在右上角配置模型接口。':imageBusy?'正在读取图片…':!imageData?'上传此任务的首帧图片。':!el('idea').value.trim()?'填写此任务的画面需求。':'独立生成，其他任务不受影响。';
    el('upload-limit').textContent=`PNG / JPG / WebP · 最大 ${Math.round((config?.maxImageBytes??10*1024*1024)/1024/1024*100)/100} MB`;
    const level=form.querySelector('[name=level]:checked').value;
    root.querySelector('.task-settings>summary span').textContent=`${el('duration').value} 秒 · ${level==='auto'?'自动':LEVEL_NAMES[level]}`;
    summary();if(viewedTask===task)updateDetail();
  }
  function clearImage(){imageData='';el('preview-image').removeAttribute('src');el('image-preview').hidden=true;el('upload-empty').hidden=false;el('image-file').value='';}
  async function selectImage(file){
    if(!file)return;
    const ticket=++imageTicket;clearImage();imageBusy=true;el('image-error').hidden=true;state.changed();
    let url;
    try{
      if(!['image/png','image/jpeg','image/webp'].includes(file.type))throw new Error('请选择 PNG、JPEG 或 WebP 图片。');
      if(file.size>(config?.maxImageBytes??10*1024*1024))throw new Error('图片超过当前大小限制，请选择较小的图片。');
      assertImageSignature(new Uint8Array(await file.slice(0,12).arrayBuffer()),file.type);
      if(ticket!==imageTicket)return;
      url=URL.createObjectURL(file);const picture=new Image();picture.src=url;await picture.decode();
      if(!picture.naturalWidth||picture.naturalWidth*picture.naturalHeight>80_000_000)throw new Error('图片尺寸无效或超过8000万像素，请缩小图片。');
      const data=await readData(file);if(ticket!==imageTicket)return;
      imageData=data;el('preview-image').src=data;el('image-info').textContent=`${picture.naturalWidth} × ${picture.naturalHeight} · ${(file.size/1024/1024).toFixed(2)} MB`;
      el('image-preview').hidden=false;el('upload-empty').hidden=true;
    }catch(e){if(ticket!==imageTicket)return;el('image-error').textContent=e instanceof DOMException?'图片无法解码，请重新选择。':e.message;el('image-error').hidden=false;}
    finally{if(url)URL.revokeObjectURL(url);if(ticket===imageTicket){imageBusy=false;sync();}}
  }
  form.addEventListener('input',()=>state.changed());
  // Some browser select/radio controls emit change only.
  form.addEventListener('change',e=>{if(e.target.matches('select,input[type=radio]'))sync();});
  el('image-file').addEventListener('change',event=>selectImage(event.target.files[0]));
  el('remove-image').addEventListener('click',()=>{imageTicket++;imageBusy=false;clearImage();el('image-error').hidden=true;state.changed();});
  const drop=el('drop-zone');
  for(const name of ['dragenter','dragover'])drop.addEventListener(name,e=>{e.preventDefault();drop.classList.add('dragging');});
  for(const name of ['dragleave','drop'])drop.addEventListener(name,e=>{e.preventDefault();drop.classList.remove('dragging');});
  drop.addEventListener('drop',e=>{if(e.dataTransfer.files.length!==1){el('image-error').textContent='每个任务使用一张首帧图片，多张图片请分别放入不同入口。';el('image-error').hidden=false;return;}selectImage(e.dataTransfer.files[0]);});
  el('use-example').addEventListener('click',()=>{el('idea').value='人物缓缓抬起一只手，周围水流与发丝持续轻柔回旋。镜头保持稳定，最后收势凝望；只保留环境音，不要配乐。';state.changed();el('idea').focus();});
  function payload(){
    const details={};for(const field of form.querySelectorAll('[data-detail]'))details[field.dataset.detail]=field.value.trim();
    return {version:config.skillVersion,image:imageData,videoModel:el('video-model').value,platform:el('platform').value.trim(),idea:el('idea').value.trim(),duration:Number(el('duration').value),aspectRatio:el('aspect-ratio').value,level:form.querySelector('[name=level]:checked').value,details};
  }
  async function start(){
    if(!ready())return;
    const data=payload();
    await state.run(async signal=>{
      try{
        const response=await fetch('/api/generate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data),signal});
        const received=await response.json();
        if(!response.ok)throw new Error(received.error?.message||'生成失败，请稍后重试。');
        return received;
      }catch(error){
        if(error instanceof SyntaxError)throw new Error('服务返回格式异常，请确认本机服务仍在运行。');
        if(error.message==='Failed to fetch')throw new Error('无法连接本机服务，请检查网络或启动终端。');
        throw error;
      }
    });
  }
  form.addEventListener('submit',e=>{e.preventDefault();start();});
  el('cancel-button').addEventListener('click',()=>state.cancel());viewButton.addEventListener('click',()=>showDetail(task));
  tasks.push(task);$('task-grid').append(root);sync();return root;
}
const connection=setupConnection({onChange(next,modified){
  config=next;
  if(config){$('skill-badge').textContent=`SKILL ${config.skillVersion}`;$('skill-caption').textContent=`基于 Skill ${config.skillVersion} · 仅编写提示词，不直接生成视频`;}
  for(const task of tasks){if(modified)task.state.changed();else task.sync();}
}});
$('add-task').addEventListener('click',()=>{const root=addTask();root.querySelector('textarea').focus();});
$('generate-all').addEventListener('click',()=>{const eligible=tasks.filter(t=>t.batchReady());for(const task of eligible)task.start();});
window.addEventListener('beforeunload',event=>{if(tasks.some(t=>t.state.busy||t.state.record)){event.preventDefault();event.returnValue='';}});
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
  const a=document.createElement('a');a.href=url;a.download=`任务${viewedTask.number}-镜头提示词-${metadata.skillVersion}-${new Date().toISOString().slice(0,10)}.md`;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('已开始导出完整设计');
});
for(let i=0;i<4;i++)addTask();
connection.refresh();
