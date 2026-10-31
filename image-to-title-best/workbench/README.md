# 画语 · 图片文案工作台

将一张或多张图片一起分析，为同一个短视频生成一套五组中英双语短视频标题和描述，附画面分析、推荐理由和话题标签。React + Ant Design + Vite 前端，Node 本地服务。

## 启动

在 Finder 中双击项目根目录的 `启动工作台.command`。需要 Node.js 22.13 或更新版本；脚本会定位 Node，首次按锁文件安装依赖、构建界面，随后打开浏览器。请保留终端窗口，按 Control+C 停止。

默认地址从 `http://127.0.0.1:4831` 开始；若被其他程序占用，自动尝试后续 9 个端口。同版本已启动时会复用已有服务，不关闭其他程序。服务仅监听本机。

也可以手动启动：

```sh
cd workbench/v4
npm ci
npm run build
npm start
```

## 使用

1. 在“模型设置”中选择 OpenAI、DeepSeek 或兼容接口，填写 API Key。预设模型分别为 `gpt-4.1-mini` 与 `deepseek-flash`，可修改为账号有权使用的视觉模型。
2. 一次选择或拖入 1—9 张 JPG、PNG 或 WebP 静态图片，可继续追加、预览、单张移除或清空。单张最大 100 MB、4000 万像素，合计最大 100 MB。可补充最多 2000 字的背景、图片关联或表达意图。全部图片按上传顺序发送给模型，在同一次请求中综合分析；只生成一套五组文案。
3. 可先“测试模型看图”，核对返回的每张图片说明和整体分析。测试是一次真实模型请求，也会消耗额度；接口接受图片不代表说明一定正确。
4. 生成五组文案，按中英对照、中文或英文浏览，复制单组、标签或全部文案，也可下载 TXT。刷新页面会清除当前图片、结果和页面输入的密钥。

图片和描述仅在用户点击生成／测试后经本地服务发送至选定模型接口；本地程序不保存图片、结果或请求日志。无密钥时不会生成假结果。取消会中止本地等待与上游连接，模型服务端已经开始的计算仍可能计费。

API Key 不写入 localStorage，浏览器只保存服务、模型及自定义地址。需要跨刷新保留密钥时，可自行将 `workbench/.env.example` 复制为 `workbench/.env` 填写；该文件已被 Git 忽略，是本机明文文件。环境密钥仅用于对应官方服务，不发送至自定义接口。页面输入的密钥优先。

兼容接口需要支持 `/chat/completions`、`image_url`、`response_format: {"type":"json_object"}`。Base URL 填到 `/v1` 等基路径，不包含 `/chat/completions`。外部接口使用 HTTPS；本机调试服务允许 HTTP。不自动重试付费请求。

## 两套版本

```text
项目根目录/
├── CURRENT                       # 当前 skill，v3
├── v1/image-to-title-best/SKILL.md # 保留旧版
├── v2/image-to-title-best/SKILL.md # 保留旧版
├── v3/image-to-title-best/SKILL.md
├── 启动工作台.command
└── workbench/
    ├── CURRENT                   # 当前工作台，v4
    ├── CHANGELOG.md
    ├── create-version.mjs
    ├── .env.example
    ├── v1/                       # 保留单图旧版
    ├── v2/                       # 保留 30 MB 多图旧版
    ├── v3/                       # 保留旧版
    └── v4/                       # 主题提炼版完整源码与锁文件
```

当前工作台 v4 配套 Skill v3：标题提炼整体主题，配文展开意义与共鸣，支持疑问、陈述、反问和惊叹。每次请求重新读取根目录 `CURRENT` 对应的完整 skill，因此工作台升级无需覆盖 skill。未来 skill 若改变 JSON 字段结构，需要同步升级工作台校验器；仅改变写作规则无需改界面。

创建下一版：

```sh
node workbench/create-version.mjs v5
```

该脚本复制当前版源码与锁文件，不复制依赖、构建产物、临时结果或密钥，也不覆盖已有版本。编辑新目录后，在新目录执行 `npm ci`、`npm test`、`npm run build`；可通过根目录 `./启动工作台.command v5` 试运行。验证完成后，将 `workbench/CURRENT` 改为 `v5` 并更新变更记录。Skill 当前启用 v3；工作台保留 v1—v3，当前启用 v4。回退单图版时，将两个 `CURRENT` 均改回 `v1`，然后重启启动脚本。

## 开发与测试

```sh
cd workbench/v4
npm test
npm run build
# 两个终端：npm start，以及 npm run dev
```

开发界面运行于 `http://127.0.0.1:5173`，代理到 4831 本地服务；若后端使用了其他端口，修改 Vite 代理目标。测试使用隔离的本地模拟上游验证真实 HTTP 请求链，不调用付费服务。测试程序不用于生产响应。

接口依据（2026-10-26 核对）：[OpenAI 图片输入](https://developers.openai.com/api/docs/guides/images-vision)、[DeepSeek Vision](https://api-docs.deepseek.com/guides/vision/)、[DeepSeek JSON 输出](https://api-docs.deepseek.com/guides/json_mode/)。账号权限和未来模型变更以服务方为准。
