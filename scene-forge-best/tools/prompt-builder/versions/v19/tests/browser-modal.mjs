import {chromium,expect} from '../输出/node_modules/@playwright/test/index.mjs';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const artifacts=fileURLToPath(new URL('../维护记录/2026-10-30-样式与生成弹窗/',import.meta.url));
const browser=await chromium.launch({channel:'chrome',headless:true});
const context=await browser.newContext({viewport:{width:1280,height:800},acceptDownloads:true,permissions:['clipboard-read','clipboard-write']});
const page=await context.newPage();const errors=[],assetErrors=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('response',r=>{if(r.url().includes('/assets/')&&r.status()!==200)assetErrors.push(r.url());});
const dialog=page.getByRole('dialog',{name:/^完整提示词/});
async function close(){await dialog.getByRole('button',{name:'返回编辑'}).click();await expect(dialog).toHaveCount(0);}
async function bounds(label){
 const b=await dialog.boundingBox();const v=page.viewportSize();
 expect(b.x,label).toBeGreaterThanOrEqual(0);expect(b.y,label).toBeGreaterThanOrEqual(0);
 expect(b.x+b.width,label).toBeLessThanOrEqual(v.width+1);expect(b.y+b.height,label).toBeLessThanOrEqual(v.height+1);
 const f=await dialog.getByRole('button',{name:'返回编辑'}).boundingBox();expect(f.y+f.height,label).toBeLessThanOrEqual(v.height);
 expect(await dialog.evaluate(e=>e.scrollWidth<=e.clientWidth+1),label).toBe(true);
}
try{
 await page.goto('http://127.0.0.1:8797');await expect(page.getByText('规范 V16',{exact:true})).toBeVisible();
 for(const [width,height] of [[1440,900],[1280,800],[1024,768],[390,844]]){
  await page.setViewportSize({width,height});await page.waitForTimeout(150);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  for(const id of ['style','color','camera','mood','moment'])await expect.poll(()=>page.locator('#'+id).evaluate(e=>e.scrollHeight<=e.clientHeight+1)).toBe(true);
  if(width>=1024){const b=await page.locator('.generate').boundingBox();expect(b.y+b.height).toBeLessThanOrEqual(height);console.log(`PASS ${width}x${height}: default action bottom ${b.y+b.height}, complete default text and no overflow`);}
 }
 await page.setViewportSize({width:1280,height:800});await page.screenshot({path:artifacts+'桌面-紧凑布局.png',fullPage:true});
 await page.evaluate(()=>{localStorage.setItem('scene-forge-api-keys-v1',JSON.stringify({openai:'mock-test-key'}));localStorage.setItem('scene-forge-connection-v1',JSON.stringify({provider:'openai',profiles:{openai:{model:'mock-text-model'},deepseek:{model:''}}}));});await page.reload();
 await page.getByRole('textbox',{name:'描绘内容',exact:true}).fill('模拟主体：雨中莲花下的女子。');
 await page.getByRole('combobox',{name:'方案数量'}).click();await page.getByRole('option',{name:'2 对双语',exact:true}).click();
 await page.getByRole('button',{name:'生成完整提示词',exact:true}).click();await expect(dialog.getByRole('status')).toContainText('正在生成完整提示词');await bounds('loading');
 await expect(dialog.getByRole('button',{name:'复制英文'})).toBeVisible();await bounds('ready');await page.screenshot({path:artifacts+'桌面-结果弹窗.png'});
 await dialog.getByRole('tab',{name:/模拟方案 2/}).click();await expect(dialog.locator('.result-scheme-title')).toHaveText('模拟方案 2');
 const expected=await dialog.locator('.prompt-panel pre').nth(1).innerText();await dialog.getByRole('button',{name:'复制英文'}).click();expect(await page.evaluate(()=>navigator.clipboard.readText())).toBe(expected);
 await close();await expect(page.locator('main .prompt-panel')).toHaveCount(0);await page.getByRole('button',{name:'查看提示词',exact:true}).click();await expect(dialog.getByRole('button',{name:'复制英文'})).toBeVisible();await close();
 console.log('PASS real mock HTTP generation opens loading/ready modal; switch, exact copy, close/reopen and no embedded result');
 // A delayed local response validates close/edit invalidation without paid upstream calls.
 await page.route('**/api/generate',async route=>{const response=await route.fetch();await new Promise(r=>setTimeout(r,600));await route.fulfill({response});});
 await page.getByRole('button',{name:'生成完整提示词',exact:true}).click();await expect(dialog.getByText('正在生成完整提示词…')).toBeVisible();await close();await page.getByRole('textbox',{name:'情绪',exact:true}).fill('changed');await page.getByRole('button',{name:'查看生成进度',exact:true}).click();await expect(dialog.getByText(/条件已变更/)).toBeVisible();expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('scene-forge-workspace-v18')).history.length)).toBe(1);await close();await page.unroute('**/api/generate');
 console.log('PASS closing pending request keeps it running; edited input rejects stale response without history');
 const longZh='【模拟长文本】乳白花瓣位于画面上方，湿润纵纹映出暖白透射光。\n'.repeat(75)+'尾部中文校验';
 const longEn='[Simulated long text] A wet ivory petal above the women filters warm white light.\n'.repeat(75)+'x'.repeat(500)+' End marker';
 await page.route('**/api/generate',async route=>{const response=await route.fetch();const body=await response.json();body.schemes=body.schemes.map((s,i)=>({...s,title:`长文本方案 ${i+1}`,zh:longZh,en:longEn+` ${i+1}`}));await route.fulfill({response,json:body});});
 await page.getByRole('textbox',{name:'描绘内容',exact:true}).fill('超长主体湿润的乳白花瓣、淡青衣料与雨幕。\n'.repeat(70));
 await expect.poll(()=>page.locator('#subject').evaluate(e=>e.scrollHeight>e.clientHeight&&getComputedStyle(e).overflowY==='auto')).toBe(true);
 await page.getByRole('combobox',{name:'方案数量'}).click();await page.getByRole('option',{name:'10 对双语',exact:true}).click();await page.getByRole('button',{name:'生成完整提示词',exact:true}).click();await expect(dialog.getByRole('button',{name:'复制英文'})).toBeVisible();
 for(const [width,height] of [[1280,800],[1024,768],[390,844],[390,568]]){
  await page.setViewportSize({width,height});await page.waitForTimeout(150);await bounds(`${width}x${height}`);
  expect(await dialog.locator('.result-scroll').evaluate(e=>e.scrollHeight>e.clientHeight&&e.scrollWidth<=e.clientWidth+1)).toBe(true);
  expect(await dialog.locator('.prompt-panel pre').first().innerText()).toBe(longZh);
  if(height===844)await page.screenshot({path:artifacts+'手机-长结果弹窗.png'});
 }
 await page.setViewportSize({width:1280,height:800});await dialog.getByRole('tab',{name:/长文本方案 10$/,exact:false}).focus();await page.keyboard.press('Enter');await expect(dialog.locator('.result-scheme-title')).toHaveText('长文本方案 10');await dialog.getByRole('button',{name:'复制英文'}).click();expect(await page.evaluate(()=>navigator.clipboard.readText())).toBe(longEn+' 10');
 const downloadEvent=page.waitForEvent('download');await dialog.getByRole('button',{name:'下载全部'}).click();const download=await downloadEvent;await download.saveAs(artifacts+'模拟长文本下载.md');const md=await readFile(artifacts+'模拟长文本下载.md','utf8');expect(md).toContain(longZh);expect(md).toContain(longEn+' 10');expect(md).not.toContain('mock-test-key');
 console.log('PASS ten tabs, long textarea scroll, complete long bilingual copy/download, narrow/short viewport footer and internal scrolling');
 await close();await page.getByRole('button',{name:/记录与备份/}).click();await page.getByRole('button',{name:/^查\s*看$/}).first().click();await expect(dialog.locator('.result-scheme-title')).toHaveText('长文本方案 10');await bounds('history');await close();
 await page.unroute('**/api/generate');await page.setViewportSize({width:390,height:568});
 for(const type of ['clarification','error']){
  const long='开头标记：'+('需要确认画面里的位置、材质和颜色。'.repeat(140))+'结束标记';
  await page.route('**/api/generate',route=>route.fulfill({status:type==='error'?500:200,contentType:'application/json',body:JSON.stringify(type==='error'?{error:long}:{status:'clarification',questions:[long,'最后一个问题']})}));
  await page.getByRole('button',{name:'生成完整提示词',exact:true}).click();await expect(dialog.locator('.ant-alert')).toBeVisible();await bounds(type);
  const area=await dialog.locator('.generation-state').boundingBox(),alert=await dialog.locator('.ant-alert').boundingBox();
  expect(alert.y,`${type} must not overflow above scroll origin`).toBeGreaterThanOrEqual(area.y);
  await dialog.locator('.generation-state').evaluate(e=>{e.scrollTop=e.scrollHeight;});
  const end=await dialog.locator('.ant-alert').boundingBox();expect(end.y+end.height,`${type} end reachable`).toBeLessThanOrEqual(area.y+area.height+1);
  await close();await page.unroute('**/api/generate');
 }
 console.log('PASS long error and clarification fully scrollable from first to last line on short mobile viewport');
 expect(assetErrors).toEqual([]);expect(errors).toEqual([]);console.log('PASS history modal and assets/runtime; all model responses simulated');
}finally{await browser.close();}
