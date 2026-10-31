# 提示词工作台 V5

基线：[工作台 V4](../v4/README.md)。本版使用完整 [规范 V6](../../../../versions/v6/输出/规范框架v6.md)。

## 如何使用

1. 关闭旧服务对应终端中的进程（Control+C），再双击 [根启动器](../../../../启动提示词工作台.command)。仅刷新旧服务页面不会切换应用版本。
2. 九项格式保持不变。在“目标模型”选择 Midjourney、OpenAI 图像模型、FLUX、Stable Diffusion 或 Imagen；需要具体版本/界面时选自定义填写，例如 `FLUX.2 pro` 或 `SDXL / ComfyUI`。
3. 右上 OpenAI / DeepSeek 仍配置编写提示词的文本接口，与出图目标独立。未指定目标时使用通用自然语言；未登记模型同样标为待适配，不自动套 Midjourney。检测到多个已知模型家族时先澄清。
4. 点击生成。每次读取完整规范，并从规范登记块选取对应规则。结果详情“查看输入、模型适配与官方来源”显示目标、资料范围、日期、来源和规范 SHA-256。
5. 中英文复制、汇总 MD、逐方案 ZIP 与历史备份继续可用；下载和新历史包含适配来源。旧历史不追补虚构信息。

规则为 2026-10-16 查阅的本地快照；文本接口不会自动打开来源链接，本版没有实时抓取。家族匹配不代表所有具体版本能力已验证。尤其 Imagen 的 Vertex AI 官方页面已有旧端点状态提示，应确认实际使用平台；不会自动换成 Gemini。

非 Midjourney 的可复制提示词若含已知 Midjourney 专用参数，工作台拒绝作为成功结果，显示错误，需手动重试；不会静默删除参数或自动产生额外请求。自动检查不能保证语义完整或出图正确。

## 兼容

八张主要卡片及负面输入、30 题材内容库、搜索/筛选、密钥本地隔离、草稿/预设、结果折叠均沿用 V4。API Key 不进入历史或备份。没有新增依赖，仍需 Python 3.9+。旧应用及规范均完整保留。

## 检查与记录

```sh
node --test tools/prompt-builder/versions/v5/tests/*.test.mjs
python3 -m unittest discover -s tools/prompt-builder/versions/v5/tests -p 'test_*.py'
```

模拟服务：`python3 tools/prompt-builder/versions/v5/tests/mock_server.py`，仅监听本机 8788，固定样例不代表模型真实适配或图像效果。正常使用根启动器。

[需求](需求.md) · [设计](设计方案.md) · [计划](计划.md) · [变更](变更记录.md) · [验收](验收记录.md)。
