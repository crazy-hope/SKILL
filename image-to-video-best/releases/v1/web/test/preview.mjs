// Manual browser QA only. No external requests, credentials, or real model output.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { createApp } from '../lib/http.mjs';
import { readConfig } from '../lib/config.mjs';
import { AppError } from '../lib/errors.mjs';
import { fixture } from './helpers.mjs';
const app=createApp({config:{...readConfig({}),ready:true,missing:[]},generateImpl:async(input,_context,_config,{signal})=>{
  if(input.idea.startsWith('[error]'))throw new AppError('UPSTREAM_RATE_LIMIT','测试：模型服务限流，请稍后重试。',502);
  await new Promise((resolve,reject)=>{const timer=setTimeout(resolve,input.idea.startsWith('[slow]')?3000:150);signal.addEventListener('abort',()=>{clearTimeout(timer);reject(new AppError('CANCELLED','测试已取消。',499));},{once:true});});
  return {...fixture,level:input.level==='auto'?'detailed':input.level};
}});
const server=createServer(async(req,res)=>{
  if(req.url==='/'&&req.method==='GET'){
    const html=await readFile(new URL('../public/index.html',import.meta.url),'utf8');
    res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end(html.replace('<title>','<title>本地模拟测试 · ').replace('FRAME / MOTION','本地模拟 · 无真实生成'));return;
  }
  app(req,res);
});
server.listen(3211,'127.0.0.1',()=>console.log('Browser QA fixture only: http://127.0.0.1:3211'));
for(const s of ['SIGINT','SIGTERM'])process.on(s,()=>{server.closeAllConnections();server.close(()=>process.exit(0));});
