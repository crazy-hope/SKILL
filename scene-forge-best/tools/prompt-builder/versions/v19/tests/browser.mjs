import {chromium,expect} from '../输出/node_modules/@playwright/test/index.mjs';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const artifacts=process.env.ARTIFACTS||fileURLToPath(new URL('../验证材料/',import.meta.url));
const defaults=JSON.parse(await readFile(new URL('../输出/defaults.json',import.meta.url)));
const browser=await chromium.launch({channel:'chrome',headless:true});
const context=await browser.newContext({viewport:{width:1512,height:1100},acceptDownloads:true});
const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
const origin='http://127.0.0.1:8797';
try{
 await page.goto(origin);await expect(page.getByText('规范 V16',{exact:true})).toBeVisible();
 await page.evaluate(()=>{localStorage.setItem('scene-forge-api-keys-v1',JSON.stringify({openai:'mock-test-key'}));localStorage.setItem('scene-forge-connection-v1',JSON.stringify({provider:'openai',profiles:{openai:{model:'mock-text-model'},deepseek:{model:''}}}));localStorage.setItem('scene-forge-workspace-v16','OLD-DATA-MUST-STAY');});await page.reload();
 for(const [k,l] of Object.entries({style:'画风题材',color:'色彩',camera:'镜头机位',mood:'情绪',moment:'瞬间状态'}))await expect(page.getByRole('textbox',{name:l,exact:true})).toHaveValue(defaults[k]);
 await expect(page.getByRole('textbox',{name:'描绘内容',exact:true})).toHaveValue('');
 await expect(page.getByRole('button',{name:'AI描述主体',exact:true})).toBeEnabled();await page.screenshot({path:artifacts+'桌面-新建.png',fullPage:true});
 console.log('PASS exact five defaults visible; empty subject; fresh interface');
 expect(await page.locator('.ant-card').count()).toBeGreaterThan(5);expect(await page.locator('.ant-input').count()).toBeGreaterThan(5);
 await page.getByRole('combobox',{name:'方案数量',exact:true}).click();await page.getByRole('option',{name:'10 对双语',exact:true}).click();expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('scene-forge-workspace-v18')).draft.count)).toBe(10);
 await page.getByRole('combobox',{name:'方案数量',exact:true}).click();await page.getByRole('option',{name:'1 对双语',exact:true}).click();
 await page.getByRole('button',{name:'接口设置',exact:true}).click();await expect(page.getByRole('dialog',{name:'接口设置'})).toBeVisible();await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0);await expect(page.getByRole('button',{name:'接口设置',exact:true})).toBeFocused();
 console.log('PASS Ant Design controls, ten-pair select, Escape and focus restoration');

 await page.getByRole('button',{name:'AI描述主体',exact:true}).click();await expect(page.getByRole('textbox',{name:'描绘内容',exact:true})).toContainText('');await expect(page.getByRole('button',{name:'撤销AI描述'})).toBeVisible();
 const subject=await page.getByRole('textbox',{name:'描绘内容',exact:true}).inputValue();expect(subject).toContain('模拟');
 await page.getByRole('button',{name:'撤销AI描述'}).click();await expect(page.getByRole('textbox',{name:'描绘内容',exact:true})).toHaveValue('');
 await page.getByRole('textbox',{name:'描绘内容',exact:true}).fill(subject);
 await page.getByRole('button',{name:'生成完整提示词',exact:true}).click();await expect(page.getByRole('button',{name:'复制英文'})).toBeVisible();
 await page.screenshot({path:artifacts+'桌面-模拟结果.png',fullPage:true});
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('scene-forge-workspace-v18')));expect(saved.history).toHaveLength(1);expect(JSON.stringify(saved)).not.toContain('mock-test-key');expect(saved.history[0].brief.subject).toBe(subject);
 console.log('PASS AI replace/undo; manual direct bilingual generation; isolated key and history');
 await context.grantPermissions(['clipboard-read','clipboard-write']);await page.getByRole('button',{name:'复制英文'}).click();expect(await page.evaluate(()=>navigator.clipboard.readText())).toContain('[Simulated English');
 await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0);
 await page.getByRole('button',{name:/记录与备份/}).click();const backupPromise=page.waitForEvent('download');await page.getByRole('button',{name:'导出当前备份'}).click();const backupFile=await backupPromise;await backupFile.saveAs(artifacts+'模拟备份.json');
 await page.getByRole('button',{name:'新建输入',exact:true}).click();await expect(page.getByRole('textbox',{name:'描绘内容',exact:true})).toHaveValue('');
 await page.getByRole('button',{name:/记录与备份/}).click();await page.locator('input[type=file]').setInputFiles(artifacts+'模拟备份.json');await expect(page.getByRole('textbox',{name:'描绘内容',exact:true})).toHaveValue(subject);await expect(page.getByRole('dialog')).toHaveCount(0);
 await page.getByRole('button',{name:/记录与备份/}).click();await page.getByRole('button',{name:/^查\s*看$/}).click();await expect(page.getByRole('button',{name:'复制英文'})).toBeVisible();console.log('PASS copy, backup download/restore and historical view');

 const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'下载全部'}).click();const download=await downloadPromise;expect(download.suggestedFilename()).toBe('完整提示词.md');await download.saveAs(artifacts+'模拟下载.md');
 await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0);
 await page.getByRole('button',{name:'AI描述主体',exact:true}).click();await page.getByRole('textbox',{name:'情绪',exact:true}).fill('changed');await page.getByRole('textbox',{name:'情绪',exact:true}).fill(defaults.mood);await expect(page.locator('.feedback').filter({hasText:'条件已变更'})).toBeVisible();await expect(page.getByRole('textbox',{name:'描绘内容',exact:true})).toHaveValue(subject);
 await page.getByRole('textbox',{name:'色彩',exact:true}).fill('');await page.locator('.negative .ant-collapse-header').click();await page.getByRole('textbox',{name:'负面提示词',exact:true}).fill('');await page.reload();await page.locator('.negative .ant-collapse-header').click();await expect(page.getByRole('textbox',{name:'色彩',exact:true})).toHaveValue('');await expect(page.getByRole('textbox',{name:'负面提示词',exact:true})).toHaveValue('');
 expect(await page.evaluate(()=>localStorage.getItem('scene-forge-workspace-v16'))).toBe('OLD-DATA-MUST-STAY');console.log('PASS stale edit/revert response discarded; empty values survive reload; legacy data untouched');
 await page.getByRole('button',{name:'恢复五项默认'}).click();await expect(page.getByRole('textbox',{name:'描绘内容',exact:true})).toHaveValue(subject);await expect(page.getByRole('textbox',{name:'负面提示词',exact:true})).toHaveValue('');
 await page.getByRole('textbox',{name:'描绘内容',exact:true}).fill('模拟冲突');await page.getByRole('button',{name:'生成完整提示词',exact:true}).click();await expect(page.getByText('模拟澄清：请统一主体与瞬间状态。')).toBeVisible();expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('scene-forge-workspace-v18')).history.length)).toBe(1);console.log('PASS restoring five preserves subject/negative; conflict not saved');
 await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0);
 await page.setViewportSize({width:390,height:844});await expect.poll(()=>page.locator('#style').evaluate(e=>e.scrollHeight<=e.clientHeight+1)).toBe(true);await page.screenshot({path:artifacts+'手机-界面.png',fullPage:true});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);console.log('PASS 390px mobile layout has no horizontal overflow');
 expect(errors).toEqual([]);console.log('PASS no browser runtime errors; all responses simulated');
}finally{await browser.close();}
