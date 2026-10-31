// Explicit browser-QA fixture service. Production never imports this file.
import http from 'node:http';
import { fixture } from './fixture.mjs';

http.createServer(async (req, res) => {
  if (req.url !== '/chat/completions' || req.method !== 'POST') { res.writeHead(404); return res.end(); }
  let raw = ''; for await (const c of req) raw += c;
  const body = JSON.parse(raw);
  if (body.model === 'test-error') { res.writeHead(429); return res.end('test rate limit'); }
  if (body.model === 'test-slow') await new Promise(r => setTimeout(r, 15000));
  const data = body.messages[0].content.includes('"summary"') ? { summary: `测试说明：已收到 ${body.messages[1].content.filter(p => p.type === 'image_url').length} 张图片。此响应仅用于检查多图接口，不是实际视觉分析。` } : fixture('v2');
  if (data.candidates) {
    data.analysis.visual_summary = '测试样例：红色杯子置于棕色台面，左上方是白框蓝色窗户。';
    data.analysis.mood = '测试样例：冷暖色彩形成鲜明对照，简洁的图形带来安静的日常感。';
    const titles = ['红杯遇上蓝窗的配色时刻', '一抹红色里的安静日常', '想给自己的角落添点红蓝', '红杯的圆弧遇见蓝窗方格', '这次给红杯配了一扇蓝窗'];
    const english = ['When a red cup meets a blue window', 'A quiet mood in a splash of red', 'A little red and blue for my own corner', 'Red curves meet blue windowpanes', 'A blue window to go with my red cup'];
    data.candidates.forEach((c, i) => { c.zh.title = titles[i]; c.en.title = english[i]; c.angle = ['冷暖配色', '意境共鸣', '代入体验', '细节观察', '自然分享'][i]; });
  }
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify(data) } }] }));
}).listen(4899, '127.0.0.1', () => console.log('Test-only model: http://127.0.0.1:4899'));
