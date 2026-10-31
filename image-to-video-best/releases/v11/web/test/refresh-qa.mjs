// Real browser against an isolated local server; no saved configuration or model calls.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdir } from 'node:fs/promises';
import { createApp } from '../lib/http.mjs';
import { readConfig } from '../lib/config.mjs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const server = createServer(createApp({ config: readConfig({}) }));
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
let browser;
try {
  browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_EXECUTABLE ? { executablePath: process.env.BROWSER_EXECUTABLE } : {}) });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  // Reproduce the observed extension's CSS-in-JS update: the default React root
  // key hashes to 1sssysb, independent of its different CSS variable prefix.
  const injectForeignTheme = () => {
    let style = document.querySelector('style[data-css-hash="1sssysb"]');
    if (!style) {
      style = document.createElement('style');
      style.setAttribute('data-css-hash', '1sssysb');
      style.setAttribute('data-token-hash', 'css-var-_r_0_');
      document.head.prepend(style);
    }
    style.textContent = '.css-var-_r_0_{--qingai-extension-color-primary:#00b96b}';
  };
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    for (let round = 0; round < 3; round++) {
      if (round === 0) await page.goto(`http://127.0.0.1:${server.address().port}/?mock=1`);
      else await page.reload();
      await page.getByTestId('task-1').waitFor();
      await page.waitForLoadState('networkidle');
      await page.evaluate(injectForeignTheme);
      const measured = await page.getByTestId('video-model').evaluate(element => {
        const control = element.closest('.ant-select') || element;
        const style = getComputedStyle(control);
        return { primary: style.getPropertyValue('--ant-color-primary').trim(), border: style.borderTopWidth, height: control.getBoundingClientRect().height, overflow: document.documentElement.scrollWidth > innerWidth };
      });
      assert.equal(measured.primary, '#6355cb', `theme must survive foreign root + refresh (${width}, ${round})`);
      assert.equal(measured.border, '1px');
      assert.equal(measured.height, 38);
      assert.equal(measured.overflow, false);
      await page.getByTestId('video-model').click();
      assert.equal(await page.locator('.ant-select-item-option-content').count(), 4);
      await page.keyboard.press('Escape');
    }
    await mkdir(new URL('../screenshots/', import.meta.url), { recursive: true });
    await page.screenshot({ path: new URL(`../screenshots/refresh-${width}.png`, import.meta.url).pathname, fullPage: true });
  }
  assert.deepEqual(errors, []);
  console.log('PASS refresh QA: desktop/mobile, 6 loads, foreign theme collision, component dimensions, dropdowns, no overflow/pageerror. Simulated extension style only.');
} finally {
  await browser?.close();
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
}
