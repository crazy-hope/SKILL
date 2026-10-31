import {test,expect} from '@playwright/test';
import {fileURLToPath} from 'node:url';
const evidence=fileURLToPath(new URL('../../验证材料/题材文化边界/',import.meta.url));
for(const [layout,viewport] of [['桌面',{width:1440,height:1000}],['手机',{width:390,height:844}]]){
 test(`${layout}: topic boundary guidance and V13 provenance with empty region`,async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.setViewportSize(viewport);await page.goto('/');
  await page.getByRole('button',{name:'＋ 选择题材',exact:true}).click();
  await page.getByLabel('搜索题材',{exact:true}).fill('东方奇幻世界');
  await page.getByRole('checkbox',{name:'东方奇幻世界',exact:true}).check();
  await page.getByRole('button',{name:'完成选择',exact:true}).click();
  await expect(page.locator('p').filter({hasText:'不自行混入西方文化设定'})).toBeVisible();
  await page.getByRole('button',{name:'＋ 选择元素',exact:true}).click();
  await page.getByLabel('自定义元素',{exact:true}).fill('西式骑士');
  await page.getByRole('button',{name:'完成选择',exact:true}).click();
  await page.reload();
  const draft=await page.evaluate(()=>JSON.parse(localStorage.getItem('scene-forge-workspace-v15')).draft);
  expect(draft.题材).toBe('东方奇幻世界');expect(draft.地域||'').toBe('');
  expect(draft.elementSettings[0]).toMatchObject({name:'西式骑士',presence:'reference'});
  await page.screenshot({path:evidence+`${layout}-题材边界.png`,fullPage:true,animations:'disabled'});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
  await page.getByRole('button',{name:'配置模型接口',exact:true}).click();
  await page.getByLabel('API Key',{exact:true}).fill('mock-topic-boundary');
  await page.getByLabel('文本模型 ID',{exact:true}).fill('mock-text-model');
  await page.getByRole('button',{name:'保存配置',exact:true}).click();
  const response=page.waitForResponse(r=>r.url().endsWith('/api/generate'));
  await page.getByRole('button',{name:'生成双语提示词 ↗',exact:true}).click();
  const result=await (await response).json();expect(result.spec.version).toBe('v13');
  expect(result.brief).toEqual(draft);
  await expect(page.getByText('5 对双语',{exact:true})).toBeVisible();
  expect(errors).toEqual([]);
  // Fixed mock only tests transport/display/provenance, not cultural compliance.
 });
}
