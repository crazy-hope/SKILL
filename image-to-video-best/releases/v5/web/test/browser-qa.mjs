// Optional real-browser QA against local simulated generation; never uses saved credentials.
// PLAYWRIGHT_MODULE may point to an installed Playwright entry file. No browser download here.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createApp } from '../lib/http.mjs';
import { readConfig } from '../lib/config.mjs';
import { fixture } from './helpers.mjs';
import { AppError } from '../lib/errors.mjs';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const pending=new Map(); let calls=0, peak=0, running=0;
const app=createApp({config:{...readConfig({}),ready:true,missing:[]},generateImpl:async(input,_context,_config,{signal})=>{
  calls++;running++;peak=Math.max(peak,running);
  if(input.idea.startsWith('任务 1')){assert.equal(input.duration,7);assert.equal(input.level,'short');}
  else {assert.equal(input.duration,5);assert.equal(input.level,'auto');}
  try {
    await new Promise((resolve,reject)=>{
      pending.set(input.idea,{resolve,reject});
      signal.addEventListener('abort',()=>reject(new AppError('CANCELLED','测试取消',499)),{once:true});
    });
    return {...fixture,level:input.level==='auto'?'detailed':input.level,prompt:`模拟结果：${input.idea}`};
  } finally {running--;pending.delete(input.idea);}
}});
const server=createServer(async(req,res)=>{
  if(req.url==='/'&&req.method==='GET'){
    const html=await readFile(new URL('../public/index.html',import.meta.url),'utf8');
    res.setHeader('Content-Type','text/html; charset=utf-8');
    res.end(html.replace('FRAME / MOTION','本地模拟 · 无真实生成'));return;
  }
  app(req,res);
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
let browser;
const waitFor=async predicate=>{for(let i=0;i<100;i++){if(predicate())return;await new Promise(r=>setTimeout(r,50));}throw new Error('Timed out waiting for local requests');};
try {
  browser=await chromium.launch({headless:true, ...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{})});
  const context=await browser.newContext({viewport:{width:1440,height:1050},permissions:['clipboard-read','clipboard-write']});
  const page=await context.newPage(); const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await page.waitForFunction(()=>document.querySelectorAll('.task-card').length===4);
  assert.equal(await page.locator('.task-card').count(),4);
  const source=fileURLToPath(new URL('../../v1/image-to-video-best/assets/cases/liquid-goddess/source.png',import.meta.url));
  for(let i=1;i<=4;i++){
    await page.locator(`#task-${i}-image-file`).setInputFiles(source);
    await page.locator(`#task-${i}-idea`).fill(`任务 ${i} 向左慢慢移动`);
    await page.waitForFunction(i=>!document.getElementById(`task-${i}-generate-button`).disabled,i);
  }
  await page.locator('.task-card').first().locator('.task-settings>summary').click();
  await page.locator('#task-1-duration').fill('7');
  await page.locator('.task-card').first().locator('.level-options label').nth(1).click();
  await page.locator('.task-card').first().locator('.task-settings>summary').click();
  await page.locator('#generate-all').click();await waitFor(()=>pending.size===4);
  assert.equal(peak,4);assert.equal(calls,4);
  // Out-of-order completion, one failure, one cancellation while the remaining request stays live.
  pending.get('任务 3 向左慢慢移动').resolve();
  pending.get('任务 2 向左慢慢移动').reject(new AppError('UPSTREAM_RATE_LIMIT','模拟限流',502));
  await page.locator('#task-1-cancel-button').click();
  await waitFor(()=>pending.size===1);assert.ok(pending.has('任务 4 向左慢慢移动'));
  pending.get('任务 4 向左慢慢移动').resolve();
  await page.waitForFunction(()=>document.getElementById('task-2-request-status').textContent==='模拟限流');
  await page.locator('.task-card').nth(2).getByRole('button',{name:'查看详情'}).click();
  assert.equal(await page.locator('#prompt-output').inputValue(),'模拟结果：任务 3 向左慢慢移动');
  await page.locator('#copy-prompt').click();
  assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),'模拟结果：任务 3 向左慢慢移动');
  await page.locator('#copy-all').click();assert.match(await page.evaluate(()=>navigator.clipboard.readText()),/本次未在线复核/);
  const downloadEvent=page.waitForEvent('download');await page.locator('#download').click();
  const download=await downloadEvent;assert.match(download.suggestedFilename(),/^任务3-镜头提示词-v2-/);
  const exported=await readFile(await download.path(),'utf8');assert.match(exported,/模拟结果：任务 3 向左慢慢移动/);
  const shots=new URL('../screenshots/',import.meta.url);await mkdir(shots,{recursive:true});
  await page.screenshot({path:fileURLToPath(new URL('multitask-detail.png',shots))});
  await page.locator('#detail-close').click();
  // Completed entries are skipped by batch; failed entries require explicit retry.
  await page.locator('#task-1-idea').fill('任务 1 新需求');
  await page.locator('#generate-all').click();await waitFor(()=>pending.has('任务 1 新需求'));assert.equal(calls,5);
  await page.locator('#task-2-generate-button').click();await waitFor(()=>pending.size===2);assert.equal(calls,6);
  pending.get('任务 1 新需求').resolve();pending.get('任务 2 向左慢慢移动').resolve();await waitFor(()=>pending.size===0);
  await page.waitForFunction(()=>[...document.querySelectorAll('.task-card')].every(c=>c.dataset.phase==='ready'));
  await page.locator('#task-3-idea').fill('任务 3 修改后的需求');
  await page.locator('.task-card').nth(2).getByRole('button',{name:'查看详情'}).click();
  assert.equal(await page.locator('#stale-notice').isVisible(),true);
  assert.equal(await page.locator('#prompt-output').inputValue(),'模拟结果：任务 3 向左慢慢移动');
  await page.keyboard.press('Escape');
  await page.screenshot({path:fileURLToPath(new URL('multitask-desktop.png',shots)),fullPage:true});
  await page.locator('#add-task').click();assert.equal(await page.locator('.task-card').count(),5);
  assert.equal(await page.locator('#task-5-idea').inputValue(),'');
  assert.equal(await page.locator('#task-4-idea').inputValue(),'任务 4 向左慢慢移动');
  await page.setViewportSize({width:390,height:844});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.locator('.task-card').nth(3).getByRole('button',{name:'查看详情'}).click();
  assert.equal(await page.locator('#prompt-output').inputValue(),'模拟结果：任务 4 向左慢慢移动');
  assert.ok(await page.locator('#result-dialog').evaluate(el=>el.scrollWidth<=el.clientWidth));
  await page.screenshot({path:fileURLToPath(new URL('multitask-mobile.png',shots))});
  await page.keyboard.press('Escape');
  // Whitespace-only input must not enable or join the batch.
  await page.locator('#task-3-idea').fill('   ');
  assert.equal(await page.locator('#task-3-generate-button').isDisabled(),true);
  assert.equal(await page.locator('#generate-all').isDisabled(),true);
  assert.deepEqual(errors,[]);
  console.log('PASS: 4 concurrent HTTP requests, isolated failure/cancel/retry, details/copy/export, stale results, add task, 390px layout, no browser errors. Local simulated output only.');
} finally {
  for(const item of pending.values())item.reject(new AppError('CANCELLED','QA finished',499));
  await browser?.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));
}
