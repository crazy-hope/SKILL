# Wan 3.0

- 核查日期：2026-10-17（Asia/Shanghai）。
- 适用范围：阿里云百炼/Model Studio Wan3.0；API文档当时标注Preview。不能外推至本地Wan2.2、ComfyUI节点或聚合网页。
- 证据状态：下列官方页面正文已读取；未调用接口或操作控制台。

## 来源

- W-P：[Wan3.0提示词指南](https://www.alibabacloud.com/help/en/model-studio/wan3-video-generation-prompt-guide)（页面更新2026-10-16）
- W-A：[Wan3.0 API](https://www.alibabacloud.com/help/en/model-studio/wan3-video-generation-api-reference)（页面更新2026-10-15）

## 已核对的API限制

| 项目 | 快照事实（W-A） |
|---|---|
| ID | `wan3.0-video`、`wan3.0-video-prime` |
| 正文 | `input.prompt`支持中英文，最多20,000字符，超过会截断；不是20,000词 |
| 图像 | `input.media`；首帧`first_frame`、尾帧`last_frame`；PNG/JPEG等，每边240—8000px、比例不超过8:1、20MB以内，不支持透明通道 |
| 时长 | 无视频输入时`parameters.duration`为2—30整数秒，默认5；-1智能选择 |
| 输出 | `resolution`可选480P、720P、1080P；文档说明30fps |
| 比例/音轨 | `ratio`可用adaptive或列出的比例；`audio`默认true，false没有音轨 |
| 改写 | `prompt_extend`默认true；传入file/link时必须true |

本次完整参数表未发现独立`negative_prompt`字段；不要继承Wan2.x同名字段。视频输入的时长/组合约束与单图不同，使用时重新核查。API规格不代表所有网页都提供同样控件。

## 官方建议（W-P）

参考素材按上传顺序分类型编号，图片、视频、音频各自计数。一镜到底可明确写`One continuous shot`；需要时间轴时阶段连续且不要安排难以控制的高频动作。支持写无对白与无BGM；只保留环境音时明确说明。指南允许简要排除列表，但它不是独立API字段的证据。

## 本技能适配

首帧任务用现有图像接续动作，不机械增加参考编号。细致档把流体、局部动作、时间与音频分段，仍保持单镜头。完整长设计受20,000字符硬上限约束；正文排除段如合并提交也计入正文。

对精细编排可建议关闭已确认的智能改写以减少额外改动，明确这是本技能建议而非官方强制；file/link场景不可关闭。网页无该选项就不声称已关闭。仅环境音使用保留音轨加无BGM/无对白，不用`audio=false`代替。
