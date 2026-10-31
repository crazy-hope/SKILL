import { readFileSync, writeFileSync, renameSync, unlinkSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { readConfig } from './config.mjs';
import { AppError } from './errors.mjs';
const bad=message=>{throw new AppError('CONNECTION_INVALID',message,400);};
function field(value,name,max) {
  if(typeof value!=='string'||value.length>max||/[\u0000-\u001f\u007f]/.test(value))bad(`${name} 格式无效。`);
  return value.trim();
}
function baseOf(config){return config.endpoint?.replace(/\/chat\/completions$/,'')||'';}
export class ConnectionStore {
  constructor(config,file) {
    this.current=config;this.file=file;
    if(file) {
      let raw;
      try {raw=readFileSync(file,'utf8');} catch(e){if(e.code!=='ENOENT')throw new AppError('CONFIG_READ','无法读取本机接口配置文件。',503);}
      if(raw!==undefined) {
        try {this.current=this.resolve(JSON.parse(raw),{allowIncomplete:true});}
        catch {throw new AppError('CONFIG_READ','本机接口配置文件无效，请检查 .local-connection.json。',503);}
      }
    }
  }
  view(){return {baseUrl:baseOf(this.current),model:this.current.model,hasKey:Boolean(this.current.apiKey)};}
  resolve(draft,{allowIncomplete=false,modelOptional=false}={}) {
    if(!draft||typeof draft!=='object'||Array.isArray(draft))bad('请填写接口地址、模型与密钥。');
    const baseUrl=field(draft.baseUrl,'接口地址',2048);
    const model=field(draft.model??'','模型 ID',300);
    const supplied=field(draft.apiKey??'','API Key',8192);
    let parsed;
    try {parsed=readConfig({LLM_BASE_URL:baseUrl,LLM_MODEL:model,LLM_API_KEY:supplied});}
    catch {bad('请填写 HTTPS API 根地址（本机可用 HTTP），不含查询参数、凭据或 /chat/completions。');}
    if(!parsed.endpoint&&!allowIncomplete)bad('请填写 API 根地址。');
    if(!model&&!modelOptional&&!allowIncomplete)bad('请填写负责看图的模型 ID。');
    // Never forward an old key to a different endpoint without explicit re-entry.
    const apiKey=supplied||(!allowIncomplete&&parsed.endpoint===this.current.endpoint?this.current.apiKey:'');
    if(!apiKey&&!allowIncomplete)bad('请填写 API Key；更换接口地址后需要重新填写密钥。');
    const missing=[['LLM_BASE_URL',baseUrl],['LLM_MODEL',model],['LLM_API_KEY',apiKey]].filter(([,v])=>!v).map(([k])=>k);
    return {...this.current,endpoint:parsed.endpoint,model,apiKey,missing,ready:missing.length===0};
  }
  persist(next){
    if(this.file) {
      const temporary=`${this.file}.${randomUUID()}.tmp`;
      try {
        writeFileSync(temporary,JSON.stringify({baseUrl:baseOf(next),model:next.model,apiKey:next.apiKey},null,2)+'\n',{mode:0o600,flag:'wx'});
        renameSync(temporary,this.file);
      }catch {try{unlinkSync(temporary);}catch{}throw new AppError('CONFIG_WRITE','无法保存本机接口配置，请检查目录写入权限。',500);}
    }
    this.current=next;return this.view();
  }
  save(draft){return this.persist(this.resolve(draft));}
  clear(){
    // Keep address/model; persist the empty key so an env key cannot silently return.
    return this.persist({...this.current,apiKey:'',ready:false,missing:[...new Set([...this.current.missing,'LLM_API_KEY'])]});
  }
}
export async function listModels(config,{fetchImpl=fetch,signal}={}) {
  const timeout=AbortSignal.timeout(Math.min(config.timeoutMs,15000));
  const combined=signal?AbortSignal.any([signal,timeout]):timeout;
  try {
    const response=await fetchImpl(`${baseOf(config)}/models`,{headers:{Authorization:`Bearer ${config.apiKey}`},redirect:'error',signal:combined});
    if(!response.ok){await response.body?.cancel();throw new AppError('MODEL_LIST_ERROR',[401,403].includes(response.status)?'鉴权失败，请检查密钥和服务权限。':'无法获取模型列表；此服务可能不支持 /models，可手动填写模型 ID 后保存。',502);}
    if(!response.body)throw new Error();
    const reader=response.body.getReader();let length=0;const chunks=[];
    try {while(true){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>1024*1024){await reader.cancel();throw new Error();}chunks.push(value);}}finally{reader.releaseLock();}
    const result=JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if(!Array.isArray(result.data))throw new Error();
    const models=[...new Set(result.data.filter(m=>typeof m?.id==='string'&&m.id.length<=300&&!/[\u0000-\u001f\u007f]/.test(m.id)).map(m=>m.id.trim()).filter(Boolean))].sort().slice(0,2000);
    return {models,message:'连接成功，已读取模型列表。列表可能包含纯文本模型；看图与提示词生成能力尚未验证。'};
  }catch(e){
    if(e instanceof AppError)throw e;
    throw new AppError('MODEL_LIST_ERROR',combined.aborted?'连接测试超时或已取消，请检查地址与网络。':'无法读取模型列表，请检查地址、网络或手动填写模型 ID。',502);
  }
}
