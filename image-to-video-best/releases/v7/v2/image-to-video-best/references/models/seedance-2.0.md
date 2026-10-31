# Seedance 2.0

- 核查日期：2026-10-17（Asia/Shanghai）。
- 适用范围：火山方舟 Doubao Seedance 2.0 标准模型，首帧/首尾帧及参考任务；不把 Fast、Mini 或其他网页产品视为相同入口。
- 证据状态：官方搜索索引中的明确条目已核对；本次直接打开页面只返回 JavaScript 壳，未读取全文或实际操作网页。

## 来源

- S20-P：[官方提示词指南](https://docs.volcengine.com/docs/ark/seedance-2-0-prompt-guide?lang=zh)
- S20-T：[模型教程](https://docs.volcengine.com/docs/ark/seedance-2-0?lang=zh)
- S-API：[创建视频生成任务](https://docs.volcengine.com/docs/ark/create-video-generation-task-api?lang=zh)
- S-TIME：[视频生成教程](https://docs.volcengine.com/docs/ark/video-generation-tutorial?lang=zh)
- S-PORTRAIT：[方舟肖像素材指南](https://docs.volcengine.com/docs/ark/seedance-portrait-asset-guide?lang=zh)

## 已核对的入口限制

| 项目 | 快照事实 | 来源 |
|---|---|---|
| 首帧/首尾帧 | 分别1张/2张；API中 `first_frame`、`last_frame` 与参考任务分开 | S-API |
| 图片 | 每边300—6000px，宽高比0.4—2.5，单图小于30MB；支持PNG、JPEG等 | S-API |
| 真人肖像 | 方舟不支持直接上传含真人人脸的参考图/视频，需采用其支持的肖像素材接入路径 | S20-T、S-PORTRAIT |
| 时长 | 普通生成 `duration` 为4—15整数秒，或-1智能选择 | S-TIME |
| 输出 | 标准2.0可选480p、720p、1080p、4k；Fast/Mini不可继承这组值 | S-API |
| 素材职责 | 首帧任务与参考任务不可混成一个请求；参考图以角色用途区分 | S-API |

本卡没有冻结完整请求schema、具体model ID、网页字数上限或输出FPS。API正文位置为 `content` 中的文本项；只有需要API交付时才复核完整字段。不要从视频输入FPS限制推导输出FPS。

当用户明确使用真人肖像时，区分“获得本人授权”与“已满足方舟素材接入条件”。官方列出本账号受信任模型产物、预置虚拟人像、已授权真人素材等路径；需按当前素材指南核查具体步骤、来源和有效期。快照不足以确认时继续提供运动设计，把素材可提交性标为待确认，不承诺普通URL可直接使用。该条件只描述方舟入口，不外推到即梦等网页，不凭写实外观断言素材是真人，也不将所有人物提示词拒绝处理。

## 官方建议

S20-P强调参考素材的用途：图像提供主体，视频可以提供动作或运镜，音频可以提供音色。编辑/延长任务与新参考生成的意图需分清。主体动作、场景与拍摄要求要明确，复杂任务可以展开细节。

## 本技能适配

首帧模式围绕现有画面写运动；多参考模式才逐一写“参考图片1的主体、视频1的运镜”等职责，不无端引入多参考。中等或细致档可采用“保持项—动作阶段—环境持续—镜头收尾”，这是本技能组织方式，不是官方强制模板。

只有环境音时写明声源与无配乐、无对白；音轨是否生成需按实际入口核对。独立负面字段没有在本次证据中确认，不输出未经确认的 `negative_prompt`。即梦、Dreamina及聚合网页的素材标记、时长选项另查，不直接照搬方舟API。
