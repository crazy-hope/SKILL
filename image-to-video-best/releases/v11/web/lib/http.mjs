import { createJobStore } from './jobs.mjs';
import { readFile } from 'node:fs/promises';
import { MODELS, VERSIONS, CURRENT_VERSION, APP_VERSION, modelsForVersion, loadSkillContext } from './catalog.mjs';
import { validateInput } from './input.mjs';
import { generate } from './generate.mjs';
import { AppError } from './errors.mjs';
import { ConnectionStore, listModels } from './connection.mjs';
const publicRoot=new URL('../dist/',import.meta.url);
const types={js:'text/javascript; charset=utf-8',css:'text/css; charset=utf-8',svg:'image/svg+xml'};
function staticAsset(path) {
  if(path==='/') return ['index.html','text/html; charset=utf-8'];
  const match=/^\/assets\/([A-Za-z0-9_-]+\.(js|css|svg))$/.exec(path);
  return match ? [`assets/${match[1]}`,types[match[2]]] : null;
}
function json(res,status,data) {res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(data));}
function body(req,max) {
  return new Promise((resolve,reject)=>{
    let size=0;const chunks=[];let done=false;
    const finish=(error,value)=>{if(done)return;done=true;clearTimeout(timer);error?reject(error):resolve(value);};
    const timer=setTimeout(()=>finish(new AppError('REQUEST_TIMEOUT','上传超时，请重试。',408)),30000);
    if (Number(req.headers['content-length'])>max) {req.resume();finish(new AppError('BODY_TOO_LARGE','请求超过图片与文本大小限制。',413));return;}
    req.on('data',chunk=>{if(done)return;size+=chunk.length;if(size>max){chunks.length=0;finish(new AppError('BODY_TOO_LARGE','请求超过大小限制。',413));}else chunks.push(chunk);});
    req.on('end',()=>{if(done)return;try{finish(null,JSON.parse(Buffer.concat(chunks).toString('utf8')));}catch{finish(new AppError('INVALID_JSON','请求JSON格式无效。'));}});
    req.on('error',()=>finish(new AppError('REQUEST_ABORTED','上传已中断。')));
    req.on('aborted',()=>finish(new AppError('REQUEST_ABORTED','上传已中断。')));
  });
}
export function createApp({config,configFile,generateImpl=generate,fetchImpl=fetch}) {
  const connections=new ConnectionStore(config,configFile);
  const jobs=createJobStore();
  return async(req,res)=>{
    res.setHeader('Cache-Control','no-store');
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Referrer-Policy','no-referrer');
    res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'self'; form-action 'self'");
    try {
      const config=connections.current;
      const host=req.headers.host;
      const allowed=[`127.0.0.1:${req.socket.localPort}`,`localhost:${req.socket.localPort}`];
      if (!allowed.includes(host)) throw new AppError('FORBIDDEN','仅允许本机访问此工作台。',403);
      const path=new URL(req.url,`http://${host}`).pathname;
      if (req.method==='GET'&&path==='/api/config') {
        json(res,200,{ready:config.ready,missing:config.missing,connection:connections.view(),models:MODELS,versions:VERSIONS,maxImageBytes:config.maxImageBytes,skillVersion:CURRENT_VERSION,appVersion:APP_VERSION,snapshotDate:'各模型资料日期见生成结果',onlineVerified:false});return;
      }
      if(req.method==='POST'&&['/api/connection','/api/connection/clear','/api/connection/models'].includes(path)) {
        if(req.headers.origin!==`http://${host}`)throw new AppError('FORBIDDEN','请从本机工作台配置接口。',403);
        if(!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type']||''))throw new AppError('UNSUPPORTED_TYPE','配置请求必须使用JSON。',415);
        const draft=await body(req,16384);
        if(path==='/api/connection/models') {
          const candidate=connections.resolve(draft,{modelOptional:true});
          const abort=new AbortController();const cancel=()=>{if(!res.writableEnded)abort.abort();};res.on('close',cancel);
          try {const result=await listModels(candidate,{fetchImpl,signal:abort.signal});if(!res.destroyed)json(res,200,result);}finally{res.off('close',cancel);}
        }else {const connection=path.endsWith('/clear')?connections.clear():connections.save(draft);json(res,200,{connection,ready:connections.current.ready});}
        return;
      }
      const jobPath=/^\/api\/generate-jobs\/([a-f0-9-]{36})$/.exec(path);
      if(jobPath&&['POST','DELETE'].includes(req.method)) {
        if(req.headers.origin!==`http://${host}`)throw new AppError('FORBIDDEN','请从本机工作台页面访问任务。',403);
        if(req.method==='DELETE'){jobs.remove(jobPath[1]);json(res,200,{cancelled:true});}
        else {
          if(!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type']||''))throw new AppError('UNSUPPORTED_TYPE','任务查询必须使用JSON。',415);
          await body(req,16384);json(res,200,jobs.get(jobPath[1]));
        }
        return;
      }
      if (req.method==='POST'&&['/api/generate','/api/generate-jobs'].includes(path)) {
        if(req.headers.origin!==`http://${host}`) throw new AppError('FORBIDDEN','请从本机工作台页面发起生成。',403);
        if(!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type']||'')) throw new AppError('UNSUPPORTED_TYPE','生成请求必须使用JSON。',415);
        const input=validateInput(await body(req,Math.ceil(config.maxImageBytes/3)*4+128*1024),config);
        if(!config.ready) throw new AppError('NOT_CONFIGURED','请点击右上角「配置模型接口」，填写并保存接口地址、模型和密钥。',503);
        const context=await loadSkillContext(input);
        const execute=async signal=>{
          const result=await generateImpl(input,context,config,{signal});
          return {result,metadata:{skillVersion:input.version,videoModel:modelsForVersion(input.version).find(m=>m.id===input.videoModel).label,platform:input.platform,taskMode:'首帧图生视频',duration:input.duration,aspectRatio:input.aspectRatio,imageInfo:input.imageInfo,snapshotDate:context.snapshotDate,onlineVerified:false,sources:context.sources}};
        };
        if(path==='/api/generate-jobs') {
          const id=jobs.start(execute);
          json(res,202,{id});return;
        }
        const abort=new AbortController();
        const cancel=()=>{if(!res.writableEnded)abort.abort();};
        res.on('close',cancel);
        try {
          const data=await execute(abort.signal);
          if(!res.destroyed) json(res,200,data);
        } finally {res.off('close',cancel);}
        return;
      }
      const asset=req.method==='GET'?staticAsset(path):null;
      if(asset) {
        const [file,type]=asset;let bytes;
        try {bytes=await readFile(new URL(file,publicRoot));}
        catch(error) {if(error.code!=='ENOENT')throw error;json(res,404,{error:{code:'NOT_FOUND',message:'未找到该资源。'}});return;}
        res.writeHead(200,{'Content-Type':type});res.end(bytes);return;
      }
      json(res,404,{error:{code:'NOT_FOUND',message:'未找到该资源。'}});
    } catch(e) {
      if(!res.headersSent&&!res.destroyed) {
        const known=e instanceof AppError;
        if(known&&[408,413].includes(e.status))res.setHeader('Connection','close');
        json(res,known?e.status:500,{error:{code:known?e.code:'INTERNAL_ERROR',message:known?e.message:'服务暂时无法处理请求，请重试或查看本机配置。'}});
      }
    }
  };
}
