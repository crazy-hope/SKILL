import { fileURLToPath } from 'node:url';
import { readConfig } from './lib/config.mjs';
import { AppError } from './lib/errors.mjs';
import { startWorkbench, openBrowser } from './lib/startup.mjs';
try {
  const config=readConfig();
  const {server,url,existing}=await startWorkbench(config,{
    configFile:fileURLToPath(new URL('./.local-connection.json',import.meta.url)),
    openPage:process.argv.includes('--open')?openBrowser:undefined
  });
  console.log(existing?`工作台已在运行，已尝试打开：${url}`:`图生视频提示词工作台：${url}`);
  if(server){
    console.log('接口状态与设置请查看页面右上角「配置模型接口」。');
    console.log('保持此终端窗口打开；按 Control+C 或关闭窗口停止本次启动的服务。');
    for(const name of ['SIGINT','SIGTERM','SIGHUP'])process.on(name,()=>{server.closeAllConnections();server.close(()=>process.exit(0));});
  }
} catch(e) {console.error(e.code==='EADDRINUSE'?'端口被其他服务占用，请在 web/.env 中修改 PORT 后重试。':e instanceof AppError?e.message:'无法启动，请检查配置或本机端口权限。');process.exitCode=1;}
