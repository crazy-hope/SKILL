export function setupConnection({onChange}) {
  const $=id=>document.getElementById(id);
  const dialog=$('configuration'),form=$('connection-form');
  let saved=null,busy=false,controller=null;
  function message(text='',error=false){$('connection-message').textContent=text;$('connection-message').classList.toggle('error',error);}
  function lock(value){busy=value;for(const element of form.elements)element.disabled=value;$('connection-close').disabled=value;}
  const providers={openai:{baseUrl:'https://api.openai.com/v1',model:''},deepseek:{baseUrl:'https://api.deepseek.com',model:'deepseek-flash'}};
  function providerFor(base=''){
    const url=base.replace(/\/+$/,'');
    if(['https://api.deepseek.com','https://api.deepseek.com/v1'].includes(url))return 'deepseek';
    return url===providers.openai.baseUrl?'openai':'custom';
  }
  function updateProviderNote(){$('deepseek-note').hidden=providerFor($('connection-base').value)!=='deepseek';}
  function populate(){
    const c=saved?.connection;
    $('connection-base').value=c?.baseUrl||'';
    $('connection-model').value=c?.model||'';
    $('connection-key').value='';
    $('connection-provider').value=providerFor(c?.baseUrl);
    updateProviderNote();
    $('connection-key-state').textContent=c?.hasKey?'已保存在本机':'尚未保存';
    $('connection-key').placeholder=c?.hasKey?'留空沿用已保存的密钥':'输入 API Key';
    $('connection-models').replaceChildren();
  }
  async function refresh(modified=false){
    try {
      const res=await fetch('/api/config',{cache:'no-store'});if(!res.ok)throw new Error();
      saved=await res.json();
      $('connection-label').textContent=saved.ready?'接口已配置':'配置模型接口';
      $('config-button').classList.toggle('ready',saved.ready);onChange(saved,modified);return true;
    }catch{saved=null;$('connection-label').textContent='服务未连接';$('config-button').classList.remove('ready');onChange(null,modified);message('无法读取本机服务，请确认服务正在运行，再重新打开配置。',true);return false;}
  }
  async function open(){
    if(busy)return;
    if(!dialog.open)dialog.showModal();
    lock(true);message('正在读取配置…');
    const ok=await refresh();populate();lock(false);
    if(ok)message(saved.ready?'配置已就绪。可直接使用，或测试连接获取模型列表。':'填写接口地址、Key 和模型，即可开始创作。');
    $('connection-provider').focus();
  }
  function draft(){return {baseUrl:$('connection-base').value.trim(),model:$('connection-model').value.trim(),apiKey:$('connection-key').value.trim()};}
  async function send(path,data){
    controller=new AbortController();const timer=setTimeout(()=>controller?.abort(),20000);
    try {
      const response=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data),signal:controller.signal});
      let result;try{result=await response.json();}catch{throw new Error('服务响应异常，请重启本机工作台后再试。');}
      if(!response.ok)throw new Error(result.error?.message||'操作未完成，请重试。');
      return result;
    }finally{clearTimeout(timer);controller=null;}
  }
  function errorText(e){return e.name==='AbortError'?'等待超时，请重新打开配置确认保存状态。':e.message==='Failed to fetch'?'无法连接本机服务，请确认启动终端仍在运行。':e.message;}
  form.addEventListener('input',()=>{if(!busy)message();});
  $('connection-base').addEventListener('input',()=>{$('connection-provider').value=providerFor($('connection-base').value);$('connection-models').replaceChildren();updateProviderNote();});
  $('connection-provider').addEventListener('change',()=>{
    const preset=providers[$('connection-provider').value];
    if(preset&&$('connection-base').value.replace(/\/+$/,'')!==preset.baseUrl){
      $('connection-base').value=preset.baseUrl;$('connection-key').value='';$('connection-model').value=preset.model;$('connection-models').replaceChildren();
    }else if(preset&&!$('connection-model').value.trim()){$('connection-model').value=preset.model;}
    updateProviderNote();message();
  });
  $('config-button').addEventListener('click',open);
  $('connection-close').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('cancel',event=>{if(busy)event.preventDefault();});
  dialog.addEventListener('close',()=>{$('connection-key').value='';});
  $('connection-test').addEventListener('click',async()=>{
    if(busy||!$('connection-base').reportValidity())return;
    const value=draft();lock(true);message('正在连接服务，读取模型列表…');
    try {
      const result=await send('/api/connection/models',value);
      $('connection-models').replaceChildren();for(const model of result.models){const option=document.createElement('option');option.value=model;$('connection-models').append(option);}
      message(`${result.message} 共 ${result.models.length} 个模型。`);
    }catch(e){message(errorText(e),true);}finally{lock(false);}
  });
  form.addEventListener('submit',async event=>{
    event.preventDefault();if(busy||!form.reportValidity())return;
    const value=draft();lock(true);message('正在保存配置…');
    try {
      await send('/api/connection',value);$('connection-key').value='';
      if(await refresh(true)){populate();message('配置已保存，立即生效。关闭此面板即可开始创作。');}
    }catch(e){message(errorText(e),true);}finally{lock(false);}
  });
  $('connection-clear').addEventListener('click',async()=>{
    if(busy)return;lock(true);message('正在清除已保存密钥…');
    try {
      await send('/api/connection/clear',{});$('connection-key').value='';
      if(await refresh(true)){populate();message('已清除保存的密钥。重新填写并保存后即可生成。');}
    }catch(e){message(errorText(e),true);}finally{lock(false);}
  });
  return {open,refresh};
}
