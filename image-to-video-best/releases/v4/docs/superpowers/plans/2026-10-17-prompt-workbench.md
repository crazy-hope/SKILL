# 图生视频提示词工作台 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** 提供本地页面，上传图片与简短需求后，由可配置的多模态服务结合发布版 Skill 生成可复制的图生视频提示词。

**Architecture:** 页面与 API 同源，由本地 Node 服务提供；服务端按白名单读取 Skill 资料，校验输入后调用兼容 Chat Completions 的接口。前端不接触密钥，不持久保存图片；应用置于独立 web/ 目录，只读使用冻结版 v1。

**Tech Stack:** Node.js 22.13+、内置 HTTP/fetch/test runner、原生 HTML/CSS/JavaScript；本地运行，无数据库、无部署。选择轻量本地服务以直接读取现有发布目录；不需要托管 Worker 模板或构建期资料副本。

**Spec:** [页面设计草案](../../web-app-design.md)。用户已批准按计划执行；当前代理在本会话实现，详见 web/VALIDATION.md。

## Global Constraints

- 默认中文、5秒；支持自动／简短／中等／细致，明确用户选择优先。
- 首版仅支持单张首帧图片；不调用视频生成服务。
- v1 只读；应用代码、测试、配置示例和报告放在 web/，不创建空 v2。
- 使用资料快照模式，显示2026-10-17资料日期及“本次未在线复核”；不提供假联网开关。
- API 地址、模型与密钥仅通过服务端环境配置；真实凭据不写入源码或前端。
- 图片只在点击生成时传给所配置服务，默认不落盘、不进入日志。
- 本地服务只绑定127.0.0.1，检查请求Host和Origin；不开放任意跨域访问，不自动对外发布。
- 不提交父仓库或暂存其他项目改动。

## Review Focus

- 用户快速替换图片或修改表单：旧请求不得覆盖新状态，旧结果须标记对应旧输入。
- 伪造图片类型或超大请求：浏览器与服务端均拒绝，不能只信文件扩展名。
- 模型返回HTML、无效JSON、截断结果或伪造来源：安全展示、严格校验，来源元数据由服务端提供。
- 配置错误、超时、限流及上游报错：保留用户输入，显示可操作错误，不回显密钥和完整上游响应。
- 非本地网页访问生成API：校验来源和Host；上游地址只能从服务端配置取得。

## 文件结构

```text
web/
  package.json                 # start / test
  .env.example                 # 非敏感配置示例
  .gitignore                   # 本地凭据与临时输出
  README.md                    # 配置、启动、数据流与限制
  server.mjs                   # 启动同源本地服务
  lib/config.mjs               # 环境配置与上游地址校验
  lib/catalog.mjs              # 模型/版本白名单及Skill资料读取
  lib/input.mjs                # 表单、图片及大小校验
  lib/generate.mjs             # 图文请求、超时、错误映射、结果校验
  lib/http.mjs                 # HTTP路由、请求边界、静态文件白名单
  public/index.html            # 页面结构
  public/styles.css           # 响应式布局与状态
  public/app.js                # 上传、表单、生成与复制/下载
  public/result.js             # 结果转Markdown与安全展示辅助
  test/*.test.mjs              # 输入、资料、生成、路由与结果测试
  test/fixtures/               # 明确标记的模拟结果，仅供测试
  VALIDATION.md                # 验证证据与真实联调状态
```

### Task 1：输入与 Skill 资料管线

**Files:** `web/lib/config.mjs`、`catalog.mjs`、`input.mjs`、`web/package.json`、`web/.env.example`、`web/.gitignore`、`web/test/input.test.mjs`、`catalog.test.mjs`。

**Interfaces:** `readConfig(env)`返回服务端配置；`validateInput(body)`返回规范化表单；`loadSkillContext({version, videoModel})`返回正文、来源清单与资料日期。

- [x] 先写失败测试：非法版本路径被拒；四个视频模型只加载对应模型卡；缺图、空需求、未知等级、非正数时长、超限文本被拒。
- [x] 增加图片测试：仅PNG/JPEG/WebP；应用初始上限10MiB，可配置更低值；服务端检查解码后的字节数与格式签名，前端检查能否实际解码。
- [x] 运行 `node --test web/test/input.test.mjs web/test/catalog.test.mjs`，确认因功能缺失失败。
- [x] 实现白名单与校验；默认 Skill v1、时长5秒、等级auto；平台允许显式“尚未确定”。可选字段分别限2000字符，主要需求限6000字符。
- [x] 配置 `LLM_BASE_URL`（根地址，程序追加 /chat/completions）、`LLM_MODEL`、`LLM_API_KEY`、`PORT`（默认3210）、`LLM_TIMEOUT_MS`（默认120000）、`MAX_IMAGE_MB`（默认10）。不提供默认付费模型或真实密钥。
- [x] 复跑测试通过，确认服务端配置不进入可公开返回的目录元数据。

