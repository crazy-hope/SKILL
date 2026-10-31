# 提示词工作台 V1

本地选择八项创作条件，通过 OpenAI 或 DeepSeek 编写提示词。每个方案提供完整中文和英文。

## 启动与使用

1. 在 Finder 中双击项目根目录 [启动提示词工作台.command](../../../../启动提示词工作台.command)。需要 Python 3.9+，无第三方依赖。
2. 保持启动终端运行。浏览器打开 `http://127.0.0.1:8787`；不能通过双击 index.html 调用接口。
3. 右上角“配置模型接口”：选择 OpenAI 或 DeepSeek，输入自己的 API Key；可点击“测试连接 / 获取模型”，然后选择支持 Chat Completions 和 JSON 输出的文本模型，应用配置。
4. 首页八张卡片选择或自定义要求。输入自定义内容后点“添加”或回车；点击生成时也会收集未添加的文字。画幅、目标图像模型、数量单选，其余支持多选。
5. 点击底部中央“生成双语提示词”。结果弹窗显示与数量一致的方案面板，每个面板提供中文和英文；可分别复制、复制整条或复制全部，也可下载 Markdown。
6. “记录与备份”查看最近 30 次生成，查看当次八项要求及规范 SHA-256，恢复输入，导出或恢复 JSON 备份。

日后再次使用，双击同一启动器。按终端 Control+C 停止服务。端口被占用时关闭旧工作台终端，或在项目根目录运行：

```sh
python3 tools/prompt-builder/versions/v1/输出/server.py --port 8789 --open
```

不同端口、浏览器或浏览器配置文件有独立存储，换端口前可导出备份。

## 布局与保存方式

桌面 4×2 八卡片布局，1366×768 已检查一屏显示；较窄窗口两列，手机一列可滚动。下拉使用浮层，底部按钮预留空间。大量标签在卡片内滚动，避免撑破一屏。

API Key 只在本页面内存中，刷新后需要重填。保存模型 ID 和其他设置，不保存 Key。官方 API 地址固定，不支持第三方代理。每次生成将本次要求与完整规范发送给所选服务商，可能产生 API 费用；不会自动重试。模型列表包含账户能访问的不同类型，获取列表成功并不代表所选模型一定支持本工具的请求格式。

草稿、预设和历史在浏览器 localStorage 中；存储被禁用或空间不足时显示提示，可导出备份。备份导入上限 160 MiB，覆盖本工具合法保存结构的保守体积上界。导入会询问是否替换当前草稿和历史；不导入密钥。实际可持久化容量取决于浏览器。

## 规范与历史

每次调用从磁盘读取 [完整 V4 规范](../../../../versions/v4/输出/规范框架v4.md)，记录版本和 SHA-256。V1 明确绑定 V4；未来升级需新建应用版本并调整绑定，不自动选择未完成规范。

代码位于 [输出目录入口](输出/index.html)，服务入口 [server.py](输出/server.py)。

过程记录：[需求](需求.md) · [设计](设计方案.md) · [计划](计划.md) · [变更](变更记录.md) · [验收](验收记录.md)。

## 验证与限制

运行：

```sh
python3 -m unittest discover -s tools/prompt-builder/versions/v1/tests -p 'test_*.py'
node --test tools/prompt-builder/versions/v1/tests/core.test.mjs
```

浏览器模拟验收可运行 `python3 tools/prompt-builder/versions/v1/tests/mock_server.py`，访问 `http://127.0.0.1:8788`，使用任意虚构 Key 和 `mock-text-model`；输入 `mock-error` 可测试失败。此入口返回明确标记“模拟测试”的固定内容，不访问真实服务商，不是生产启动入口。

未提供真实 API Key，所以未验证账户权限、余额和真实模型输出。程序检查格式、方案数量和双语字段，并要求模型检查语义；仍需要使用者核对具体内容，实际图像未验证。未核实的图像模型参数会标为待确认，不编造参数。

接口依据（查阅 2026-10-16）：[OpenAI Chat Completions](https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create)、[DeepSeek 接口说明](https://api-docs.deepseek.com/)、[DeepSeek Chat Completion](https://api-docs.deepseek.com/api/create-chat-completion/)。
