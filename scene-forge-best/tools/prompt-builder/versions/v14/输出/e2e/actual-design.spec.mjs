import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';

const store = 'scene-forge-workspace-v12';
const designs = [
  {题材:'东方奇幻世界',地域:'不限定具体地域',元素:'一座悬浮折光石环、一方镜面水池',视觉偏好:'清晨，冷灰配色，柔和侧光，宁静',镜头:'俯视远景',风格与复杂度:'写实渲染，疏朗低密度',构图:'石环在水池上方，中央环形视觉中心'},
  {题材:'东方奇幻世界',地域:'不限定具体地域',元素:'一棵晶体树、紫色苔原',视觉偏好:'黄昏，紫色与暖金，逆光，神秘',镜头:'低角度中景',风格与复杂度:'细腻插画，疏朗低密度',构图:'晶体树位于左侧，苔原向右展开'},
];
const schemes = [
  {name:'模拟方案 · 折光石环',concept:'模拟响应，仅验证界面。',specs:'9:16',design:designs[0],zh:'东方奇幻世界，一座悬浮折光石环位于一方镜面水池上方。清晨柔和侧光，冷灰配色，宁静氛围。俯视远景，中央环形视觉中心。写实渲染，疏朗低密度，9:16。',en:'An Eastern fantasy world: one floating refractive stone ring above a mirror pool. Soft side light at dawn, cool gray colors, calm mood. An overhead long shot with a central circular focal point. Realistic rendering, sparse detail, 9:16.',config:'模拟测试',checks:'未出图'},
  {name:'模拟方案 · 晶体树',concept:'模拟响应，仅验证界面。',specs:'9:16',design:designs[1],zh:'东方奇幻世界，一棵晶体树位于左侧，紫色苔原向右展开。黄昏暖金逆光，神秘氛围。低角度中景，细腻插画，疏朗低密度，9:16。',en:'An Eastern fantasy world: one crystal tree on the left, purple tundra extending right. Warm golden backlighting at dusk, a mysterious mood. A low-angle medium shot, detailed illustration, sparse detail, 9:16.',config:'模拟测试',checks:'未出图'},
];

for (const mobile of [false,true]) test(`actual design with automatic input, persistence and download (${mobile?'mobile':'desktop'})`,async({page},testInfo)=>{
  if(mobile)await page.setViewportSize({width:390,height:844});
  await page.route('**/api/generate',async route=>{
    const input=route.request().postDataJSON();
    await route.fulfill({json:{status:'ready',schemes,brief:input.brief,provider:'openai',model:'mock-only',spec:{version:'v10',sha256:'mock-only'}}});
  });
  await page.goto('/');
  await page.getByRole('button',{name:'＋ 选择题材',exact:true}).click();
  await page.getByLabel('搜索题材',{exact:true}).fill('东方奇幻世界');
  await page.getByRole('checkbox',{name:'东方奇幻世界',exact:true}).check();
  await page.getByRole('button',{name:'完成选择',exact:true}).click();
  await page.getByLabel('数量',{exact:true}).click();
  await page.locator('.ant-select-dropdown:visible .ant-select-item-option-content').filter({hasText:/^2 个方案/}).click();
  await page.getByRole('button',{name:'配置模型接口'}).click();
  await page.getByLabel('API Key',{exact:true}).fill('mock-only');
  await page.getByLabel('文本模型 ID',{exact:true}).fill('mock-only');
  await page.getByRole('button',{name:'保存配置',exact:true}).click();
  await page.getByRole('button',{name:'生成双语提示词 ↗'}).click();
  const summary=page.getByRole('region',{name:'本方案实际设计'});
  await expect(summary).toContainText('悬浮折光石环');
  await expect(summary).not.toContainText('自动设计');
  await expect(page.getByText(/元素：自动设计/)).toHaveCount(0);
  await page.getByRole('button',{name:/方案2：/}).click();
  await expect(summary).toContainText('晶体树');
  await expect(summary).not.toContainText('悬浮折光石环');
  await expect.poll(()=>page.evaluate(()=>navigator.clipboard.readText())).toBe(schemes[1].en);
  await page.screenshot({path:testInfo.outputPath('实际设计.png'),fullPage:false,animations:'disabled'});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
  await page.getByText('本次工作台输入（原始条件）',{exact:true}).click();
  await expect(page.getByText(/元素：自动设计/)).toBeVisible();
  const pending=page.waitForEvent('download');
  await page.getByRole('button',{name:'下载全部 .md',exact:true}).click();
  const download=await pending;
  const content=await fs.readFile(await download.path(),'utf8');
  expect(content).toContain('本方案实际设计');expect(content).toContain(designs[0].元素);expect(content).toContain(designs[1].镜头);
  await page.reload();
  await page.getByRole('button',{name:/记录与备份/}).click();
  await page.locator('.history-link').first().click();
  await expect(summary).toContainText('悬浮折光石环');
  const saved=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),store);
  expect(saved.history[0].schemes[1].design).toEqual(designs[1]);expect(saved.draft.元素).toBe('');
});
