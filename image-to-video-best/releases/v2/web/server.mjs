import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { readConfig } from './lib/config.mjs';
import { createApp } from './lib/http.mjs';
import { AppError } from './lib/errors.mjs';
try {
  const config=readConfig();
  const server=createServer(createApp({config,configFile:fileURLToPath(new URL('./.local-connection.json',import.meta.url))}));
  server.headersTimeout=10000;server.requestTimeout=30000;
  server.on('error',e=>{console.error(e.code==='EADDRINUSE'?'端口已被使用，请在 .env 中修改 PORT 后重试。':'本地服务启动失败，请检查端口权限。');process.exitCode=1;});
  server.listen(config.port,'127.0.0.1',()=>{
    console.log(`图生视频提示词工作台：http://127.0.0.1:${config.port}`);
    console.log(config.ready?'模型接口已配置（连接尚未验证）。':'模型接口尚未配置：页面可使用，生成前请点击页面右上角配置模型接口。');
  });
  for(const name of ['SIGINT','SIGTERM'])process.on(name,()=>{server.closeAllConnections();server.close(()=>process.exit(0));});
} catch(e) {console.error(e instanceof AppError?e.message:'无法启动，请检查配置。');process.exitCode=1;}
