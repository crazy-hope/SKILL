import { createServer } from 'node:http';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createApp } from './http.mjs';
import { MODELS } from './catalog.mjs';

export const openBrowser=url=>promisify(execFile)('/usr/bin/open',[url]);

async function isWorkbench(url) {
  try {
    const response=await fetch(`${url}/api/config`,{signal:AbortSignal.timeout(1500),redirect:'error'});
    if(!response.ok){await response.body?.cancel();return false;}
    const reader=response.body.getReader();let text='';let size=0;
    try {
      while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;
        if(size>32768){await reader.cancel();return false;}text+=Buffer.from(value).toString('utf8');}
    }finally{reader.releaseLock();}
    const data=JSON.parse(text);
    return typeof data.ready==='boolean' && Array.isArray(data.versions) && data.versions.includes(data.skillVersion) &&
      Array.isArray(data.models) && MODELS.every(model=>data.models.some(item=>item.id===model.id));
  }catch{return false;}
}

export async function startWorkbench(config,{configFile,openPage,warn=console.warn}={}) {
  const server=createServer(createApp({config,configFile}));
  server.headersTimeout=10000;server.requestTimeout=30000;
  let existing=false;
  let url=`http://127.0.0.1:${config.port}`;
  try {
    await new Promise((resolve,reject)=>{
      server.once('error',reject);
      server.listen(config.port,'127.0.0.1',()=>{server.off('error',reject);resolve();});
    });
    url=`http://127.0.0.1:${server.address().port}`;
  }catch(error){
    if(error.code!=='EADDRINUSE'||!openPage||!await isWorkbench(url))throw error;
    existing=true;
  }
  if(openPage){
    try{await openPage(url);}catch{warn(`浏览器未能自动打开，请手动访问：${url}`);}
  }
  return {server:existing?null:server,url,existing};
}
