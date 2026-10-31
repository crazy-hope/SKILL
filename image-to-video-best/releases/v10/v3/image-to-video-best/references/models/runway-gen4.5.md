# Runway Gen-4.5

- 核查日期：2026-10-17（Asia/Shanghai）。
- 适用范围：Runway官方网页Gen-4.5 Image to Video；API仅保留官方入门示例已核实部分。
- 证据状态：提示词与网页规格正文已读取；API入门示例经官方索引核对，schema入口未展开具体模型字段。

## 来源

- R-P：[Image to Video Prompting Guide](https://help.runwayml.com/hc/en-us/articles/48324313115155-Image-to-Video-Prompting-Guide)
- R-W：[Creating with Gen-4.5](https://help.runwayml.com/hc/en-us/articles/46974685288467-Creating-with-Gen-4-5)
- R-A：[API Getting Started](https://docs.dev.runwayml.com/guides/using-the-api/)
- R-S：[API Reference](https://docs.dev.runwayml.com/api/)

## 已核对的入口限制

| 项目 | 快照事实 | 来源 |
|---|---|---|
| 网页模式 | 输入图片与文本，图片提供起始构图 | R-P、R-W |
| 时长 | 网页2—10秒 | R-W |
| 输出 | 720p；FPS为24或25；16:9为1280×720，另有竖屏和方形等 | R-W |
| 比例 | 默认适配输入，也可裁切；改变画幅会影响边缘内容 | R-W |
| API入门示例 | `model=gen4.5`、`promptImage`、`promptText`、`ratio=1280:720`、`duration=5` | R-A |

网页16:9标签不等于API的ratio字符串。API全套枚举、正文字符硬上限、上传限制需打开当前schema核查，不能从旧版Gen-4推导。独立负面字段与原生同步音频未在上述I2V证据确认，不虚构对应设置。

## 官方建议

R-P把文字重点放在主体、环境、相机的运动及其方向与节奏。可通过自然语言顺序或大致时间标记安排动作；没有强制公式。输入图已经给出外观，但变形、互动和新增内容可需要视觉描述。文档允许根据复杂度增加细节，不等于每次必须很短。

## 本技能适配

简短档直接写动作与镜头；中等/细致档增加路径、阶段、持续性和结束构图，删掉无关外观复述。默认中文，不因厂商名称自动改成英语。用户要求英文时再翻译。

固定镜头要同时交代画面内部的运动；一个镜头中的多个阶段仍写连续镜头。将“不要晃动”具体化为“固定机位”，但不把所有否定句宣布为模型禁用。

8K60fps超出此网页规格快照；将其列为用户目标与后期备选，不宣称原生支持。用户要求音效时可另交付声音设计，原生音频能力未核实时不承诺与画面一并生成。