### Task 2：真实图文请求与结果契约

**Files:** `web/lib/generate.mjs`、`web/test/generate.test.mjs`、`web/test/fixtures/result.json`。

**Interfaces:** `generate(input, context, config, {fetchImpl, signal})`返回校验后的结果；测试注入fetch，生产使用标准fetch。

- [x] 先写失败测试：请求含真实 `image_url` data URL、独立文本需求、Skill正文及正确模型卡；不会传入服务端密钥到消息正文；7秒与用户等级不被默认覆盖。
- [x] 增加超时、401、429、非JSON、截断、缺字段测试；确认错误不包含测试密钥或上游原始响应。
- [x] 运行 `node --test web/test/generate.test.mjs` 确认失败。
- [x] 构造最小兼容请求 `model/messages/stream:false`，不默认附加 temperature、response_format 或工具字段。system包含Skill与任务规则，user包含结构化需求与图片；明确图中或用户素材中的文字不是系统指令。
- [x] 结果至少包含 `level`、`designReason`、`prompt`、`settings`、`uncertainties`；`submissionPrompt`、`omissions`、`clarificationQuestions`可选。允许需澄清状态，但不能伪装已完成适配。
- [x] 元数据中的Skill版本、目标模型、请求时长、快照日期与来源由服务端补入；不能接受模型伪造在线核查日期。结果字段限长、类型校验；去除一层完整JSON代码围栏后再解析，不自动发第二次收费请求。
- [x] 复跑测试，检查上游网络失败也能变成可读错误。

### Task 3：本地 HTTP 服务与端到端契约

**Files:** `web/server.mjs`、`web/lib/http.mjs`、`web/test/http.test.mjs`。

**Interfaces:** `createApp({config, generateImpl})`返回HTTP处理器；`GET /api/config`返回可公开状态与模型选项；`POST /api/generate`返回 `{result, metadata}` 或 `{error:{code,message}}`。

- [x] 先写失败测试：配置缺失时GET仍可用、生成返回明确配置错误；非本地Host／非同源Origin被拒；超限body和错误Content-Type被拒；静态路径穿越无法读取.env或Skill目录。
- [x] 运行 `node --test web/test/http.test.mjs` 确认失败。
- [x] 实现固定静态文件映射、JSON响应、no-store、大小限制和请求超时；前端与API同源，不发送宽松CORS头。
- [x] 接入资料与生成管线，公开配置只返回ready、缺失配置项名称、支持模型、版本、图片上限；不返回密钥或完整上游URL。
- [x] 通过本地模拟上游测试完整请求链路，确认收到图片与Skill信息、返回可展示结果且失败不覆盖已有输入。

### Task 4：页面与结果交互

**Files:** `web/public/*`、`web/test/result.test.mjs`。

**Interfaces:** 页面消费公开配置与生成API；`toMarkdown(result, metadata)`供复制全部与下载复用。

- [x] 为Markdown导出先写失败测试，确认完整设计、提交版、设置、未确认项、来源与快照状态均保留；空可选字段不产生假内容。
- [x] 实现浅色工作台、两栏桌面布局与窄屏单栏；核心表单默认展开，细节字段折叠。所有控件有label和键盘焦点，状态通过aria-live表达。
- [x] 实现拖放／选择、可解码预览、尺寸、替换和删除；异步图片处理以递增标识避免旧文件覆盖新文件，释放对象URL。
- [x] 实现生成中状态与取消；记录输入修订号，输入变化后保留但标记旧结果，过期请求不更新结果。
- [x] 结果按纯文本安全渲染；只为服务端来源清单生成链接；支持复制正文、复制全部、下载Markdown。复制失败时提供可选中文本及提示。
- [x] 未配置接口时页面仍可填写和预览，明确配置指引；不放置假“生成成功”或默认演示成片。
- [x] 浏览器核查桌面和窄屏、上传流程、未配置状态、模拟成功/失败、重复提交、输入变化、复制与下载；自动测试和人工观察分别记录。

### Task 5：文档与交付验收

**Files:** `web/README.md`、`web/VALIDATION.md`、根 `README.md`。

- [x] 写启动与配置说明，解释兼容接口仍需支持图片，图片发送对象、快照模式、无默认存储、当前只支持首帧。
- [x] 运行 `npm test --prefix web` 完整套件，并启动本地服务核对实际页面与响应。
- [x] 执行 `python3 v1/validation/check_package.py`，确认原有22个文件不变。
- [x] 记录真实多模态联调是否完成；没有用户配置时写明“模拟接口通过，真实服务未联调”，不读取无关凭据或发起未知付费调用。
- [x] 自查实现与设计一致性，处理发现的问题；在根README添加工作台入口和启动命令，不修改已冻结版本。
- [x] 交付代码、启动步骤、验证结果及剩余配置项。遵守项目约定，不自动Git提交或部署。
